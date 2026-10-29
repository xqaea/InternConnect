"""Readiness must cover accounts as well as postings without reading user data."""
from contextlib import contextmanager
import unittest
from unittest.mock import MagicMock, patch
import mysql.connector
import main


class HealthTests(unittest.TestCase):
    def check(self, cursor):
        connection = MagicMock()
        connection.cursor.return_value = cursor

        @contextmanager
        def database():
            yield connection

        with patch.object(main, 'database', database):
            return main.health()

    def test_checks_account_and_workflow_tables_without_reading_records(self):
        cursor = MagicMock()
        self.assertEqual(self.check(cursor), {'status': 'ok', 'database': 'mysql'})
        queries = [call.args[0] for call in cursor.execute.call_args_list]
        for table in ('companies', 'partner_accounts', 'posting_sessions', 'job_postings',
                      'student_batches', 'student_accounts', 'student_sessions',
                      'coordinator_accounts', 'coordinator_batches', 'coordinator_sessions',
                      'login_attempts', 'partner_profiles', 'student_resumes', 'internship_applications', 'official_placements', 'student_attendance', 'classwork_tasks', 'narrative_reports'):
            self.assertIn(f'SELECT * FROM {table} LIMIT 0', queries)

    def test_missing_account_table_cannot_report_healthy(self):
        cursor = MagicMock()

        def execute(sql):
            if 'coordinator_accounts' in sql:
                raise mysql.connector.ProgrammingError('Missing table', errno=1146)

        cursor.execute.side_effect = execute
        with self.assertRaises(mysql.connector.ProgrammingError):
            self.check(cursor)


if __name__ == '__main__':
    unittest.main()
