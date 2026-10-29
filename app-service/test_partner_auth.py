"""Partner signup and approval boundaries without changing live records."""
from unittest import TestCase
from unittest.mock import MagicMock, patch
import mysql.connector
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
import main
import partner_auth as auth
from security import verify_password
from test_coordinator_auth import account, database_for
from test_login_lockout import Store


class PartnerTests(TestCase):
    def registration(self):
        return auth.PartnerRegistration(email=' Partner@example.com ', password='StrongPassword123!',
            name='Test Partner', classCode='OWNED', program='Technology',
            company='Test Company', category='Technology')

    def test_registration_hashes_password_and_starts_pending(self):
        cursor = MagicMock(lastrowid=7)
        cursor.fetchone.return_value = {'code': 'OWNED'}
        with patch.object(auth, 'database', lambda: database_for(cursor)):
            self.assertEqual(auth.register(self.registration())['status'], 'pending')
        calls = cursor.execute.call_args_list
        self.assertTrue(verify_password(self.registration().password, calls[2].args[1][2]))
        self.assertEqual(calls[2].args[1][0], 'partner@example.com')
        self.assertIn("'pending'", calls[3].args[0])

    def test_invalid_or_unowned_batch_does_not_create_company(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = None
        with patch.object(auth, 'database', lambda: database_for(cursor)), self.assertRaises(HTTPException) as result:
            auth.register(self.registration())
        self.assertEqual(result.exception.status_code, 400)
        self.assertEqual(cursor.execute.call_count, 1)

    def test_duplicate_signup_returns_conflict(self):
        cursor = MagicMock(lastrowid=7)
        cursor.fetchone.return_value = {'code': 'OWNED'}
        cursor.execute.side_effect = [None, None, mysql.connector.IntegrityError(errno=1062)]
        with patch.object(auth, 'database', lambda: database_for(cursor)), self.assertRaises(HTTPException) as result:
            auth.register(self.registration())
        self.assertEqual(result.exception.status_code, 409)

    def test_unrelated_coordinator_cannot_decide(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = None
        with patch.object(auth, 'database', lambda: database_for(cursor)), self.assertRaises(HTTPException) as result:
            auth.decide_partner('OTHER', auth.Decision(email='partner@example.com', action='approve'), account())
        self.assertEqual(result.exception.status_code, 404)
        self.assertEqual(cursor.execute.call_count, 1)

    def test_decisions_are_scoped_and_cannot_be_replayed(self):
        for action in ('approve', 'reject'):
            cursor = MagicMock()
            cursor.fetchone.side_effect = [{'status': 'active'}, {'id': 7, 'status': 'pending'}]
            with patch.object(auth, 'database', lambda: database_for(cursor)):
                auth.decide_partner('OWNED', auth.Decision(email='partner@example.com', action=action), account())
            self.assertEqual(cursor.execute.call_args_list[1].args[1], ('partner@example.com', 'OWNED'))
            self.assertEqual(cursor.execute.call_args.args[1], (7,))
        cursor = MagicMock()
        cursor.fetchone.side_effect = [{'status': 'active'}, {'id': 7, 'status': 'active'}]
        with patch.object(auth, 'database', lambda: database_for(cursor)), self.assertRaises(HTTPException) as result:
            auth.decide_partner('OWNED', auth.Decision(email='partner@example.com', action='reject'), account())
        self.assertEqual(result.exception.status_code, 409)

    def test_pending_login_never_creates_session(self):
        class PendingStore(Store):
            def execute(self, sql, args=()):
                super().execute(sql, args)
                if sql.startswith('SELECT a.*') and self.row:
                    self.row['status'] = 'pending'
        store = PendingStore()
        with patch.object(main, 'database', store.database), patch.object(main, 'verify_password', return_value=True), self.assertRaises(HTTPException) as result:
            main.login(main.Login(email='partner@example.com', password='correct'))
        self.assertEqual(result.exception.status_code, 403)
        self.assertEqual(store.sessions, [])

    def test_pending_account_cannot_use_existing_posting_session(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = {'status': 'pending'}
        with patch.object(auth, 'database', lambda: database_for(cursor)), self.assertRaises(HTTPException) as result:
            main.partner(HTTPAuthorizationCredentials(scheme='Bearer', credentials='test'))
        self.assertEqual(result.exception.status_code, 403)

    def test_partner_list_is_scoped_to_authenticated_coordinator(self):
        cursor = MagicMock()
        cursor.fetchall.return_value = []
        with patch.object(auth, 'database', lambda: database_for(cursor)):
            self.assertEqual(auth.partners(account()), {'partners': []})
        self.assertEqual(cursor.execute.call_args.args[1], (4,))
        self.assertIn('o.coordinator_id=%s', cursor.execute.call_args.args[0])
