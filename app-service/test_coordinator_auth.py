"""Coordinator account, lockout and ownership regression checks without live data."""
from contextlib import contextmanager
from datetime import timedelta
import unittest
from unittest.mock import MagicMock, patch
import mysql.connector
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
import coordinator_auth as auth
import main
from security import verify_password
from test_login_lockout import Store


def account():
    return dict(id=4, email='coordinator@example.com', name='Test Coordinator', password_hash='hashed',
                class_code='OWNED', program='BS Computer Science', school='Test School', theme='sky',
                avatar='', school_email='coordinator@example.com', personal_email='', status='active')


@contextmanager
def database_for(cursor):
    connection = MagicMock()
    connection.cursor.return_value = cursor
    yield connection


class CoordinatorStore(Store):
    def execute(self, sql, args=()):
        if sql.startswith('SELECT a.*') and 'coordinator_accounts' in sql:
            self.row = account() if args[0] == 'coordinator@example.com' else None
        elif sql.startswith('INSERT INTO coordinator_sessions'):
            self.sessions.append(args)
        else:
            super().execute(sql, args)


class CoordinatorTests(unittest.TestCase):
    def registration(self):
        return auth.CoordinatorRegistration(email=' Coordinator@example.com ', password='StrongPassword123!',
                name='Test Coordinator', classCode='NEW-CODE', program='BS Computer Science', school='Test School')

    def test_registration_hashes_password_and_links_initial_batch(self):
        cursor = MagicMock(lastrowid=4)
        with patch.object(auth, 'database', lambda: database_for(cursor)):
            auth.register(self.registration())
        calls = cursor.execute.call_args_list
        self.assertEqual(len(calls), 3)
        self.assertEqual(calls[0].args[1][0], 'coordinator@example.com')
        self.assertTrue(verify_password(self.registration().password, calls[0].args[1][1]))
        self.assertEqual(calls[2].args[1], ('NEW-CODE', 4))

    def test_duplicate_class_rolls_back_the_whole_registration(self):
        cursor = MagicMock(lastrowid=4)
        cursor.execute.side_effect = [None, mysql.connector.IntegrityError(errno=1062)]
        rolled_back = []
        @contextmanager
        def database():
            try:
                with database_for(cursor) as connection:
                    yield connection
            except Exception:
                rolled_back.append(True)
                raise
        with patch.object(auth, 'database', database), self.assertRaises(HTTPException) as result:
            auth.register(self.registration())
        self.assertEqual(result.exception.status_code, 409)
        self.assertTrue(rolled_back)

    def test_other_coordinators_cannot_change_batches_or_approve_students(self):
        for operation in (lambda: auth.update_batch('OTHER', auth.BatchUpdate(term='Changed'), account()),
                          lambda: auth.decide_student('OTHER', auth.Decision(email='student@example.com', action='approve'), account())):
            cursor = MagicMock()
            cursor.fetchone.return_value = None
            with patch.object(auth, 'database', lambda: database_for(cursor)), self.assertRaises(HTTPException) as result:
                operation()
            self.assertEqual(result.exception.status_code, 404)
            self.assertEqual(cursor.execute.call_count, 1)
            self.assertEqual(cursor.execute.call_args.args[1], ('OTHER', 4))

    def test_only_pending_students_in_active_owned_batch_can_be_approved(self):
        for batch, student, expected in (({'status':'active'}, {'id':8,'status':'pending'}, None),
                                         ({'status':'active'}, {'id':8,'status':'active'}, 409),
                                         ({'status':'closed'}, None, 400)):
            cursor = MagicMock()
            cursor.fetchone.side_effect = [batch, student]
            with patch.object(auth, 'database', lambda: database_for(cursor)):
                if expected:
                    with self.assertRaises(HTTPException) as result:
                        auth.decide_student('OWNED', auth.Decision(email='STUDENT@example.com', action='approve'), account())
                    self.assertEqual(result.exception.status_code, expected)
                else:
                    auth.decide_student('OWNED', auth.Decision(email='STUDENT@example.com', action='approve'), account())
                    self.assertIn("SET status='active'", cursor.execute.call_args.args[0])
                    self.assertEqual(cursor.execute.call_args.args[1], (8,))

    def test_login_lockout_and_session_role(self):
        store = CoordinatorStore()
        body = main.Login(email='coordinator@example.com', password='wrong')
        with patch.object(main, 'database', store.database), patch.object(main, 'verify_password', return_value=False):
            for status in (401,401,401,401,429):
                with self.assertRaises(HTTPException) as result:
                    main.coordinator_login(body)
                self.assertEqual(result.exception.status_code, status)
            with patch.object(main, 'verify_password', return_value=True):
                with self.assertRaises(HTTPException) as result:
                    main.coordinator_login(body)
                self.assertEqual(result.exception.status_code, 429)
                store.now += timedelta(minutes=5)
                result = main.coordinator_login(body)
                self.assertEqual(result['user']['role'], 'coordinator')
                self.assertNotIn('password_hash', result['user'])
                self.assertEqual(len(store.sessions), 1)

    def test_expired_and_inactive_coordinator_sessions_are_rejected(self):
        for row, expected in ((None, 401), ({**account(), 'status':'disabled'}, 403), (account(), None)):
            cursor = MagicMock()
            cursor.fetchone.return_value = row
            with patch.object(auth, 'database', lambda: database_for(cursor)):
                credentials = HTTPAuthorizationCredentials(scheme='Bearer', credentials='test-token')
                if expected:
                    with self.assertRaises(HTTPException) as result:
                        auth.coordinator(credentials)
                    self.assertEqual(result.exception.status_code, expected)
                else:
                    self.assertEqual(auth.coordinator(credentials)['id'], 4)

    def test_last_or_populated_batch_cannot_be_deleted(self):
        for count, students in ((1, 0), (2, 1)):
            cursor = MagicMock()
            cursor.fetchone.side_effect = [{'id':4}, {'code':'OWNED'}, {'count':count}, {'count':students}]
            with patch.object(auth, 'database', lambda: database_for(cursor)), self.assertRaises(HTTPException) as result:
                auth.delete_batch('OWNED', account())
            self.assertEqual(result.exception.status_code, 400)
            self.assertFalse(any(call.args[0].startswith('DELETE') for call in cursor.execute.call_args_list))

    def test_rejection_removes_only_selected_pending_student(self):
        cursor = MagicMock()
        cursor.fetchone.side_effect = [{'status':'active'}, {'id':8, 'status':'pending'}]
        with patch.object(auth, 'database', lambda: database_for(cursor)):
            auth.decide_student('OWNED', auth.Decision(email='student@example.com', action='reject'), account())
        self.assertEqual(cursor.execute.call_args.args, ('DELETE FROM student_accounts WHERE id=%s', (8,)))


if __name__ == '__main__':
    unittest.main()
