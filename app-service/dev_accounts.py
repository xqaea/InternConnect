"""Local development accounts, one per role, so each portal can be tried (never for production).

Run through `manage.py dev-accounts`. It refuses any database host that is not this computer, creates only what is
missing (existing accounts keep their password unless --reset-passwords is given), hashes passwords exactly as the
registration endpoints do, and writes the generated passwords to a git-ignored file instead of printing them.
"""
import json
import secrets
import string
from datetime import date
from pathlib import Path
from security import hash_password
from student_resume import Resume

LOCAL_HOSTS = {'127.0.0.1', 'localhost', '::1'}
BATCH = 'DEV-CS-2026'
PROGRAM = 'BS Computer Science'
SCHOOL = 'PHINMA - St. Jude College Dasmariñas Cavite Inc.'
COMPANY = 'Dev Software Co'
POSTING_ID = 'dev-qa-intern'
CREDENTIAL_FILE = Path(__file__).resolve().parent.parent / '.local' / 'dev-accounts.txt'
# example.com is reserved for documentation, so these addresses can never belong to a real person. The registration
# rules only accept .edu, .edu.ph and .com addresses.
COORDINATOR = ('coordinator', 'dev.coordinator@example.com', 'Dev Coordinator')
STUDENT = ('student', 'dev.student@example.com', 'Dev Student')
PENDING_STUDENT = ('student', 'dev.student.pending@example.com', 'Dev Pending Student')
PARTNER = ('partner', 'dev.partner@example.com', 'Dev HR Partner')
ACCOUNTS = (COORDINATOR, STUDENT, PENDING_STUDENT, PARTNER)


def check_local(host):
    """These accounts have known-format throwaway passwords, so they may only be created on this computer."""
    if str(host).strip().lower() not in LOCAL_HOSTS:
        raise SystemExit(f'Refusing to create development accounts on database host {host!r}. '
                         'They are for a local database only (127.0.0.1 or localhost).')


def make_password():
    """16 characters with an upper-case letter, a lower-case letter, a digit and a symbol (the app's password policy)."""
    chosen = [secrets.choice(string.ascii_uppercase), secrets.choice(string.ascii_lowercase),
              secrets.choice(string.digits), secrets.choice('!#$%*+-=?@^_')]
    chosen += [secrets.choice(string.ascii_letters + string.digits) for _ in range(12)]
    secrets.SystemRandom().shuffle(chosen)
    return ''.join(chosen)


def resume_payload():
    return Resume(soft=['Communication', 'Teamwork'], hard=['SQL', 'Python', 'Documentation'],
                  savedAt=date.today().isoformat()).model_dump()


def posting_payload():
    return {
        'title': 'Dev QA & Documentation Intern', 'type': 'Internship · Hybrid', 'course': 'BSCS',
        'location': 'Dasmariñas, Cavite', 'coordinates': {'lat': 14.3294, 'lng': 120.9367, 'source': 'manual'},
        'salary': '', 'description': 'Sample internship for trying Job Matching, applications and placements.',
        'requirements': ['Basic SQL', 'Good written communication'],
        'skills': [['SQL'], ['Python'], ['Documentation']], 'deadlineISO': '', 'deadline': '',
        'status': 'open', 'onet_soc_code': None,
    }


def seed(cursor, reset=False, passwords=make_password):
    """Create what is missing. Returns {email: (role, state, password or None)}; state is created, reset or exists."""
    result = {}

    def account(table, role, email, name, insert, update_sql, extra=()):
        """Create the account, or reset its password, and return its id. Existing accounts are otherwise untouched."""
        cursor.execute(f'SELECT id FROM {table} WHERE email=%s', (email,))
        found = cursor.fetchone()
        if found and not reset:
            result[email] = (role, 'exists', None)
            return found['id']
        password = passwords()
        if found:
            cursor.execute(update_sql, (hash_password(password), email))
            result[email] = (role, 'reset', password)
            return found['id']
        cursor.execute(insert, (email, hash_password(password), name, *extra))
        result[email] = (role, 'created', password)
        return cursor.lastrowid

    cursor.execute('INSERT INTO student_batches (code,program,school,theme) VALUES (%s,%s,%s,%s) ON DUPLICATE KEY UPDATE code=VALUES(code)',
                   (BATCH, PROGRAM, SCHOOL, 'sky'))

    role, email, name = COORDINATOR
    coordinator_id = account(
        'coordinator_accounts', role, email, name,
        'INSERT INTO coordinator_accounts (email,password_hash,name,program,school,theme,school_email,personal_email,avatar,created_at) '
        "VALUES (%s,%s,%s,%s,%s,'sky','','','',UTC_TIMESTAMP())",
        'UPDATE coordinator_accounts SET password_hash=%s WHERE email=%s', extra=(PROGRAM, SCHOOL))
    cursor.execute('SELECT coordinator_id FROM coordinator_batches WHERE class_code=%s', (BATCH,))
    owner = cursor.fetchone()
    if owner and owner['coordinator_id'] != coordinator_id:
        raise SystemExit(f'Batch {BATCH} already belongs to another coordinator. No further changes were made.')
    if not owner:
        cursor.execute('INSERT INTO coordinator_batches (class_code,coordinator_id,created_at) VALUES (%s,%s,UTC_TIMESTAMP())', (BATCH, coordinator_id))

    for number, (role, email, name), status in ((1, STUDENT, 'active'), (2, PENDING_STUDENT, 'pending')):
        student_id = account(
            'student_accounts', role, email, name,
            'INSERT INTO student_accounts (email,password_hash,name,student_number,class_code,school_email,personal_email,avatar,status,created_at) '
            f"VALUES (%s,%s,%s,%s,%s,'','','','{status}',UTC_TIMESTAMP())",
            'UPDATE student_accounts SET password_hash=%s WHERE email=%s', extra=(f'DEV-{number:04d}', BATCH))
        if status == 'active':  # a saved resume lets this student apply to the sample posting
            cursor.execute('INSERT INTO student_resumes (account_id,payload,updated_at) VALUES (%s,%s,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE account_id=account_id',
                           (student_id, json.dumps(resume_payload())))

    cursor.execute('INSERT INTO companies (name,class_code) VALUES (%s,%s) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)', (COMPANY, BATCH))
    company_id = cursor.lastrowid
    role, email, name = PARTNER
    partner_id = account(
        'partner_accounts', role, email, name,
        'INSERT INTO partner_accounts (email,password_hash,name,company_id) VALUES (%s,%s,%s,%s)',
        'UPDATE partner_accounts SET password_hash=%s WHERE email=%s', extra=(company_id,))
    cursor.execute("INSERT INTO partner_profiles (account_id,category,avatar,status,created_at) VALUES (%s,'Software Development','','active',UTC_TIMESTAMP()) "
                   "ON DUPLICATE KEY UPDATE status='active'", (partner_id,))
    cursor.execute("INSERT INTO job_postings (id,company_id,payload,latitude,longitude,status,posted_at) VALUES (%s,%s,%s,%s,%s,'open',%s) ON DUPLICATE KEY UPDATE id=id",
                   (POSTING_ID, company_id, json.dumps(posting_payload()), 14.3294, 120.9367, date.today()))
    return result


def write_credentials(path, result):
    """Merge new passwords into the file. Entries for accounts left untouched this time are kept."""
    path = Path(path)
    known = {}
    if path.exists():
        for line in path.read_text(encoding='utf-8').splitlines():
            parts = [part.strip() for part in line.split('|')]
            if len(parts) == 3 and '@' in parts[1]:
                known[parts[1]] = parts
    for email, (role, state, password) in result.items():
        if password:
            known[email] = [role, email, password]
    path.parent.mkdir(parents=True, exist_ok=True)
    body = ['# InternConnect development accounts. Local database only. Git ignores this file; delete it when you are done.',
            '# role | email | password'] + [' | '.join(row) for row in known.values()]
    path.write_text('\n'.join(body) + '\n', encoding='utf-8')


def run(reset=False, path=CREDENTIAL_FILE, database=None, host=None, say=print):
    if database is None or host is None:
        from db import database as open_database, settings
        database, host = open_database, settings()['host']
    check_local(host)
    with database() as connection:
        result = seed(connection.cursor(dictionary=True), reset=reset)
    write_credentials(path, result)
    for email, (role, state, password) in result.items():
        say(f'  {role:<12}{email:<38}{state}')
    say(f'Batch code: {BATCH}   Sample company: {COMPANY}')
    say(f'Passwords for new or reset accounts are in {path}. Existing accounts keep their password.')
    return result
