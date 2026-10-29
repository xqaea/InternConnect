"""Report submission, revision, approval and grade boundaries."""
import json
from datetime import datetime
from unittest import TestCase
from unittest.mock import MagicMock,patch
from fastapi import HTTPException
from pydantic import ValidationError
import reports as module
from test_coordinator_auth import database_for


class ReportTests(TestCase):
    def submit(self,status=None,task_status='open'):
        cursor=MagicMock()
        cursor.fetchone.side_effect=[{'payload':{'status':task_status}}, {'status':status} if status else None]
        with patch.object(module,'database',lambda:database_for(cursor)):
            module.submit('task-test',module.Submission(raw='Tested the API.'),{'id':2,'class_code':'OWNED'})
        return cursor

    def decide(self,**changes):
        cursor=MagicMock()
        cursor.fetchone.side_effect=[{'payload':{'maxPoints':100}}, {'student_id':2,'version':1,'status':'Pending Review'}]
        with patch.object(module,'database',lambda:database_for(cursor)):
            module.decide('task-test',module.Decision(**{**dict(email='student@example.com',version=1),**changes}),{'id':4})
        return cursor

    def test_submit_is_student_scoped_and_bullet_is_server_derived(self):
        cursor=self.submit()
        self.assertEqual(cursor.execute.call_args_list[0].args[1],('task-test','OWNED'))
        self.assertEqual(cursor.execute.call_args.args[1],('task-test',2,'Tested the API.','Tested the API.'))

    def test_only_revision_requests_allow_resubmission(self):
        self.submit('Needs Revision')
        for status in ('Pending Review','Verified','Rejected'):
            with self.assertRaises(HTTPException) as result:
                self.submit(status)
            self.assertEqual(result.exception.status_code,409)
        with self.assertRaises(HTTPException) as result:
            self.submit(task_status='closed')
        self.assertEqual(result.exception.status_code,409)

    def test_review_and_grade_are_owned_and_bounded(self):
        cursor=self.decide(status='Verified',score=100)
        self.assertEqual(cursor.execute.call_args_list[0].args[1],('task-test',4))
        self.assertEqual(cursor.execute.call_args.args[1],(100,'','task-test',2))
        with self.assertRaises(HTTPException) as result:
            self.decide(score=101)
        self.assertEqual(result.exception.status_code,400)

    def test_old_versions_and_missing_revision_feedback_are_rejected(self):
        for changes,expected in [(dict(version=2,status='Verified'),409),(dict(status='Needs Revision'),400)]:
            with self.assertRaises(HTTPException) as result:
                self.decide(**changes)
            self.assertEqual(result.exception.status_code,expected)

    def test_foreign_coordinator_cannot_review(self):
        cursor=MagicMock()
        cursor.fetchone.return_value=None
        with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as result:
            module.decide('other-task',module.Decision(email='student@example.com',version=1,status='Verified'),{'id':4})
        self.assertEqual(result.exception.status_code,404)
        self.assertEqual(cursor.execute.call_count,1)

    def test_whitespace_and_invalid_scores_rejected(self):
        with self.assertRaises(ValidationError):
            module.Submission(raw='   ')
        with self.assertRaises(ValidationError):
            module.Decision(email='student@example.com',version=1,score=float('nan'))

    def test_read_includes_feedback_grades_and_late_state(self):
        cursor=MagicMock()
        cursor.fetchall.return_value=[dict(task_id='task-test',task_payload=json.dumps(dict(title='Report',dueDate='2026-10-29',dueTime='08:00')),
            submitted_at=datetime(2026,10,29,1),email='student@example.com',name='Student',raw='Report',bullet='Report.',company='Company',status='Verified',feedback='Approved',score=90,grade_feedback='Good',version=1)]
        with patch.object(module,'database',lambda:database_for(cursor)):
            result=module.mine({'id':2})['reports'][0]
        self.assertTrue(result['late'])
        self.assertEqual(result['score'],90)
        self.assertEqual(result['status'],'Verified')
        self.assertEqual(cursor.execute.call_args.args[1],(2,))
