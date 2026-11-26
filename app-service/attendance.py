"""Server-timed daily attendance, with event-only GPS and camera evidence."""
import base64
import hashlib
import hmac
import json
import logging
import math
import os
import secrets
import time
from datetime import date, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from db import database
from student_auth import student
from partner_auth import partner
from coordinator_auth import coordinator
from student_resume import Photo
from audit import record_attendance

router=APIRouter()
log=logging.getLogger(__name__)
MANILA=timezone(timedelta(hours=8))
REQUIRED_HOURS=486
MAX_ABSENCE_LOOKBACK_DAYS=400
# Thesis Chapter 3 requires the reported GPS horizontal accuracy to be within "system-defined precision limits" but
# gives no value. 100 m is a development default (browsers report worse than that when they fall back to cell or
# Wi-Fi location); set IC_GPS_ACCURACY_LIMIT_M to change it.
DEFAULT_ACCURACY_LIMIT_M=100.0
OUT_OF_RADIUS='out of radius'
LOW_ACCURACY='low GPS accuracy'
MISSING_PHOTO='missing photo'


def parse_accuracy_limit(value,default=DEFAULT_ACCURACY_LIMIT_M):
    """Read the accuracy limit from configuration. Missing, non-numeric or non-positive values use the default."""
    try:
        limit=float(value)
    except (TypeError,ValueError):
        return default
    return limit if math.isfinite(limit) and limit>0 else default


ACCURACY_LIMIT_M=parse_accuracy_limit(os.getenv('IC_GPS_ACCURACY_LIMIT_M'))

# Live-camera evidence. A browser cannot prove a photo came from a camera, so the server makes the shortcuts fail:
# only a JPEG the size the page produces is accepted (the page scales every capture to at most 480 px wide, while a
# stored photo is normally far larger), and the photo must come with a short-lived signed capture code that the page
# gets when the camera opens and prints onto the photo. A coordinator can compare the code on the photo with the one
# saved in the record. Set IC_CAPTURE_SECRET when more than one API worker runs, so they share the signing key.
CAPTURE_TTL_SECONDS=180
MAX_PHOTO_WIDTH=480
MAX_PHOTO_HEIGHT=960
STORED_PHOTO='photo has camera metadata'
_CAPTURE_KEY=os.getenv('IC_CAPTURE_SECRET','').encode() or secrets.token_bytes(32)


def issue_challenge(student_id,now=None):
    """A signed capture code for this student, valid for a few minutes."""
    now=int(time.time() if now is None else now)
    code=f'{secrets.randbelow(10000):04d}'
    body=f'{student_id}.{now+CAPTURE_TTL_SECONDS}.{code}'
    signature=hmac.new(_CAPTURE_KEY,body.encode(),hashlib.sha256).hexdigest()[:32]
    return dict(token=f'{body}.{signature}',code=code,expiresIn=CAPTURE_TTL_SECONDS)


def verify_challenge(token,student_id,now=None):
    """The capture code inside a valid, unexpired token that was issued to this student, otherwise None."""
    try:
        owner,expires,code,signature=str(token).split('.')
    except ValueError:
        return None
    expected=hmac.new(_CAPTURE_KEY,f'{owner}.{expires}.{code}'.encode(),hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(signature,expected) or owner!=str(student_id) or not expires.isdigit():
        return None
    return code if int(expires)>=int(time.time() if now is None else now) else None


def jpeg_facts(data_url):
    """(width, height, has_exif) of a JPEG data URL, or None when it is not a readable JPEG."""
    prefix='data:image/jpeg;base64,'
    if not str(data_url).startswith(prefix):
        return None
    try:
        raw=base64.b64decode(data_url[len(prefix):],validate=True)
    except ValueError:
        return None
    if raw[:2]!=b'\xff\xd8':
        return None
    position,has_exif=2,False
    while position+4<=len(raw):
        if raw[position]!=0xFF:
            return None
        marker=raw[position+1]
        if marker==0xFF:
            position+=1  # fill byte
            continue
        if marker==0x01 or 0xD0<=marker<=0xD7:
            position+=2  # markers without a length
            continue
        length=int.from_bytes(raw[position+2:position+4],'big')
        if length<2:
            return None
        segment=raw[position+4:position+2+length]
        if marker==0xE1 and segment[:6]==b'Exif\x00\x00':
            has_exif=True
        if 0xC0<=marker<=0xCF and marker not in (0xC4,0xC8,0xCC):  # a frame header carries the size
            if len(segment)<5:
                return None
            return int.from_bytes(segment[3:5],'big'),int.from_bytes(segment[1:3],'big'),has_exif
        if marker==0xDA:
            return None  # image data before any frame header
        position+=2+length
    return None


def unpack(value):
    return json.loads(value) if isinstance(value,str) else value


def distance(lat,lng,site):
    a,b=math.radians(lat),math.radians(site['lat'])
    delta=math.radians(lng-site['lng'])
    hav=math.sin((a-b)/2)**2+math.cos(a)*math.cos(b)*math.sin(delta/2)**2
    return round(6371000*2*math.asin(math.sqrt(min(1,hav))))


class Clock(BaseModel):
    action: str = Field(pattern=r'^(in|out)$')
    photo: str = Field(default='',max_length=1400000)
    lat: float = Field(ge=-90,le=90,allow_inf_nan=False)
    lng: float = Field(ge=-180,le=180,allow_inf_nan=False)
    accuracy: float = Field(ge=0,le=100000,allow_inf_nan=False)
    challenge: str = Field(default='',max_length=300)

    @model_validator(mode='after')
    def valid_photo(self):
        if self.action == 'in':
            if self.photo:
                # Camera photos only: a JPEG no larger than the page's own capture. A missing photo is flagged, not refused.
                facts = jpeg_facts(self.photo)
                if facts is None:
                    raise ValueError('The attendance photo must be taken with the camera, not chosen from storage.')
                width, height, _ = facts
                if not 0 < width <= MAX_PHOTO_WIDTH or not 0 < height <= MAX_PHOTO_HEIGHT:
                    raise ValueError('This is not a live camera capture. Take the photo again with the camera.')
                Photo(avatar=self.photo)
        else:
            self.photo = ''
            self.challenge = ''
        return self


def check_flags(dist,accuracy,radius,has_photo,remote,limit=None):
    """Reasons a clock event fails verification (thesis Chapter 3, Spatial Distance and Attendance Verification)."""
    limit=ACCURACY_LIMIT_M if limit is None else limit
    flags=[]
    if not remote and dist is not None and radius is not None and dist>radius:
        flags.append(OUT_OF_RADIUS)
    if not remote and accuracy>limit:
        flags.append(LOW_ACCURACY)
    if not has_photo:
        flags.append(MISSING_PHOTO)
    return flags


def minutes(value):
    hour,minute=map(int,value.split(':'))
    return hour*60+minute


class Refusal(HTTPException):
    """A clock attempt the server will not record. The reason is kept for the attempts log."""
    def __init__(self,status,detail,reason,dist=None,radius=None):
        super().__init__(status,detail)
        self.reason,self.distance,self.radius=reason,dist,radius


ATTEMPT_SQL=('INSERT INTO attendance_attempts (student_id,attempted_at,action,outcome,reasons,distance_m,accuracy_m,radius_m) '
             'VALUES (%s,UTC_TIMESTAMP(6),%s,%s,%s,%s,%s,%s)')


def log_refused(student_id,body,refusal):
    # A separate transaction: the refusal rolls the request back, but the attempt must still be logged.
    try:
        with database() as connection:
            connection.cursor().execute(ATTEMPT_SQL,(student_id,body.action,'rejected',refusal.reason,refusal.distance,body.accuracy,refusal.radius))
    except Exception:
        log.exception('Could not log a refused attendance attempt')  # never hide the refusal behind a logging problem


@router.post('/api/student/attendance/challenge')
def challenge(account=Depends(student)):
    """Called when the camera opens. The page prints the returned code onto the photo and sends the token with it."""
    return issue_challenge(account['id'])


@router.post('/api/student/attendance/clock')
def clock(body:Clock,account=Depends(student)):
    try:
        return perform_clock(body,account)
    except Refusal as refusal:
        log_refused(account['id'],body,refusal)
        raise


def perform_clock(body,account):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        cursor.execute('SELECT student_id,schedule,confirmed_at FROM official_placements WHERE student_id=%s FOR UPDATE',(account['id'],))
        placement=cursor.fetchone()
        if not placement:
            raise Refusal(403,'Attendance opens after coordinator-confirmed deployment.','no deployment')
        cursor.execute('SELECT UTC_TIMESTAMP(6) AS now')
        utc=cursor.fetchone()['now']
        local=utc.replace(tzinfo=timezone.utc).astimezone(MANILA)
        day=local.date().isoformat()
        cursor.execute('SELECT * FROM student_attendance WHERE student_id=%s AND work_date=%s FOR UPDATE',(account['id'],day))
        record=cursor.fetchone()
        schedule=unpack(placement['schedule'])
        remote=schedule['mode']=='Remote'
        site=schedule.get('site')
        if not remote and not site:
            raise Refusal(409,'Your worksite is not configured. Contact your coordinator.','worksite not configured')
        dist=None if remote else distance(body.lat,body.lng,site)
        radius=site['radius'] if site else None
        minute=local.hour*60+local.minute
        if body.action=='in':
            if record:
                raise Refusal(409,'You already timed in today.','already timed in',dist,radius)
            capture_code=None
            if body.photo:
                capture_code=verify_challenge(body.challenge,account['id'])
                if capture_code is None:
                    raise Refusal(400,'Take the photo again with the camera: this capture was not started on this screen, or it took too long.','photo not live',dist,radius)
            cursor.execute('SELECT name FROM attendance_holidays WHERE class_code=%s AND holiday_date=%s',(account['class_code'],day))
            holiday=cursor.fetchone()
            on_schedule=(local.weekday()+1)%7 in schedule['days'] and not holiday
            flags=check_flags(dist,body.accuracy,radius,bool(body.photo),remote)
            if body.photo and jpeg_facts(body.photo)[2]:
                flags.append(STORED_PHOTO)  # camera metadata is what a stored photo has and a live capture does not
            status='Outside schedule' if not on_schedule else 'Flagged' if flags else 'Late' if minute>minutes(schedule['timeIn'])+schedule['grace'] else 'Present'
            payload=dict(date=day,timeIn=minute,timeOut=None,hours=0,lat=body.lat,lng=body.lng,dist=dist,
                accuracy=body.accuracy,photoIn=body.photo,captureCode=capture_code,status=status,remote=remote,flags=flags,
                radius=radius,place=site['place'] if site else 'Remote (work from home)',live=True)
            cursor.execute('INSERT INTO student_attendance (student_id,work_date,clock_in,payload,review) VALUES (%s,%s,%s,%s,\'\')',(account['id'],day,utc,json.dumps(payload)))
            reasons=flags+([] if on_schedule else ['holiday' if holiday else 'outside schedule'])
            note='Time in'
        else:
            if not record or record['clock_out']:
                raise Refusal(409,'There is no open Time In for today.','no open time-in',dist,radius)
            payload=unpack(record['payload'])
            elapsed=max(0,(utc-record['clock_in']).total_seconds()/3600)
            # Credit only the scheduled portion, with the existing one-hour break rule.
            start=max(payload['timeIn'],minutes(schedule['timeIn']))
            end=min(minute,minutes(schedule['timeOut']))
            duration=max(0,(end-start)/60)
            hours=round(min(elapsed,max(0,duration-(1 if duration>5 else 0))),2)
            payload.update(timeOut=minute,hours=hours,latOut=body.lat,lngOut=body.lng,distOut=dist,accuracyOut=body.accuracy)
            flags=check_flags(dist,body.accuracy,radius,True,remote)  # no photo is taken at time out
            if flags:
                payload['flags']=list(payload.get('flags') or [])+[flag+' (time out)' for flag in flags]
                if payload['status']!='Outside schedule':
                    payload['status']='Flagged'
            cursor.execute('UPDATE student_attendance SET clock_out=%s,payload=%s WHERE student_id=%s AND work_date=%s',(utc,json.dumps(payload),account['id'],day))
            reasons=flags
            status=payload['status']
            note='Time out'
        cursor.execute(ATTEMPT_SQL,(account['id'],body.action,'flagged' if reasons else 'accepted',', '.join(reasons),dist,body.accuracy,radius))
        record_attendance(cursor,account['class_code'],'student',account['id'],account['id'],day,
                          note+(' flagged: '+', '.join(reasons) if reasons else ' recorded'),'Flagged' if reasons else 'Success')
    return {'ok':True,'status':status,'flags':payload.get('flags',[])}


def missing_workdays(schedule,deployed,today,holidays,attended,stored):
    """Scheduled workdays after deployment and before today with no clock-in, holiday or stored absence (ISO dates)."""
    days=set(schedule['days'])
    day=max(deployed+timedelta(days=1),today-timedelta(days=MAX_ABSENCE_LOOKBACK_DAYS))
    found=[]
    while day<today:
        iso=day.isoformat()
        if (day.weekday()+1)%7 in days and iso not in holidays and iso not in attended and iso not in stored:
            found.append(iso)
        day+=timedelta(days=1)
    return found


QUERY='SELECT r.*,s.email,s.name FROM student_attendance r JOIN student_accounts s ON s.id=r.student_id '
PLACED=('SELECT p.student_id,p.schedule,p.confirmed_at,s.email,s.name,s.class_code FROM official_placements p '
        'JOIN student_accounts s ON s.id=p.student_id ')
SCOPES={'student':'WHERE p.student_id=%s',
        'coordinator':'JOIN coordinator_batches o ON o.class_code=s.class_code WHERE o.coordinator_id=%s',
        'partner':'JOIN internship_applications a ON a.id=p.application_id WHERE a.company_id=%s'}


def manila_today(cursor):
    cursor.execute('SELECT UTC_TIMESTAMP(6) AS now')
    return cursor.fetchone()['now'].replace(tzinfo=timezone.utc).astimezone(MANILA).date()


def absence_and_holiday_rows(cursor,placed,items,today):
    """Absences (recorded on first read) and holiday rows for the deployed students in scope."""
    if not placed:
        return []
    ids=[row['student_id'] for row in placed]
    cursor.execute('SELECT student_id,work_date,review,note FROM attendance_absences WHERE student_id IN ('+','.join(['%s']*len(ids))+')',ids)
    stored={}
    for row in cursor.fetchall():
        stored.setdefault(row['student_id'],{})[row['work_date'].isoformat()]=row
    codes=sorted({row['class_code'] for row in placed})
    cursor.execute('SELECT class_code,holiday_date,name FROM attendance_holidays WHERE class_code IN ('+','.join(['%s']*len(codes))+')',codes)
    holidays={}
    for row in cursor.fetchall():
        holidays.setdefault(row['class_code'],{})[row['holiday_date'].isoformat()]=row['name']
    attended,hours={},{}
    for item in items:
        email=item['email'].lower()
        attended.setdefault(email,set()).add(item['date'])
        hours[email]=hours.get(email,0)+item['hours']
    inserts,rows=[],[]
    for placement in placed:
        email=placement['email'].lower()
        schedule=unpack(placement['schedule'])
        deployed=(placement['confirmed_at']+timedelta(hours=8)).date()
        mine=stored.setdefault(placement['student_id'],{})
        off=holidays.get(placement['class_code'],{})
        done=attended.get(email,set())
        if hours.get(email,0)<REQUIRED_HOURS:  # no new absences once the required hours are credited
            for day in missing_workdays(schedule,deployed,today,set(off),done,set(mine)):
                mine[day]={'review':'','note':None}
                inserts.append((placement['student_id'],day))
        for day,row in sorted(mine.items()):
            if day in off or day in done:
                continue  # a holiday is never an absence, and a clock-in supersedes one
            rows.append(dict(date=day,status='Absent',hours=0,review=row['review'] or '',
                             note=unpack(row['note']) if row['note'] else None,
                             email=placement['email'],name=placement['name'],timeIn=None,timeOut=None))
        for day,name in off.items():
            moment=date.fromisoformat(day)
            if deployed<moment<today and (moment.weekday()+1)%7 in schedule['days'] and day not in done:
                rows.append(dict(date=day,status='Holiday',hours=0,review='',place=name,
                                 email=placement['email'],name=placement['name'],timeIn=None,timeOut=None))
    if inserts:
        cursor.executemany("INSERT IGNORE INTO attendance_absences (student_id,work_date,review,created_at) VALUES (%s,%s,'',UTC_TIMESTAMP())",inserts)
    return rows


def records(where,args,scope):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        cursor.execute(PLACED+SCOPES[scope],args)
        placed=cursor.fetchall()
        today=manila_today(cursor)
        cursor.execute(QUERY+where+' ORDER BY r.work_date DESC',args)
        result=[]
        for row in cursor.fetchall():
            item=unpack(row['payload'])
            item.update(email=row['email'],name=row['name'],review=row['review'],note=unpack(row['note']) if row['note'] else None)
            if row['review']=='rejected' or (item['status'] in ('Flagged','Outside schedule') and row['review']!='accepted'):
                item['hours']=0
            if not row['clock_out']:
                item['status']='Clocked in'
            result.append(item)
        result.extend(absence_and_holiday_rows(cursor,placed,result,today))
        result.sort(key=lambda item:item['date'],reverse=True)
        return {'attendance':result}


@router.get('/api/student/attendance')
def mine(account=Depends(student)):
    return records('WHERE r.student_id=%s',(account['id'],),'student')


@router.get('/api/coordinator/attendance')
def batches(account=Depends(coordinator)):
    return records('JOIN coordinator_batches o ON o.class_code=s.class_code WHERE o.coordinator_id=%s',(account['id'],),'coordinator')


@router.get('/api/partner/attendance')
def company(account=Depends(partner)):
    return records('JOIN official_placements p ON p.student_id=s.id JOIN internship_applications a ON a.id=p.application_id WHERE a.company_id=%s',(account['company_id'],),'partner')


class Review(BaseModel):
    email: str = Field(min_length=3,max_length=254)
    date: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    decision: str = Field(pattern=r'^(accepted|rejected|excused|unexcused|)$')


REVIEW_AUDIT={'accepted':('Accepted flagged clock-in','Verified'),'rejected':('Rejected flagged clock-in','Flagged'),
              'excused':('Excused the absence','Verified'),'unexcused':('Kept the absence','Flagged'),
              '':('Cleared the attendance review','Success')}


@router.put('/api/coordinator/attendance/review')
def review(body:Review,account=Depends(coordinator)):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        email=body.email.strip().lower()
        cursor.execute('SELECT r.student_id,r.payload,s.class_code FROM student_attendance r JOIN student_accounts s ON s.id=r.student_id JOIN coordinator_batches o ON o.class_code=s.class_code WHERE s.email=%s AND r.work_date=%s AND o.coordinator_id=%s AND r.clock_out IS NOT NULL FOR UPDATE',(email,body.date,account['id']))
        row=cursor.fetchone()
        if row:
            if body.decision in ('excused','unexcused'):
                raise HTTPException(409,'Only an absence can be excused. Accept or reject this clock-in instead.')
            if unpack(row['payload'])['status'] not in ('Flagged','Outside schedule','Late'):
                raise HTTPException(409,'This attendance record does not require review.')
            cursor.execute('UPDATE student_attendance SET review=%s,reviewed_by=%s WHERE student_id=%s AND work_date=%s',(body.decision,account['id'],row['student_id'],body.date))
        else:
            cursor.execute('SELECT a.student_id,s.class_code FROM attendance_absences a JOIN student_accounts s ON s.id=a.student_id JOIN coordinator_batches o ON o.class_code=s.class_code WHERE s.email=%s AND a.work_date=%s AND o.coordinator_id=%s FOR UPDATE',(email,body.date,account['id']))
            row=cursor.fetchone()
            if not row:
                raise HTTPException(404,'Attendance record not found.')
            if body.decision in ('accepted','rejected'):
                raise HTTPException(409,'An absence is excused or kept, not accepted or rejected.')
            cursor.execute('UPDATE attendance_absences SET review=%s,reviewed_by=%s WHERE student_id=%s AND work_date=%s',(body.decision,account['id'],row['student_id'],body.date))
        action,status=REVIEW_AUDIT[body.decision]
        record_attendance(cursor,row['class_code'],'coordinator',account['id'],row['student_id'],body.date,action,status)
    return {'ok':True}


class Explanation(BaseModel):
    date: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    type: str = Field(min_length=1,max_length=100)
    reason: str = Field(min_length=5,max_length=300)


@router.put('/api/student/attendance/explanation')
def explain(body:Explanation,account=Depends(student)):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        cursor.execute('SELECT review FROM student_attendance WHERE student_id=%s AND work_date=%s FOR UPDATE',(account['id'],body.date))
        row=cursor.fetchone()
        table='student_attendance'
        if not row:
            cursor.execute('SELECT review FROM attendance_absences WHERE student_id=%s AND work_date=%s FOR UPDATE',(account['id'],body.date))
            row=cursor.fetchone()
            table='attendance_absences'
        if not row:
            raise HTTPException(404,'Attendance record not found.')
        if row['review']:
            raise HTTPException(409,'This attendance record has already been reviewed.')
        cursor.execute('UPDATE '+table+' SET note=%s WHERE student_id=%s AND work_date=%s',(json.dumps(dict(type=body.type,reason=body.reason,at=body.date)),account['id'],body.date))
        record_attendance(cursor,account['class_code'],'student',account['id'],account['id'],body.date,'Explanation sent')
    return {'ok':True}
