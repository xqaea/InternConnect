"""Clock transitions, verification flags, attempt log, absences, holidays, reviews and audit for attendance."""
import base64
import json
from datetime import date, datetime
from unittest import TestCase
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from pydantic import ValidationError
import attendance as module
import placements
from test_coordinator_auth import database_for

def make_jpeg(width=480,height=360,exif=False):
    """A minimal JPEG header of the given size (enough for the server's checks), as the page's canvas would send."""
    def segment(marker,payload):
        return b'\xff'+bytes([marker])+(len(payload)+2).to_bytes(2,'big')+payload
    body=b'\xff\xd8'+segment(0xE0,b'JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00')
    if exif:
        body+=segment(0xE1,b'Exif\x00\x00II*\x00\x08\x00\x00\x00')
    body+=segment(0xC0,b'\x08'+height.to_bytes(2,'big')+width.to_bytes(2,'big')+b'\x01\x01\x11\x00')
    body+=segment(0xDA,b'\x01\x01\x00\x00?\x00')+b'\x00\x00\xff\xd9'
    return 'data:image/jpeg;base64,'+base64.b64encode(body).decode()


PHOTO=make_jpeg()
SITE=dict(lat=0,lng=0,radius=150,place='Office')
SCHEDULE=dict(days=[4],timeIn='08:00',timeOut='17:00',grace=15,mode='On-site',site=SITE)
REMOTE=dict(days=[4],timeIn='08:00',timeOut='17:00',grace=15,mode='Remote',site=None)
THURSDAY_8AM=datetime(2026,10,29,0)  # 08:00 in Manila, a Thursday
ACCOUNT={'id':2,'class_code':'BATCH'}


def calls(cursor,fragment):
    """Arguments of every execute() call whose SQL contains the fragment."""
    return [call.args for call in cursor.execute.call_args_list if fragment in call.args[0]]


class ClockHarness(TestCase):
    def body(self,action='in',**changes):
        values=dict(action=action,photo=PHOTO if action=='in' else '',lat=0,lng=0,accuracy=10)
        if action=='in':
            values['challenge']=module.issue_challenge(ACCOUNT['id'])['token']  # the page gets this when the camera opens
        values.update(changes)
        return module.Clock(**values)

    def clock(self,body,record=None,now=THURSDAY_8AM,placement=True,holiday=None,schedule=SCHEDULE):
        cursor=MagicMock()
        cursor.fetchone.side_effect=[dict(schedule=json.dumps(schedule)) if placement else None,{'now':now},record,holiday]
        with patch.object(module,'database',lambda:database_for(cursor)):
            self.result=module.clock(body,ACCOUNT)
        return cursor

    def refused(self,body,**kwargs):
        cursor=MagicMock()
        record=kwargs.get('record')
        placement=kwargs.get('placement',True)
        cursor.fetchone.side_effect=[dict(schedule=json.dumps(kwargs.get('schedule',SCHEDULE))) if placement else None,
                                     {'now':kwargs.get('now',THURSDAY_8AM)},record,None]
        with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as caught:
            module.clock(body,ACCOUNT)
        return cursor,caught.exception

    @staticmethod
    def stored_payload(cursor):
        return json.loads(calls(cursor,'INSERT INTO student_attendance')[0][1][3])

    @staticmethod
    def attempt(cursor):
        return calls(cursor,'attendance_attempts')[-1][1]

    @staticmethod
    def audit(cursor):
        return calls(cursor,'INSERT INTO audit_events')[-1][1]


class RecordsHarness:
    PLACED=dict(student_id=2,schedule=json.dumps(dict(days=[1,2,3,4,5],timeIn='08:00',timeOut='17:00',grace=15,mode='On-site',site=SITE)),
                confirmed_at=datetime(2026,10,12,1),email='student@example.com',name='Student',class_code='BATCH')

    @classmethod
    def read(cls,placed=None,attendance_rows=(),absences=(),holidays=(),today=datetime(2026,10,16,0),scope='student',args=(2,)):
        cursor=MagicMock()
        cursor.fetchone.return_value={'now':today}
        cursor.fetchall.side_effect=[[cls.PLACED] if placed is None else placed,list(attendance_rows),list(absences),list(holidays)]
        with patch.object(module,'database',lambda:database_for(cursor)):
            cls.cursor=cursor
            return module.records('WHERE r.student_id=%s',args,scope)


class ClockTests(ClockHarness):
    def test_uses_server_time_manila_date_and_zero_coordinates(self):
        cursor=self.clock(self.body())
        args=calls(cursor,'INSERT INTO student_attendance')[0][1]
        self.assertEqual(args[:3],(2,'2026-10-29',datetime(2026,10,29,0)))
        payload=json.loads(args[3])
        self.assertEqual(payload['timeIn'],480)
        self.assertEqual(payload['dist'],0)
        self.assertEqual(payload['status'],'Present')
        self.assertEqual(payload['flags'],[])

    def test_deployment_required_and_duplicate_time_in_rejected(self):
        for placement,record,status in [(False,None,403),(True,{'clock_out':None},409)]:
            _,error=self.refused(self.body(),record=record,placement=placement)
            self.assertEqual(error.status_code,status)

    def test_timeout_requires_open_clock_and_limits_credited_hours(self):
        for record in [None,{'clock_out':datetime(2026,10,29,9)}]:
            _,error=self.refused(self.body('out'),record=record)
            self.assertEqual(error.status_code,409)
        record=dict(clock_in=datetime(2026,10,29,0),clock_out=None,payload=json.dumps(dict(timeIn=480,status='Present')))
        cursor=self.clock(self.body('out'),record,datetime(2026,10,29,12))
        payload=json.loads(calls(cursor,'UPDATE student_attendance')[0][1][1])
        self.assertEqual(payload['hours'],8)
        self.assertEqual(payload['timeOut'],1200)

    def test_timeout_needs_no_photo_and_keeps_original_timein_photo(self):
        body=module.Clock(action='out',lat=0,lng=0,accuracy=10)
        record=dict(clock_in=datetime(2026,10,29,0),clock_out=None,
                    payload=json.dumps(dict(timeIn=480,status='Present',photoIn=PHOTO)))
        cursor=self.clock(body,record,datetime(2026,10,29,9))
        payload=json.loads(calls(cursor,'UPDATE student_attendance')[0][1][1])
        self.assertEqual(payload['photoIn'],PHOTO)
        self.assertNotIn('photoOut',payload)
        self.assertNotIn('flags',payload)  # a missing time-out photo is not a flag
        self.assertEqual(payload['hours'],8)
        self.assertEqual(module.Clock(action='out',photo=PHOTO,lat=0,lng=0,accuracy=10).photo,'')

    def test_late_arrival_after_the_grace_period_is_late_not_flagged(self):
        cursor=self.clock(self.body(),now=datetime(2026,10,29,0,31))  # 08:31, grace ends 08:15
        self.assertEqual(self.stored_payload(cursor)['status'],'Late')
        self.assertEqual(self.attempt(cursor)[2],'accepted')

    def test_unreviewed_flags_and_rejections_do_not_earn_hours_and_review_restores_them(self):
        for review,expected in [('',0),('rejected',0),('accepted',8)]:
            row=dict(payload=json.dumps(dict(status='Flagged',hours=8,date='2026-10-29')),email='student@example.com',
                     name='Student',review=review,note=None,clock_out=datetime(2026,10,29,9))
            rows=RecordsHarness.read(attendance_rows=[row])['attendance']
            self.assertEqual([r['hours'] for r in rows if r['status']=='Flagged'],[expected])


class ClockValidationTests(TestCase):
    def test_invalid_coordinates_accuracy_and_photo_data_are_rejected_by_validation(self):
        for changes in [dict(lat=91),dict(lng=float('nan')),dict(accuracy=-1),dict(photo='data:text/plain;base64,aGk=')]:
            with self.subTest(changes),self.assertRaises(ValidationError):
                module.Clock(**{**dict(action='in',photo=PHOTO,lat=0,lng=0,accuracy=10),**changes})

    def test_a_missing_time_in_photo_is_accepted_by_the_model_and_flagged_by_the_handler(self):
        self.assertEqual(module.Clock(action='in',lat=0,lng=0,accuracy=10).photo,'')

    def test_the_default_geofence_is_150_metres(self):
        self.assertEqual(placements.DEFAULT_GEOFENCE_M,150)


class ScriptedAttemptTests(ClockHarness):
    """Scripted inside / outside / low-accuracy / missing-photo attempts (thesis Table 4, attendance verification)."""

    def test_valid_attempt_inside_the_geofence_is_accepted_and_logged_with_distance_and_accuracy(self):
        cursor=self.clock(self.body(accuracy=12.5))
        self.assertEqual(self.result,{'ok':True,'status':'Present','flags':[]})
        self.assertEqual(self.attempt(cursor),(2,'in','accepted','',0,12.5,150))
        self.assertEqual(self.audit(cursor),('BATCH','student',2,2,'attendance-2026-10-29','Time in recorded','Success'))

    def test_attempt_outside_the_geofence_is_flagged_with_its_reason(self):
        cursor=self.clock(self.body(lat=1,lng=1))
        self.assertEqual(self.result['status'],'Flagged')
        self.assertEqual(self.result['flags'],['out of radius'])
        outcome=self.attempt(cursor)
        self.assertEqual(outcome[2:4],('flagged','out of radius'))
        self.assertGreater(outcome[4],150)  # the measured distance is logged
        self.assertEqual(self.audit(cursor)[5:],('Time in flagged: out of radius','Flagged'))

    def test_the_radius_boundary_is_inclusive(self):
        self.assertEqual((module.distance(0.00135,0,SITE),module.distance(0.00136,0,SITE)),(150,151))
        self.clock(self.body(lat=0.00135))
        self.assertEqual(self.result['status'],'Present')
        self.clock(self.body(lat=0.00136))
        self.assertEqual(self.result['status'],'Flagged')

    def test_low_gps_accuracy_is_flagged_and_the_limit_is_inclusive(self):
        cursor=self.clock(self.body(accuracy=100.1))
        self.assertEqual(self.result['flags'],['low GPS accuracy'])
        self.assertEqual(self.attempt(cursor)[2:4],('flagged','low GPS accuracy'))
        self.clock(self.body(accuracy=100))
        self.assertEqual(self.result['status'],'Present')  # exactly at the limit passes

    def test_the_limit_comes_from_configuration(self):
        with patch.object(module,'ACCURACY_LIMIT_M',50.0):
            self.clock(self.body(accuracy=60))
        self.assertEqual(self.result['flags'],['low GPS accuracy'])

    def test_a_missing_live_photo_is_saved_as_a_flagged_record_not_refused(self):
        cursor=self.clock(self.body(photo=''))
        self.assertEqual(self.result['flags'],['missing photo'])
        self.assertEqual(self.stored_payload(cursor)['photoIn'],'')
        self.assertEqual(self.attempt(cursor)[2:4],('flagged','missing photo'))

    def test_several_failures_are_all_recorded(self):
        cursor=self.clock(self.body(lat=1,lng=1,accuracy=500,photo=''))
        self.assertEqual(self.result['flags'],['out of radius','low GPS accuracy','missing photo'])
        self.assertEqual(self.attempt(cursor)[3],'out of radius, low GPS accuracy, missing photo')

    def test_remote_days_need_no_geofence_or_gps_accuracy(self):
        cursor=self.clock(self.body(lat=45,lng=45,accuracy=5000),schedule=REMOTE)
        self.assertEqual(self.result,{'ok':True,'status':'Present','flags':[]})
        self.assertEqual(self.attempt(cursor)[4:],(None,5000,None))

    def test_a_clock_in_on_a_holiday_goes_to_review_as_outside_schedule(self):
        cursor=self.clock(self.body(),holiday={'name':'Bonifacio Day'})
        self.assertEqual(self.result['status'],'Outside schedule')
        self.assertEqual(self.attempt(cursor)[2:4],('flagged','holiday'))

    def test_a_clock_in_on_an_unscheduled_day_goes_to_review_as_outside_schedule(self):
        cursor=self.clock(self.body(),now=datetime(2026,10,30,0))  # Friday
        self.assertEqual(self.result['status'],'Outside schedule')
        self.assertEqual(self.attempt(cursor)[3],'outside schedule')

    def test_time_out_outside_the_geofence_flags_the_whole_day(self):
        record=dict(clock_in=datetime(2026,10,29,0),clock_out=None,payload=json.dumps(dict(timeIn=480,status='Present',flags=[])))
        cursor=self.clock(self.body('out',lat=1,lng=1),record,datetime(2026,10,29,9))
        self.assertEqual(self.result['status'],'Flagged')
        self.assertEqual(self.result['flags'],['out of radius (time out)'])
        self.assertEqual(self.attempt(cursor)[1:4],('out','flagged','out of radius'))

    def test_time_out_with_low_accuracy_flags_the_day_but_keeps_an_outside_schedule_status(self):
        record=dict(clock_in=datetime(2026,10,29,0),clock_out=None,payload=json.dumps(dict(timeIn=480,status='Outside schedule',flags=[])))
        self.clock(self.body('out',accuracy=900),record,datetime(2026,10,29,9))
        self.assertEqual(self.result['status'],'Outside schedule')
        self.assertEqual(self.result['flags'],['low GPS accuracy (time out)'])

    def test_refused_attempts_are_logged_with_a_reason_even_though_the_request_rolls_back(self):
        cases=[(dict(placement=False),403,'no deployment'),
               (dict(record={'clock_out':None}),409,'already timed in'),
               (dict(record=None,body=self.body('out')),409,'no open time-in'),
               (dict(schedule=dict(SCHEDULE,site=None)),409,'worksite not configured')]
        for options,status,reason in cases:
            with self.subTest(reason):
                body=options.pop('body',self.body())
                cursor,error=self.refused(body,**options)
                self.assertEqual(error.status_code,status)
                logged=self.attempt(cursor)
                self.assertEqual(logged[2:4],('rejected',reason))
                self.assertEqual(calls(cursor,'INSERT INTO audit_events'),[])  # a refusal is not an OJT record change

    def test_a_failure_to_log_never_hides_the_refusal(self):
        cursor=MagicMock()
        cursor.fetchone.side_effect=[None]
        opened=[]

        def database():
            opened.append(1)
            if len(opened)>1:
                raise RuntimeError('database went away')
            return database_for(cursor)

        with patch.object(module,'database',database),self.assertLogs(module.log,level='ERROR') as logged,\
                self.assertRaises(HTTPException) as caught:
            module.clock(self.body(),ACCOUNT)
        self.assertEqual(caught.exception.status_code,403)
        self.assertIn('Could not log a refused attendance attempt',logged.output[0])

    def test_check_flags_directly(self):
        flags=module.check_flags
        self.assertEqual(flags(0,10,150,True,False),[])
        self.assertEqual(flags(151,10,150,True,False),['out of radius'])
        self.assertEqual(flags(0,101,150,True,False,limit=100),['low GPS accuracy'])
        self.assertEqual(flags(None,5000,None,True,True),[])
        self.assertEqual(flags(None,5000,None,False,True),['missing photo'])

    def test_the_accuracy_limit_setting_ignores_bad_values(self):
        for bad in (None,'','abc','-5','0','nan','inf'):
            with self.subTest(bad=bad):
                self.assertEqual(module.parse_accuracy_limit(bad),module.DEFAULT_ACCURACY_LIMIT_M)
        self.assertEqual(module.parse_accuracy_limit('75.5'),75.5)


class CameraEvidenceTests(ClockHarness):
    """Camera-only photos: no stored-photo shortcut, and a fresh signed capture code that the page prints onto the photo."""

    def test_only_camera_sized_jpegs_are_accepted(self):
        module.Clock(action='in',photo=make_jpeg(480,360),lat=0,lng=0,accuracy=10)
        module.Clock(action='in',photo=make_jpeg(480,853),lat=0,lng=0,accuracy=10)  # a portrait phone capture
        png='data:image/png;base64,'+base64.b64encode(b'\x89PNG\r\n\x1a\nxxxx').decode()
        webp='data:image/webp;base64,'+base64.b64encode(b'RIFFxxxxWEBP').decode()
        truncated=PHOTO[:len('data:image/jpeg;base64,')+24]  # cut off before the frame header that holds the size
        bad={'a large stored photo':make_jpeg(4032,3024),'too wide':make_jpeg(481,360),'too tall':make_jpeg(480,961),
             'zero size':make_jpeg(0,0),'a PNG':png,'a WebP':webp,'a cut-off JPEG':truncated,
             'not base64':'data:image/jpeg;base64,!!!','not an image':'data:text/plain;base64,aGk='}
        for name,photo in bad.items():
            with self.subTest(name),self.assertRaises(ValidationError):
                module.Clock(action='in',photo=photo,lat=0,lng=0,accuracy=10)

    def test_jpeg_facts_reads_size_and_camera_metadata(self):
        self.assertEqual(module.jpeg_facts(make_jpeg(480,360)),(480,360,False))
        self.assertEqual(module.jpeg_facts(make_jpeg(320,240,exif=True)),(320,240,True))
        self.assertIsNone(module.jpeg_facts('data:image/jpeg;base64,'+base64.b64encode(b'not a jpeg').decode()))

    def test_challenges_are_signed_student_specific_and_expire(self):
        issued=module.issue_challenge(2,now=1000)
        self.assertRegex(issued['code'],r'^\d{4}$')
        self.assertEqual(issued['expiresIn'],module.CAPTURE_TTL_SECONDS)
        self.assertEqual(module.verify_challenge(issued['token'],2,now=1000),issued['code'])
        self.assertEqual(module.verify_challenge(issued['token'],2,now=1000+module.CAPTURE_TTL_SECONDS),issued['code'])
        self.assertIsNone(module.verify_challenge(issued['token'],2,now=1001+module.CAPTURE_TTL_SECONDS))  # too late
        self.assertIsNone(module.verify_challenge(issued['token'],3,now=1000))  # someone else's code
        owner,expires,code,signature=issued['token'].split('.')
        for forged in (f'{owner}.{expires}.{int(code)+1:04d}.{signature}',f'{owner}.99999999999.{code}.{signature}',
                       f'{owner}.{expires}.{code}.{"0"*32}','garbage','','a.b.c'):
            with self.subTest(forged):
                self.assertIsNone(module.verify_challenge(forged,2,now=1000))

    def test_challenge_endpoint_hands_out_a_working_code_for_the_signed_in_student(self):
        result=module.challenge({'id':2})
        self.assertEqual(module.verify_challenge(result['token'],2),result['code'])
        self.assertNotEqual(module.challenge({'id':2})['token'],result['token'])

    def test_a_photo_without_a_valid_capture_code_is_refused_and_logged(self):
        other=module.issue_challenge(99)['token']
        expired=module.issue_challenge(2,now=1)['token']
        for name,token in {'no code':'','another student':other,'expired':expired,'forged':'2.9999999999.1234.'+'0'*32}.items():
            with self.subTest(name):
                cursor,error=self.refused(self.body(challenge=token))
                self.assertEqual(error.status_code,400)
                self.assertEqual(self.attempt(cursor)[2:4],('rejected','photo not live'))
                self.assertEqual(calls(cursor,'INSERT INTO student_attendance'),[])
                self.assertEqual(calls(cursor,'INSERT INTO audit_events'),[])

    def test_the_capture_code_is_saved_with_the_record_for_the_coordinator_to_compare(self):
        issued=module.issue_challenge(2)
        cursor=self.clock(self.body(challenge=issued['token']))
        self.assertEqual(self.stored_payload(cursor)['captureCode'],issued['code'])
        self.assertEqual(self.result['flags'],[])

    def test_camera_metadata_flags_the_day_for_review_but_does_not_block_it(self):
        cursor=self.clock(self.body(photo=make_jpeg(480,360,exif=True)))
        self.assertEqual(self.result['status'],'Flagged')
        self.assertEqual(self.result['flags'],['photo has camera metadata'])
        self.assertEqual(self.attempt(cursor)[2:4],('flagged','photo has camera metadata'))

    def test_no_photo_needs_no_capture_code_and_time_out_ignores_both(self):
        self.clock(self.body(photo='',challenge=''))
        self.assertEqual(self.result['flags'],['missing photo'])
        record=dict(clock_in=datetime(2026,10,29,0),clock_out=None,payload=json.dumps(dict(timeIn=480,status='Present',flags=[])))
        self.clock(self.body('out',photo=PHOTO,challenge='junk'),record,datetime(2026,10,29,9))
        self.assertEqual(self.result['flags'],[])

    def test_a_duplicate_time_in_is_refused_for_being_a_duplicate_before_its_photo_is_questioned(self):
        _,error=self.refused(self.body(challenge=''),record={'clock_out':None})
        self.assertEqual(error.status_code,409)


class MissingWorkdayTests(TestCase):
    WEEK=dict(days=[1,2,3,4,5])

    def test_only_scheduled_days_between_deployment_and_today_count(self):
        # Deployed Mon 12 Oct, today Fri 16 Oct: Tue, Wed and Thu are past scheduled days; deployment day and today are not.
        found=module.missing_workdays(self.WEEK,date(2026,10,12),date(2026,10,16),set(),set(),set())
        self.assertEqual(found,['2026-10-13','2026-10-14','2026-10-15'])

    def test_holidays_clock_ins_and_known_absences_are_skipped(self):
        found=module.missing_workdays(self.WEEK,date(2026,10,12),date(2026,10,17),{'2026-10-14'},{'2026-10-15'},{'2026-10-13'})
        self.assertEqual(found,['2026-10-16'])

    def test_weekends_are_skipped_unless_scheduled(self):
        self.assertEqual(module.missing_workdays(self.WEEK,date(2026,10,16),date(2026,10,20),set(),set(),set()),['2026-10-19'])
        saturday=module.missing_workdays(dict(days=[6]),date(2026,10,16),date(2026,10,20),set(),set(),set())
        self.assertEqual(saturday,['2026-10-17'])

    def test_nothing_before_the_day_after_deployment_and_a_bounded_lookback(self):
        self.assertEqual(module.missing_workdays(self.WEEK,date(2026,10,16),date(2026,10,16),set(),set(),set()),[])
        found=module.missing_workdays(self.WEEK,date(2020,1,1),date(2026,10,16),set(),set(),set())
        self.assertLessEqual(len(found),module.MAX_ABSENCE_LOOKBACK_DAYS)


class AbsenceTests(TestCase):
    def read(self,**kwargs):
        result=RecordsHarness.read(**kwargs)['attendance']
        self.cursor=RecordsHarness.cursor
        return result

    def test_scheduled_workdays_without_a_clock_in_are_recorded_as_absent(self):
        rows=self.read()
        self.assertEqual([(r['date'],r['status'],r['hours']) for r in rows],
                         [('2026-10-15','Absent',0),('2026-10-14','Absent',0),('2026-10-13','Absent',0)])
        inserted=self.cursor.executemany.call_args.args[1]
        self.assertEqual(sorted(inserted),[(2,'2026-10-13'),(2,'2026-10-14'),(2,'2026-10-15')])
        self.assertIn('INSERT IGNORE INTO attendance_absences',self.cursor.executemany.call_args.args[0])

    def test_holidays_are_not_absences_and_show_up_as_holiday_rows(self):
        rows=self.read(holidays=[dict(class_code='BATCH',holiday_date=date(2026,10,14),name='Class suspension')])
        by_date={r['date']:r for r in rows}
        self.assertEqual(by_date['2026-10-14']['status'],'Holiday')
        self.assertEqual(by_date['2026-10-14']['place'],'Class suspension')
        self.assertEqual(sorted(i[1] for i in self.cursor.executemany.call_args.args[1]),['2026-10-13','2026-10-15'])

    def test_a_holiday_on_a_weekend_the_student_does_not_work_is_not_listed(self):
        rows=self.read(holidays=[dict(class_code='BATCH',holiday_date=date(2026,10,10),name='Saturday event')])
        self.assertNotIn('2026-10-10',[r['date'] for r in rows])

    def test_days_the_student_clocked_in_are_not_absences(self):
        row=dict(payload=json.dumps(dict(status='Present',hours=8,date='2026-10-14')),email='student@example.com',name='Student',
                 review='',note=None,clock_out=datetime(2026,10,14,9))
        rows=self.read(attendance_rows=[row])
        self.assertEqual(sorted(r['date'] for r in rows if r['status']=='Absent'),['2026-10-13','2026-10-15'])

    def test_reading_twice_does_not_duplicate_absences(self):
        stored=[dict(student_id=2,work_date=date(2026,10,d),review='',note=None) for d in (13,14,15)]
        rows=self.read(absences=stored)
        self.assertEqual(len([r for r in rows if r['status']=='Absent']),3)
        self.cursor.executemany.assert_not_called()

    def test_excused_absences_keep_their_review_and_the_students_explanation(self):
        stored=[dict(student_id=2,work_date=date(2026,10,14),review='excused',
                     note=json.dumps(dict(type='Sick',reason='Fever',at='2026-10-14')))]
        rows=self.read(absences=stored)
        excused=next(r for r in rows if r['date']=='2026-10-14')
        self.assertEqual((excused['review'],excused['note']['type']),('excused','Sick'))

    def test_a_stored_absence_on_a_holiday_is_hidden(self):
        stored=[dict(student_id=2,work_date=date(2026,10,14),review='',note=None)]
        rows=self.read(absences=stored,holidays=[dict(class_code='BATCH',holiday_date=date(2026,10,14),name='Suspension')])
        self.assertEqual([r['status'] for r in rows if r['date']=='2026-10-14'],['Holiday'])

    def test_no_new_absences_once_the_required_hours_are_credited(self):
        row=dict(payload=json.dumps(dict(status='Present',hours=486,date='2026-10-13')),email='student@example.com',name='Student',
                 review='',note=None,clock_out=datetime(2026,10,13,9))
        rows=self.read(attendance_rows=[row])
        self.assertEqual([r for r in rows if r['status']=='Absent'],[])
        self.cursor.executemany.assert_not_called()

    def test_unreviewed_flagged_hours_do_not_count_toward_the_requirement(self):
        row=dict(payload=json.dumps(dict(status='Flagged',hours=486,date='2026-10-13')),email='student@example.com',name='Student',
                 review='',note=None,clock_out=datetime(2026,10,13,9))
        rows=self.read(attendance_rows=[row])
        self.assertEqual(len([r for r in rows if r['status']=='Absent']),2)  # 14th and 15th: the 13th has a record

    def test_students_not_yet_deployed_get_no_absences(self):
        self.assertEqual(self.read(placed=[]),[])

    def test_scope_queries_follow_the_role(self):
        for scope,fragment in (('student','p.student_id=%s'),('coordinator','coordinator_batches'),('partner','a.company_id=%s')):
            with self.subTest(scope):
                RecordsHarness.read(scope=scope,args=(7,))
                first=RecordsHarness.cursor.execute.call_args_list[0].args
                self.assertIn(fragment,first[0])
                self.assertEqual(first[1],(7,))


class ReviewTests(TestCase):
    FLAGGED=dict(student_id=2,class_code='BATCH',payload=json.dumps(dict(status='Flagged')))
    ABSENCE=dict(student_id=2,class_code='BATCH')

    def review(self,decision,first,second=None,coordinator=8):
        cursor=MagicMock()
        cursor.fetchone.side_effect=[first,second]
        with patch.object(module,'database',lambda:database_for(cursor)):
            module.review(module.Review(email='Student@Example.com',date='2026-10-14',decision=decision),{'id':coordinator})
        return cursor

    def failing(self,decision,first,second=None):
        with self.assertRaises(HTTPException) as caught:
            self.review(decision,first,second)
        return caught.exception.status_code

    def test_other_coordinator_cannot_review(self):
        cursor=MagicMock()
        cursor.fetchone.return_value=None
        with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as result:
            module.review(module.Review(email='student@example.com',date='2026-10-29',decision='accepted'),{'id':4})
        self.assertEqual(result.exception.status_code,404)
        self.assertEqual(cursor.execute.call_args.args[1],('student@example.com','2026-10-29',4))
        self.assertEqual(calls(cursor,'audit_events'),[])

    def test_accepting_a_flagged_clock_in_updates_it_and_is_audited(self):
        cursor=self.review('accepted',self.FLAGGED)
        self.assertEqual(calls(cursor,'UPDATE student_attendance')[0][1],('accepted',8,2,'2026-10-14'))
        self.assertEqual(calls(cursor,'audit_events')[0][1],('BATCH','coordinator',8,2,'attendance-2026-10-14','Accepted flagged clock-in','Verified'))

    def test_rejecting_is_audited_as_flagged(self):
        cursor=self.review('rejected',self.FLAGGED)
        self.assertEqual(calls(cursor,'audit_events')[0][1][5:],('Rejected flagged clock-in','Flagged'))

    def test_an_absence_can_be_excused_or_kept_and_each_is_audited(self):
        for decision,action,status in (('excused','Excused the absence','Verified'),('unexcused','Kept the absence','Flagged')):
            with self.subTest(decision):
                cursor=self.review(decision,None,self.ABSENCE)
                self.assertEqual(calls(cursor,'UPDATE attendance_absences')[0][1],(decision,8,2,'2026-10-14'))
                self.assertEqual(calls(cursor,'audit_events')[0][1][5:],(action,status))

    def test_undo_clears_the_review_and_is_audited(self):
        cursor=self.review('',None,self.ABSENCE)
        self.assertEqual(calls(cursor,'UPDATE attendance_absences')[0][1],('',8,2,'2026-10-14'))
        self.assertEqual(calls(cursor,'audit_events')[0][1][5:],('Cleared the attendance review','Success'))

    def test_decisions_must_match_the_kind_of_record(self):
        self.assertEqual(self.failing('excused',self.FLAGGED),409)       # a clock-in cannot be excused
        self.assertEqual(self.failing('accepted',None,self.ABSENCE),409)  # an absence cannot be accepted
        self.assertEqual(self.failing('rejected',None,self.ABSENCE),409)

    def test_a_clean_clock_in_does_not_need_review(self):
        self.assertEqual(self.failing('accepted',dict(student_id=2,class_code='BATCH',payload=json.dumps(dict(status='Present')))),409)

    def test_unknown_decisions_are_invalid(self):
        with self.assertRaises(ValidationError):
            module.Review(email='a@b.co',date='2026-10-14',decision='approved')


class ExplanationTests(TestCase):
    def explain(self,first,second=None):
        cursor=MagicMock()
        cursor.fetchone.side_effect=[first,second]
        with patch.object(module,'database',lambda:database_for(cursor)):
            module.explain(module.Explanation(date='2026-10-14',type='Sick',reason='Fever and rest day'),ACCOUNT)
        return cursor

    def test_reviewed_explanation_cannot_be_changed(self):
        cursor=MagicMock()
        cursor.fetchone.return_value={'review':'accepted'}
        with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as result:
            module.explain(module.Explanation(date='2026-10-29',type='Other',reason='GPS issue'),ACCOUNT)
        self.assertEqual(result.exception.status_code,409)

    def test_a_flagged_clock_in_can_be_explained(self):
        cursor=self.explain({'review':''})
        self.assertEqual(len(calls(cursor,'UPDATE student_attendance')),1)
        self.assertEqual(calls(cursor,'audit_events')[0][1][5:],('Explanation sent','Success'))

    def test_an_absence_can_be_explained(self):
        cursor=self.explain(None,{'review':''})
        update=calls(cursor,'UPDATE attendance_absences')[0]
        self.assertEqual(json.loads(update[1][0]),dict(type='Sick',reason='Fever and rest day',at='2026-10-14'))
        self.assertEqual(update[1][1:],(2,'2026-10-14'))
        self.assertEqual(calls(cursor,'audit_events')[0][1][3:5],(2,'attendance-2026-10-14'))

    def test_a_reviewed_absence_cannot_be_explained_again(self):
        with self.assertRaises(HTTPException) as caught:
            self.explain(None,{'review':'excused'})
        self.assertEqual(caught.exception.status_code,409)

    def test_a_day_with_no_record_is_not_found(self):
        with self.assertRaises(HTTPException) as caught:
            self.explain(None,None)
        self.assertEqual(caught.exception.status_code,404)
