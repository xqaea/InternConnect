"""Student auth checks; no live database credentials or student records required."""
from contextlib import contextmanager
from datetime import timedelta
import unittest
from unittest.mock import MagicMock, patch
import mysql.connector
from fastapi import HTTPException
from pydantic import ValidationError
from fastapi.security import HTTPAuthorizationCredentials

import main
import student_auth
from security import verify_password
from test_login_lockout import Store


def account(status='active'):
    return dict(id=2, email='student@example.com', password_hash='hashed', name='Test Student',
                student_number='TEST-001', class_code='TEST', program='BS Computer Science',
                school='Test School', theme='sky', school_email='student@example.com',
                personal_email='', avatar='', status=status)


class StudentStore(Store):
    def __init__(self, status='active'):
        super().__init__()
        self.student = account(status)

    def execute(self, sql, args=()):
        if sql.startswith('SELECT a.*') and 'student_accounts' in sql:
            self.row = self.student if args[0] == self.student['email'] else None
        elif sql.startswith('INSERT INTO student_sessions'):
            self.sessions.append(args)
        else:
            super().execute(sql, args)


class StudentAuthTests(unittest.TestCase):
    def draft(self, **changes):
        data = dict(email=' Student@example.com ', password='ValidPassword123!', name='Test Student',
                    studentNumber='TEST-001', classCode='TEST', program='BS Computer Science')
        return student_auth.StudentRegistration(**{**data, **changes})

    def test_registration_hashes_password_and_returns_pending_without_credentials(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = dict(status='active', program='BS Computer Science')
        connection = MagicMock()
        connection.cursor.return_value = cursor
        @contextmanager
        def database():
            yield connection
        with patch.object(student_auth, 'database', database):
            result = student_auth.register(self.draft())
        insert = cursor.execute.call_args_list[-1].args[1]
        self.assertEqual(insert[0], 'student@example.com')
        self.assertNotEqual(insert[1], self.draft().password)
        self.assertTrue(verify_password(self.draft().password, insert[1]))
        self.assertEqual(result['status'], 'pending')
        self.assertNotIn('token', result)

    def test_unknown_inactive_and_wrong_program_batches_do_not_insert(self):
        for batch in (None, dict(status='closed', program='BS Computer Science'), dict(status='active', program='Other')):
            cursor = MagicMock()
            cursor.fetchone.return_value = batch
            connection = MagicMock()
            connection.cursor.return_value = cursor
            @contextmanager
            def database():
                yield connection
            with patch.object(student_auth, 'database', database), self.assertRaises(HTTPException):
                student_auth.register(self.draft())
            self.assertEqual(cursor.execute.call_count, 1)

    def test_pending_login_denied_active_login_creates_student_session(self):
        store = StudentStore('pending')
        body = main.Login(email='STUDENT@example.com', password='right')
        with patch.object(main, 'database', store.database), patch.object(main, 'verify_password', return_value=True):
            with self.assertRaises(HTTPException) as result:
                main.student_login(body)
            self.assertEqual(result.exception.status_code, 403)
            self.assertEqual(store.sessions, [])
            store.student['status'] = 'active'
            result = main.student_login(body)
            self.assertTrue(result['user']['databaseAccount'])
            self.assertEqual(result['user']['role'], 'student')
            self.assertNotIn('password_hash', result['user'])
            self.assertEqual(len(store.sessions), 1)

    def test_student_lockout_is_persisted_and_expires(self):
        store = StudentStore()
        with patch.object(main, 'database', store.database), patch.object(main, 'verify_password', return_value=False):
            for expected in (401, 401, 401, 401, 429):
                with self.assertRaises(HTTPException) as result:
                    main.student_login(main.Login(email='student@example.com', password='wrong'))
                self.assertEqual(result.exception.status_code, expected)
            self.assertEqual(next(iter(store.attempts.values()))['failures'], 5)
            store.now += timedelta(minutes=5)
            with patch.object(main, 'verify_password', return_value=True):
                self.assertIn('token', main.student_login(main.Login(email='student@example.com', password='right')))

    def test_invalid_registration_and_public_profile(self):
        for changes in (dict(password='weakpass'), dict(email='invalid'), dict(name=' '), dict(avatar='javascript:alert(1)')):
            with self.assertRaises(ValidationError):
                self.draft(**changes)
        self.assertNotIn('password_hash', student_auth.public_student(account()))

    def test_duplicate_registration_is_a_conflict(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = dict(status='active', program='BS Computer Science')
        cursor.execute.side_effect = [None, mysql.connector.IntegrityError(errno=1062)]
        connection = MagicMock()
        connection.cursor.return_value = cursor
        @contextmanager
        def database():
            yield connection
        with patch.object(student_auth, 'database', database), self.assertRaises(HTTPException) as result:
            student_auth.register(self.draft())
        self.assertEqual(result.exception.status_code, 409)

    def test_me_rejects_expired_and_pending_sessions(self):
        credentials = HTTPAuthorizationCredentials(scheme='Bearer', credentials='test-token')
        for row, code in ((None, 401), (account('pending'), 403), (account(), None)):
            cursor = MagicMock()
            cursor.fetchone.return_value = row
            connection = MagicMock()
            connection.cursor.return_value = cursor
            @contextmanager
            def database():
                yield connection
            with patch.object(student_auth, 'database', database):
                if code:
                    with self.assertRaises(HTTPException) as result:
                        student_auth.student(credentials)
                    self.assertEqual(result.exception.status_code, code)
                else:
                    self.assertNotIn('password_hash', student_auth.public_student(student_auth.student(credentials)))


if __name__ == '__main__':
    unittest.main()
