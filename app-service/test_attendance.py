"""Clock transitions, server time, worksite checks and attendance access."""
import base64
import json
from datetime import datetime
from unittest import TestCase
from unittest.mock import MagicMock,patch
from fastapi import HTTPException
from pydantic import ValidationError
import attendance as module
from test_coordinator_auth import database_for

PHOTO='data:image/jpeg;base64,'+base64.b64encode(b'\xff\xd8\xffexample').decode()
SCHEDULE=dict(days=[4],timeIn='08:00',timeOut='17:00',grace=15,mode='On-site',site=dict(lat=0,lng=0,radius=150,place='Office'))


class AttendanceTests(TestCase):
    def body(self,action='in',**changes):
        return module.Clock(**dict(action=action,photo=PHOTO,lat=0,lng=0,accuracy=10,**changes))

    def clock(self,body,record=None,now=datetime(2026,10,29,0),placement=True):
        cursor=MagicMock()
        cursor.fetchone.side_effect=[dict(schedule=json.dumps(SCHEDULE)) if placement else None,{'now':now},record]
        with patch.object(module,'database',lambda:database_for(cursor)):
            module.clock(body,{'id':2})
        return cursor

    def test_uses_server_time_manila_date_and_zero_coordinates(self):
        cursor=self.clock(self.body())
        args=cursor.execute.call_args.args[1]
        self.assertEqual(args[:3],(2,'2026-10-29',datetime(2026,10,29,0)))
        payload=json.loads(args[3])
        self.assertEqual(payload['timeIn'],480)
        self.assertEqual(payload['dist'],0)
        self.assertEqual(payload['status'],'Present')

    def test_deployment_required_and_duplicate_time_in_rejected(self):
        for placement,record,status in [(False,None,403),(True,{'clock_out':None},409)]:
            with self.assertRaises(HTTPException) as result:
                self.clock(self.body(),record=record,placement=placement)
            self.assertEqual(result.exception.status_code,status)

    def test_timeout_requires_open_clock_and_limits_credited_hours(self):
        for record in [None,{'clock_out':datetime(2026,10,29,9)}]:
            with self.assertRaises(HTTPException) as result:
                self.clock(self.body('out'),record)
            self.assertEqual(result.exception.status_code,409)
        record=dict(clock_in=datetime(2026,10,29,0),clock_out=None,payload=json.dumps(dict(timeIn=480,status='Present')))
        cursor=self.clock(self.body('out'),record,datetime(2026,10,29,12))
        payload=json.loads(cursor.execute.call_args.args[1][1])
        self.assertEqual(payload['hours'],8)
        self.assertEqual(payload['timeOut'],1200)

    def test_outside_geofence_is_flagged(self):
        body=module.Clock(action='in',photo=PHOTO,lat=1,lng=1,accuracy=10)
        cursor=self.clock(body)
        self.assertEqual(json.loads(cursor.execute.call_args.args[1][3])['status'],'Flagged')

    def test_missing_photo_and_invalid_coordinates_rejected(self):
        for changes in [dict(photo=''),dict(lat=91),dict(lng=float('nan')),dict(accuracy=-1)]:
            with self.assertRaises(ValidationError):
                module.Clock(**{**dict(action='in',photo=PHOTO,lat=0,lng=0,accuracy=10),**changes})

    def test_unreviewed_flags_and_rejections_do_not_earn_hours(self):
        for review,expected in [('',0),('rejected',0),('accepted',8)]:
            cursor=MagicMock()
            cursor.fetchall.return_value=[dict(payload=json.dumps(dict(status='Flagged',hours=8)),email='student@example.com',name='Student',review=review,note=None,clock_out=datetime(2026,10,29,9))]
            with patch.object(module,'database',lambda:database_for(cursor)):
                rows=module.mine({'id':2})['attendance']
            self.assertEqual(rows[0]['hours'],expected)
            self.assertEqual(cursor.execute.call_args.args[1],(2,))

    def test_other_coordinator_cannot_review(self):
        cursor=MagicMock()
        cursor.fetchone.return_value=None
        with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as result:
            module.review(module.Review(email='student@example.com',date='2026-10-29',decision='accepted'),{'id':4})
        self.assertEqual(result.exception.status_code,404)
        self.assertEqual(cursor.execute.call_args.args[1],('student@example.com','2026-10-29',4))

    def test_reviewed_explanation_cannot_be_changed(self):
        cursor=MagicMock()
        cursor.fetchone.return_value={'review':'accepted'}
        with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as result:
            module.explain(module.Explanation(date='2026-10-29',type='Other',reason='GPS issue'),{'id':2})
        self.assertEqual(result.exception.status_code,409)
