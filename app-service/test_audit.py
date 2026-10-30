"""Audit history uses server identities and current batch ownership."""
from datetime import datetime
from unittest import TestCase
from unittest.mock import MagicMock, patch
import audit
from test_coordinator_auth import database_for


class AuditTests(TestCase):
    def test_feed_is_owned_batch_scoped_and_chronological_with_display_timezone(self):
        cursor=MagicMock()
        cursor.fetchall.return_value=[dict(id=5,actor_role='student',actor_id=2,subject_id=2,
            resource_id='task',action='Report submitted',status='Success',created_at=datetime(2026,10,29,20))]
        with patch.object(audit,'database',lambda:database_for(cursor)):
            row=audit.activity('OWN',{'id':8})['entries'][0]
        sql,args=cursor.execute.call_args.args
        self.assertEqual(args,('OWN',8))
        self.assertIn('EXISTS',sql)
        self.assertIn('ORDER BY e.id DESC LIMIT 500',sql)
        self.assertEqual(row['at'],'2026-10-30 04:00:00')
        self.assertEqual(row['user'],'Student #2')

    def test_record_uses_workflow_cursor_without_separate_commit_or_raw_report(self):
        cursor=MagicMock()
        audit.record_report(cursor,'task','student',2,2,'Report submitted')
        self.assertEqual(cursor.execute.call_args.args[1],('student',2,2,'Report submitted','Success','task'))
        self.assertIn('FROM classwork_tasks WHERE id=%s',cursor.execute.call_args.args[0])
