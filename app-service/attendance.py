"""Server-timed daily attendance, with event-only GPS and camera evidence."""
import json
import math
from datetime import timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from db import database
from student_auth import student
from partner_auth import partner
from coordinator_auth import coordinator
from student_resume import Photo

router=APIRouter()
MANILA=timezone(timedelta(hours=8))


def unpack(value):
    return json.loads(value) if isinstance(value,str) else value


def distance(lat,lng,site):
    a,b=math.radians(lat),math.radians(site['lat'])
    delta=math.radians(lng-site['lng'])
    hav=math.sin((a-b)/2)**2+math.cos(a)*math.cos(b)*math.sin(delta/2)**2
    return round(6371000*2*math.asin(math.sqrt(min(1,hav))))


class Clock(BaseModel):
    action: str = Field(pattern=r'^(in|out)$')
    photo: str = Field(max_length=1400000)
    lat: float = Field(ge=-90,le=90,allow_inf_nan=False)
    lng: float = Field(ge=-180,le=180,allow_inf_nan=False)
    accuracy: float = Field(ge=0,le=100000,allow_inf_nan=False)

    @model_validator(mode='after')
    def valid_photo(self):
        Photo(avatar=self.photo)
        if not self.photo:
            raise ValueError('Capture an attendance photo first.')
        return self


def minutes(value):
    hour,minute=map(int,value.split(':'))
    return hour*60+minute


@router.post('/api/student/attendance/clock')
def clock(body:Clock,account=Depends(student)):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        cursor.execute('SELECT student_id,schedule,confirmed_at FROM official_placements WHERE student_id=%s FOR UPDATE',(account['id'],))
        placement=cursor.fetchone()
        if not placement:
            raise HTTPException(403,'Attendance opens after coordinator-confirmed deployment.')
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
            raise HTTPException(409,'Your worksite is not configured. Contact your coordinator.')
        dist=None if remote else distance(body.lat,body.lng,site)
        minute=local.hour*60+local.minute
        if body.action=='in':
            if record:
                raise HTTPException(409,'You already timed in today.')
            on_schedule=(local.weekday()+1)%7 in schedule['days']
            status='Outside schedule' if not on_schedule else 'Flagged' if not remote and dist>site['radius'] else 'Late' if minute>minutes(schedule['timeIn'])+schedule['grace'] else 'Present'
            payload=dict(date=day,timeIn=minute,timeOut=None,hours=0,lat=body.lat,lng=body.lng,dist=dist,
                accuracy=body.accuracy,photoIn=body.photo,status=status,remote=remote,
                radius=site['radius'] if site else None,place=site['place'] if site else 'Remote (work from home)',live=True)
            cursor.execute('INSERT INTO student_attendance (student_id,work_date,clock_in,payload,review) VALUES (%s,%s,%s,%s,\'\')',(account['id'],day,utc,json.dumps(payload)))
        else:
            if not record or record['clock_out']:
                raise HTTPException(409,'There is no open Time In for today.')
            payload=unpack(record['payload'])
            elapsed=max(0,(utc-record['clock_in']).total_seconds()/3600)
            # Credit only the scheduled portion, with the existing one-hour break rule.
            start=max(payload['timeIn'],minutes(schedule['timeIn']))
            end=min(minute,minutes(schedule['timeOut']))
            duration=max(0,(end-start)/60)
            hours=round(min(elapsed,max(0,duration-(1 if duration>5 else 0))),2)
            payload.update(timeOut=minute,hours=hours,latOut=body.lat,lngOut=body.lng,distOut=dist,accuracyOut=body.accuracy,photoOut=body.photo)
            if not remote and dist>site['radius'] and payload['status']!='Outside schedule':
                payload['status']='Flagged'
            cursor.execute('UPDATE student_attendance SET clock_out=%s,payload=%s WHERE student_id=%s AND work_date=%s',(utc,json.dumps(payload),account['id'],day))
    return {'ok':True}


QUERY='SELECT r.*,s.email,s.name FROM student_attendance r JOIN student_accounts s ON s.id=r.student_id '


def records(where,args):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
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
        return {'attendance':result}


@router.get('/api/student/attendance')
def mine(account=Depends(student)):
    return records('WHERE r.student_id=%s',(account['id'],))


@router.get('/api/coordinator/attendance')
def batches(account=Depends(coordinator)):
    return records('JOIN coordinator_batches o ON o.class_code=s.class_code WHERE o.coordinator_id=%s',(account['id'],))


@router.get('/api/partner/attendance')
def company(account=Depends(partner)):
    return records('JOIN official_placements p ON p.student_id=s.id JOIN internship_applications a ON a.id=p.application_id WHERE a.company_id=%s',(account['company_id'],))


class Review(BaseModel):
    email: str = Field(min_length=3,max_length=254)
    date: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    decision: str = Field(pattern=r'^(accepted|rejected|)$')


@router.put('/api/coordinator/attendance/review')
def review(body:Review,account=Depends(coordinator)):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        cursor.execute('SELECT r.student_id,r.payload FROM student_attendance r JOIN student_accounts s ON s.id=r.student_id JOIN coordinator_batches o ON o.class_code=s.class_code WHERE s.email=%s AND r.work_date=%s AND o.coordinator_id=%s AND r.clock_out IS NOT NULL FOR UPDATE',(body.email.strip().lower(),body.date,account['id']))
        row=cursor.fetchone()
        if not row:
            raise HTTPException(404,'Attendance record not found.')
        if unpack(row['payload'])['status'] not in ('Flagged','Outside schedule','Late'):
            raise HTTPException(409,'This attendance record does not require review.')
        cursor.execute('UPDATE student_attendance SET review=%s,reviewed_by=%s WHERE student_id=%s AND work_date=%s',(body.decision,account['id'],row['student_id'],body.date))
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
        if not row:
            raise HTTPException(404,'Attendance record not found.')
        if row['review']:
            raise HTTPException(409,'This attendance record has already been reviewed.')
        cursor.execute('UPDATE student_attendance SET note=%s WHERE student_id=%s AND work_date=%s',(json.dumps(dict(type=body.type,reason=body.reason,at=body.date)),account['id'],body.date))
    return {'ok':True}
