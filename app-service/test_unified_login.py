"""Unified login: real password hashing, isolated account/session storage."""
import unittest
from unittest.mock import patch
from datetime import timedelta
from fastapi import HTTPException
from types import SimpleNamespace
import main
from security import hash_password, token_hash
from test_login_lockout import Store


class Accounts(Store):
    def __init__(self):
        super().__init__()
        self.accounts = {}

    def execute(self, sql, args=()):
        roles = {'student_accounts': 'student', 'coordinator_accounts': 'coordinator', 'partner_accounts': 'partnercompany'}
        if sql.startswith('SELECT a.*'):
            role = next(role for table, role in roles.items() if 'FROM ' + table in sql)
            self.row = self.accounts.get((role, args[0]))
        elif sql.startswith('INSERT INTO ') and '_sessions ' in sql:
            self.sessions.append((sql.split()[2], args))
        else:
            super().execute(sql, args)


class UnifiedLoginTests(unittest.TestCase):
    def setUp(self):
        self.store = Accounts()
        self.patch = patch.object(main, 'database', self.store.database)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.password = 'GoodPassword2026!'
        self.encoded = hash_password(self.password)
        for role in ('student', 'coordinator', 'partnercompany'):
            self.add_account(role, role + '@example.com')

    def add_account(self, role, email, status='active'):
        self.store.accounts[role, email] = dict(id=len(self.store.accounts)+1, email=email,
            name=role, password_hash=self.encoded, status=status, student_number='2026-1',
            class_code='TEST', program='BSCS', school='PHINMA SJCDC', theme='sky',
            school_email=email, personal_email='', avatar='', company='Company')

    def login(self, email, password=None):
        return self.call(main.unified_login, email, self.password if password is None else password)

    def call(self, endpoint, email, password):
        try:
            data = endpoint(main.Login(email=email, password=password))
            return SimpleNamespace(status_code=200, json=lambda:data, text=str(data))
        except HTTPException as error:
            data = {'detail':error.detail}
            return SimpleNamespace(status_code=error.status_code, json=lambda:data,
                headers={key.lower():value for key,value in (error.headers or {}).items()}, text=str(data))

    def test_all_roles_return_correct_user_and_session_table(self):
        for role, table in [('student','student_sessions'), ('coordinator','coordinator_sessions'), ('partnercompany','posting_sessions')]:
            with self.subTest(role=role):
                response = self.login('  ' + role.upper() + '@EXAMPLE.COM  ')
                self.assertEqual(response.status_code, 200, response.text)
                data = response.json()
                self.assertEqual(data['user']['role'], role)
                self.assertTrue(data['user']['databaseAccount'])
                self.assertEqual(self.store.sessions[-1][0], table)
                self.assertEqual(self.store.sessions[-1][1][0], token_hash(data['token']))

    def test_wrong_password_and_unknown_email_use_generic_error(self):
        for email in ['student@example.com','coordinator@example.com','partnercompany@example.com','missing@example.com']:
            response = self.login(email, 'wrong')
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.json()['detail']['message'], 'Invalid email or password.')
        self.assertEqual(self.store.sessions, [])

    def test_each_role_blocks_fifth_attempt_and_unlocks_after_five_minutes(self):
        for role in ('student','coordinator','partnercompany'):
            email = role + '@example.com'
            for remaining in (4,3,2,1):
                self.assertEqual(self.login(email,'wrong').json()['detail']['remaining_attempts'],remaining)
            self.assertEqual(self.login(email,'wrong').status_code,429)
            self.assertEqual(self.login(email).headers['retry-after'],'300')
            self.store.now += timedelta(minutes=5)
            self.assertEqual(self.login(email).status_code,200)

    def test_pending_account_cannot_sign_in(self):
        for role in ('student','coordinator','partnercompany'):
            self.store.accounts[role,role+'@example.com']['status']='pending'
            self.assertEqual(self.login(role+'@example.com').status_code,403)
        self.assertEqual(self.store.sessions,[])

    def test_duplicate_credentials_do_not_silently_choose_role(self):
        self.add_account('coordinator','student@example.com')
        self.assertEqual(self.login('student@example.com').status_code,409)
        self.assertEqual(self.store.sessions,[])
        self.store.accounts['coordinator','student@example.com']['password_hash']=hash_password('OtherPassword2026!')
        self.assertEqual(self.login('student@example.com').json()['user']['role'],'student')

    def test_legacy_endpoint_cannot_bypass_unified_lockout(self):
        for _ in range(5): self.login('student@example.com','wrong')
        response=self.call(main.student_login, 'student@example.com', self.password)
        self.assertEqual(response.status_code,429)
