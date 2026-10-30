"""Authoritative feed scoping and durable account-specific read receipts."""
from datetime import datetime
from unittest import TestCase
from unittest.mock import MagicMock,patch
from fastapi import HTTPException
import notifications as module
from security import token_hash
from test_coordinator_auth import database_for


class NotificationTests(TestCase):
    def test_empty_feeds_have_no_synthetic_notifications(self):
        for role,account,count in [('student',{'id':2,'class_code':'OWNED'},5),('coordinator',{'id':4},4),('partner',{'id':5,'company_id':3},1)]:
            cursor=MagicMock()
            cursor.fetchall.return_value=[]
            with patch.object(module,'database',lambda:database_for(cursor)):
                self.assertEqual(module.feed(role,account),{'notifications':[]})
            self.assertEqual(cursor.execute.call_count,count)

    def test_partner_feed_and_receipts_are_company_and_account_scoped(self):
        cursor=MagicMock()
        cursor.fetchall.side_effect=[[dict(id=7,posting_id='post-test',title='Intern',created_at=datetime(2026,10,29),name='Student')],[{'event_id':token_hash('applicant:7')}]]
        with patch.object(module,'database',lambda:database_for(cursor)):
            items=module.feed('partner',{'id':5,'company_id':3})['notifications']
        self.assertFalse(items[0]['unread'])
        self.assertEqual(cursor.execute.call_args_list[0].args[1],(3,))
        self.assertEqual(cursor.execute.call_args.args[1][:2],('partner',5))

    def test_new_report_revision_generates_a_distinct_notification(self):
        ids=[]
        for version in (1,2):
            cursor=MagicMock()
            cursor.fetchall.side_effect=[[dict(task_id='task-test',student_id=2,version=version,submitted_at=datetime(2026,10,29),name='Student',class_code='OWNED')],[],[],[],[]]
            with patch.object(module,'database',lambda:database_for(cursor)):
                items=module.feed('coordinator',{'id':4})['notifications']
            ids.append(items[0]['id'])
            self.assertTrue(items[0]['unread'])
            self.assertEqual(items[0]['classCode'],'OWNED')
            self.assertEqual(cursor.execute.call_args_list[0].args[1],(4,))
        self.assertNotEqual(ids[0],ids[1])

    def test_read_receipts_are_idempotent_and_use_authenticated_identity(self):
        cursor=MagicMock()
        identity=token_hash('test')
        with patch.object(module,'database',lambda:database_for(cursor)):
            module.mark('student',{'id':2},module.Seen(ids=[identity,identity]))
        self.assertEqual(cursor.execute.call_count,1)
        self.assertEqual(cursor.execute.call_args.args[1],('student',2,identity))

    def test_invalid_read_identifiers_are_rejected(self):
        with self.assertRaises(HTTPException) as result:
            module.mark('student',{'id':2},module.Seen(ids=['not-an-id']))
        self.assertEqual(result.exception.status_code,422)

    def test_grade_and_review_notifications_come_from_server_report(self):
        cursor=MagicMock()
        cursor.fetchall.side_effect=[[],[dict(task_id='task-test',version=1,status='Verified',score=90,grade_feedback='Good',payload={'title':'Report','maxPoints':100},reviewed_at=datetime(2026,10,29),submitted_at=datetime(2026,10,28))],[],[],[],[]]
        with patch.object(module,'database',lambda:database_for(cursor)):
            items=module.feed('student',{'id':2,'class_code':'OWNED'})['notifications']
        self.assertEqual({item['title'] for item in items},{'Report reviewed','Report graded'})
        self.assertTrue(all(item['unread'] for item in items))
