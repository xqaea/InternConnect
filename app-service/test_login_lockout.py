"""Auth lockout regression checks without changing the user's database."""
from contextlib import contextmanager
from copy import deepcopy
from datetime import datetime, timedelta
import unittest
from unittest.mock import patch

from fastapi import HTTPException
import main


class Store:
    def __init__(self):
        self.attempts = {}
        self.sessions = []
        self.now = datetime(2026, 10, 29, 12)
        self.row = None

    @contextmanager
    def database(self):
        snapshot = deepcopy(self.attempts)
        try:
            yield self
        except Exception:
            self.attempts = snapshot
            raise

    def cursor(self, **kwargs):
        return self

    def execute(self, sql, args=()):
        if sql.startswith('INSERT INTO login_attempts'):
            self.attempts.setdefault(args[0], {'failures': 0, 'blocked_until': None})
        elif sql.startswith('SELECT failures'):
            self.row = {**self.attempts[args[0]], 'now': self.now}
        elif sql.startswith('SELECT a.*'):
            self.row = (dict(id=1, email=args[0], name='Test Partner', company='Test',
                             class_code='TEST', password_hash='hashed', status='active')
                        if args[0] == 'partner@example.com' else None)
        elif sql.startswith('UPDATE login_attempts'):
            self.attempts[args[2]] = {'failures': args[0], 'blocked_until': args[1]}
        elif sql.startswith('DELETE FROM login_attempts WHERE attempt_key'):
            self.attempts.pop(args[0], None)
        elif sql.startswith('INSERT INTO posting_sessions'):
            self.sessions.append(args)

    def fetchone(self):
        return self.row


class LoginLockoutTests(unittest.TestCase):
    def setUp(self):
        self.store = Store()
        self.db_patch = patch.object(main, 'database', self.store.database)
        self.password_patch = patch.object(main, 'verify_password', side_effect=lambda pw, encoded: pw == 'right')
        self.db_patch.start()
        self.verify = self.password_patch.start()
        self.addCleanup(self.db_patch.stop)
        self.addCleanup(self.password_patch.stop)

    def reject(self, password='wrong', email='partner@example.com'):
        with self.assertRaises(HTTPException) as result:
            main.login(main.Login(email=email, password=password))
        return result.exception

    def lock(self):
        for remaining in (4, 3, 2, 1):
            error = self.reject()
            self.assertEqual(error.status_code, 401)
            self.assertEqual(error.detail['remaining_attempts'], remaining)
        self.assertEqual(self.reject().status_code, 429)

    def test_fifth_failure_commits_and_even_correct_password_is_blocked(self):
        self.lock()
        self.assertEqual(next(iter(self.store.attempts.values()))['failures'], 5)
        calls = self.verify.call_count
        error = self.reject(password='right')
        self.assertEqual(error.headers['Retry-After'], '300')
        self.assertEqual(self.verify.call_count, calls)
        self.assertEqual(self.store.sessions, [])

    def test_lock_expiry_permits_login_and_success_clears_failures(self):
        self.lock()
        self.store.now += timedelta(minutes=5)
        result = main.login(main.Login(email=' PARTNER@example.com ', password='right'))
        self.assertIn('token', result)
        self.assertEqual(self.store.attempts, {})
        self.assertEqual(len(self.store.sessions), 1)

    def test_wrong_password_after_expiry_starts_new_five_attempt_cycle(self):
        self.lock()
        self.store.now += timedelta(minutes=5)
        self.assertEqual(self.reject().detail['remaining_attempts'], 4)

    def test_unknown_account_fails_and_success_resets_partial_count(self):
        self.assertEqual(self.reject(email='unknown@example.com', password='right').status_code, 401)
        self.reject()
        main.login(main.Login(email='partner@example.com', password='right'))
        self.assertEqual(self.reject().detail['remaining_attempts'], 4)


if __name__ == '__main__':
    unittest.main()
