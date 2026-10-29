"""Application ownership, eligibility and immutable submission snapshots."""
import json
from unittest import TestCase
from unittest.mock import MagicMock, patch
from datetime import datetime
from fastapi import HTTPException
import applications as apps
from test_student_auth import account
from test_coordinator_auth import database_for


def posting(**changes):
    return {**dict(id='post-test', company_id=3, status='open',
                payload={'title':'Test Internship','type':'Internship · Onsite'}), **changes}


class ApplicationTests(TestCase):
    def run_apply(self, rows):
        cursor = MagicMock()
        cursor.fetchone.side_effect = rows
        with patch.object(apps, 'database', lambda: database_for(cursor)):
            result = apps.apply(apps.Apply(postingId='post-test'), account())
        return cursor, result

    def test_submission_snapshots_database_resume_and_authenticated_student(self):
        resume = {'hard':['Python'], 'savedAt':'2026-10-29', 'fields':{'ed-name':'Resume Name'}}
        cursor, result = self.run_apply([{'id':2}, posting(), None, {'payload':json.dumps(resume)}])
        self.assertTrue(result['ok'])
        args = cursor.execute.call_args.args[1]
        self.assertEqual(args[:3], (2,'post-test',3))
        snapshot = json.loads(args[-1])
        self.assertEqual(snapshot['hard'], ['Python'])
        self.assertEqual(snapshot['profile']['email'], account()['email'])
        self.assertNotIn('password_hash', snapshot['profile'])
        self.assertEqual(cursor.execute.call_args_list[1].args[1], ('post-test',account()['class_code']))

    def test_rejects_closed_missing_and_expired_postings(self):
        for record in (None, {**posting(), 'status':'closed'}, posting(payload={'title':'Expired','type':'Internship · Onsite','deadlineISO':'2000-01-01'})):
            with self.assertRaises(HTTPException) as result:
                self.run_apply([{'id':2}, record])
            self.assertEqual(result.exception.status_code,400)

    def test_requires_saved_resume_and_only_one_active_internship(self):
        for last, expected in (({'id':9},409),(None,400)):
            with self.assertRaises(HTTPException) as result:
                self.run_apply([{'id':2},posting(),last,None])
            self.assertEqual(result.exception.status_code,expected)

    def test_partner_cannot_change_another_company_application(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = None
        with patch.object(apps, 'database', lambda: database_for(cursor)), self.assertRaises(HTTPException) as result:
            apps.decide(9,apps.Status(status='Accepted'),{'company_id':3})
        self.assertEqual(result.exception.status_code,404)
        self.assertEqual(cursor.execute.call_count,1)
        self.assertEqual(cursor.execute.call_args.args[1],(9,3))

    def test_status_update_never_changes_snapshot_and_final_decisions_cannot_reopen(self):
        cursor=MagicMock()
        cursor.fetchone.return_value={'id':9,'status':'Pending'}
        with patch.object(apps,'database',lambda:database_for(cursor)):
            apps.decide(9,apps.Status(status='Accepted'),{'company_id':3})
        self.assertNotIn('resume_snapshot',cursor.execute.call_args.args[0])
        cursor.fetchone.return_value={'id':9,'status':'Not Selected'}
        with patch.object(apps,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as result:
            apps.decide(9,apps.Status(status='Accepted'),{'company_id':3})
        self.assertEqual(result.exception.status_code,409)

    def test_lists_are_scoped_to_student_company_and_coordinator(self):
        for operation,identity,expected in ((apps.mine,account(),2),
                (apps.company_applications,{'company_id':3},3),(apps.batch_applications,{'id':4},4)):
            cursor=MagicMock()
            cursor.fetchall.return_value=[]
            with patch.object(apps,'database',lambda:database_for(cursor)):
                self.assertEqual(operation(identity),{'applications':[]})
            self.assertEqual(cursor.execute.call_args.args[1],(expected,))

    def test_response_uses_submission_snapshot(self):
        record=dict(id=9,posting_id='post-test',title='Intern',company='Company',created_at=datetime(2026,10,29),
            status='Pending',internship=1,email='student@example.com',name='Student',class_code='TEST',program='BSCS',
            resume_snapshot=json.dumps({'hard':['Python']}))
        self.assertEqual(apps.public_application(record)['resume']['hard'],['Python'])
