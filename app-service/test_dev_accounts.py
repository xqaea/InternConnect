"""Local development accounts: local-only guard, password policy, idempotence and no printed passwords."""
import io
import json
import tempfile
from contextlib import contextmanager
from pathlib import Path
from unittest import TestCase

import dev_accounts as module
import main
from security import verify_password
from student_auth import StudentRegistration
from student_resume import Resume

ROOT = Path(__file__).resolve().parent.parent


class FakeCursor:
    """Just enough of a cursor: remembers every statement and answers the existence checks."""
    def __init__(self, existing=None, owner=None):
        self.existing, self.owner, self.statements, self.lastrowid, self._row = existing or {}, owner, [], 100, None

    def execute(self, sql, args=()):
        self.statements.append((sql, args))
        self._row = None
        if sql.startswith('SELECT id FROM '):
            found = self.existing.get((sql.split('FROM ')[1].split(' ')[0], args[0]))
            self._row = {'id': found} if found else None
        elif sql.startswith('SELECT coordinator_id FROM coordinator_batches'):
            self._row = {'coordinator_id': self.owner} if self.owner else None
        elif sql.startswith('INSERT INTO'):
            self.lastrowid += 1

    def fetchone(self):
        return self._row

    def rows(self, verb, table):
        return [args for sql, args in self.statements if sql.startswith(f'{verb} {table}') or sql.startswith(f'{verb} INTO {table}')]


def counter():
    values = iter(f'Pw{n}!aaaaaaaaaaaa' for n in range(1, 99))
    return lambda: next(values)


ALL_EXISTING = {('coordinator_accounts', 'dev.coordinator@example.com'): 7, ('student_accounts', 'dev.student@example.com'): 8,
                ('student_accounts', 'dev.student.pending@example.com'): 9, ('partner_accounts', 'dev.partner@example.com'): 10}


class GuardTests(TestCase):
    def test_only_this_computer_is_allowed(self):
        for host in ('127.0.0.1', 'localhost', 'LOCALHOST', '::1', ' 127.0.0.1 '):
            module.check_local(host)
        for host in ('db.example.org', '10.0.0.5', '192.168.1.20', '0.0.0.0', ''):
            with self.subTest(host), self.assertRaises(SystemExit) as caught:
                module.check_local(host)
            self.assertIn('local database only', str(caught.exception))


class PasswordTests(TestCase):
    def test_generated_passwords_meet_the_registration_policy_and_differ(self):
        seen = set()
        for _ in range(50):
            password = module.make_password()
            seen.add(password)
            self.assertEqual(len(password), 16)
            StudentRegistration(email='dev.student@example.com', password=password, name='Dev', classCode=module.BATCH,
                                program=module.PROGRAM, studentNumber='DEV-0001')  # raises if the policy is not met
        self.assertEqual(len(seen), 50)

    def test_account_emails_pass_the_registration_email_rule(self):
        for _, email, name in module.ACCOUNTS:
            StudentRegistration(email=email, password=module.make_password(), name=name, classCode=module.BATCH,
                                program=module.PROGRAM, studentNumber='DEV-0001')
            self.assertTrue(email.endswith('@example.com'))


class SeedTests(TestCase):
    def seed(self, **options):
        self.cursor = FakeCursor(**{k: options.pop(k) for k in ('existing', 'owner') if k in options})
        self.result = module.seed(self.cursor, passwords=counter(), **options)
        return self.cursor

    def test_every_role_gets_an_account_and_the_batch_is_owned_by_the_coordinator(self):
        cursor = self.seed()
        self.assertEqual({role for role, _, _ in self.result.values()}, {'coordinator', 'student', 'partner'})
        self.assertEqual(len(cursor.rows('INSERT', 'coordinator_accounts')), 1)
        self.assertEqual(len(cursor.rows('INSERT', 'student_accounts')), 2)
        self.assertEqual(len(cursor.rows('INSERT', 'partner_accounts')), 1)
        self.assertEqual(cursor.rows('INSERT', 'coordinator_batches')[0][0], module.BATCH)
        self.assertEqual(cursor.rows('INSERT', 'student_batches')[0], (module.BATCH, module.PROGRAM, module.SCHOOL, 'sky'))

    def test_one_student_is_active_with_a_resume_and_one_waits_for_approval(self):
        cursor = self.seed()
        statuses = {args[0]: "'active'" in sql for sql, args in cursor.statements if sql.startswith('INSERT INTO student_accounts')}
        self.assertEqual(statuses, {'dev.student@example.com': True, 'dev.student.pending@example.com': False})
        self.assertEqual(len(cursor.rows('INSERT', 'student_resumes')), 1)  # only the active student can apply

    def test_the_partner_is_approved_with_a_sample_internship_to_match_against(self):
        cursor = self.seed()
        self.assertIn("'active'", [sql for sql, _ in cursor.statements if sql.startswith('INSERT INTO partner_profiles')][0])
        posting = cursor.rows('INSERT', 'job_postings')[0]
        self.assertEqual(posting[0], module.POSTING_ID)

    def test_passwords_are_hashed_and_verify(self):
        cursor = self.seed()
        for sql, args in cursor.statements:
            if sql.startswith('INSERT INTO') and 'password_hash' in sql:
                email, stored = args[0], args[1]
                password = self.result[email][2]
                self.assertNotEqual(stored, password)
                self.assertTrue(verify_password(password, stored))

    def test_seeded_payloads_pass_the_apps_own_validation(self):
        main.Posting(**module.posting_payload())
        Resume(**module.resume_payload())
        self.assertTrue(Resume(**module.resume_payload()).savedAt)  # applying needs a saved resume with a technical skill
        self.assertTrue(module.resume_payload()['hard'])

    def test_a_second_run_changes_nothing_and_hands_out_no_passwords(self):
        cursor = self.seed(existing=ALL_EXISTING, owner=7)
        self.assertEqual({state for _, state, _ in self.result.values()}, {'exists'})
        self.assertEqual({password for _, _, password in self.result.values()}, {None})
        for table in ('coordinator_accounts', 'student_accounts', 'partner_accounts', 'coordinator_batches'):
            self.assertEqual(cursor.rows('INSERT', table), [], table)
        self.assertEqual([sql for sql, _ in cursor.statements if sql.startswith('UPDATE')], [])

    def test_reset_gives_existing_accounts_new_passwords_without_recreating_them(self):
        cursor = self.seed(existing=ALL_EXISTING, owner=7, reset=True)
        self.assertEqual({state for _, state, _ in self.result.values()}, {'reset'})
        updates = [args for sql, args in cursor.statements if sql.startswith('UPDATE') and 'password_hash' in sql]
        self.assertEqual(len(updates), 4)
        for stored, email in updates:
            self.assertTrue(verify_password(self.result[email][2], stored))
        self.assertEqual(cursor.rows('INSERT', 'student_accounts'), [])

    def test_a_batch_owned_by_someone_else_is_never_taken(self):
        with self.assertRaises(SystemExit) as caught:
            self.seed(owner=55)
        self.assertIn('already belongs to another coordinator', str(caught.exception))

    def test_missing_accounts_are_added_next_to_existing_ones(self):
        existing = {('coordinator_accounts', 'dev.coordinator@example.com'): 7}
        self.seed(existing=existing, owner=7)
        states = {email: state for email, (_, state, _) in self.result.items()}
        self.assertEqual(states['dev.coordinator@example.com'], 'exists')
        self.assertEqual(states['dev.partner@example.com'], 'created')


class RunTests(TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / '.local' / 'dev-accounts.txt'
        self.cursor = FakeCursor()

        @contextmanager
        def database():
            connection = type('Connection', (), {'cursor': lambda _, dictionary=False: self.cursor})()
            yield connection
        self.database = database

    def run_it(self, host='127.0.0.1', **options):
        said = []
        result = module.run(path=self.path, database=self.database, host=host, say=said.append, **options)
        return result, '\n'.join(said)

    def test_passwords_go_to_the_file_and_never_to_the_screen(self):
        result, screen = self.run_it()
        text = self.path.read_text(encoding='utf-8')
        for email, (role, state, password) in result.items():
            self.assertIn(f'{role} | {email} | {password}', text)
            self.assertNotIn(password, screen)
            self.assertIn(email, screen)
        self.assertIn(str(self.path), screen)
        self.assertIn(module.BATCH, screen)

    def test_a_remote_database_is_refused_before_anything_is_written(self):
        with self.assertRaises(SystemExit):
            self.run_it(host='db.example.org')
        self.assertEqual(self.cursor.statements, [])
        self.assertFalse(self.path.exists())

    def test_rerunning_keeps_the_saved_passwords_for_accounts_that_were_left_alone(self):
        first, _ = self.run_it()
        self.cursor = FakeCursor(existing=ALL_EXISTING, owner=7)
        second, screen = self.run_it()
        self.assertEqual({state for _, state, _ in second.values()}, {'exists'})
        text = self.path.read_text(encoding='utf-8')
        for email, (_, _, password) in first.items():
            self.assertIn(f'{email} | {password}', text)

    def test_the_credentials_file_sits_in_a_git_ignored_folder(self):
        self.assertEqual(module.CREDENTIAL_FILE, ROOT / '.local' / 'dev-accounts.txt')
        self.assertIn('.local/', (ROOT / '.gitignore').read_text(encoding='utf-8').splitlines())
