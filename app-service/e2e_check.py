"""End-to-end use-case check of the running app API, one role at a time (local or scratch database only).

It logs in as the development coordinator and partner (see `manage.py dev-accounts`), creates fresh intern accounts and
walks the real workflows: sign-up and approval, postings, applications, deployment with signed scans, clocking in and
out (inside the geofence, outside, low GPS accuracy, no photo), reviews and explanations, holidays and absences,
reports and grading, placement letters, notifications, the audit trail and access control between roles. With the AI
service running it also checks job matching and the O*NET fallback. Each use case prints PASS, FAIL or SKIP and the
exit code is 1 if anything failed.

    ai-service\\.venv\\Scripts\\python.exe app-service\\e2e_check.py

Needs the app API on --api (default http://127.0.0.1:8001). To move a deployment date back in time and to read the
attempts log it also needs IC_DB_HOST, IC_DB_USER, IC_DB_PASSWORD and IC_DB_NAME for the same database; without them
those checks are skipped. The interns it creates stay in the database; their passwords are appended to
.local/dev-accounts.txt so you can sign in as them and look around.
"""
import argparse
import base64
import json
import os
import secrets
import sys
import traceback
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from dev_accounts import BATCH, COMPANY, COORDINATOR, PARTNER, PROGRAM, STUDENT, CREDENTIAL_FILE, make_password, write_credentials  # noqa: E402

MANILA = timezone(timedelta(hours=8))
SITE = {'lat': 14.3294, 'lng': 120.9367, 'place': 'E2E office', 'radius': 150}
PDF = {'name': 'signed.pdf', 'data': 'data:application/pdf;base64,' + base64.b64encode(b'%PDF-1.4\n%%EOF\n').decode()}
def make_jpeg(width=480, height=360, exif=False, png=False):
    """A minimal JPEG header of the given size, as the page's canvas would send (the server reads only the header)."""
    if png:
        return 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'gallery').decode()
    def segment(marker, payload):
        return b'\xff' + bytes([marker]) + (len(payload) + 2).to_bytes(2, 'big') + payload
    body = b'\xff\xd8' + segment(0xE0, b'JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00')
    if exif:
        body += segment(0xE1, b'Exif\x00\x00II*\x00\x08\x00\x00\x00')
    body += segment(0xC0, b'\x08' + height.to_bytes(2, 'big') + width.to_bytes(2, 'big') + b'\x01\x01\x11\x00')
    body += segment(0xDA, b'\x01\x01\x00\x00?\x00') + b'\x00\x00\xff\xd9'
    return 'data:image/jpeg;base64,' + base64.b64encode(body).decode()


PHOTO = make_jpeg()


class Api:
    def __init__(self, base):
        self.base = base.rstrip('/')

    def call(self, method, path, body=None, token=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self.base + path, data=data, method=method)
        request.add_header('Content-Type', 'application/json')
        if token:
            request.add_header('Authorization', 'Bearer ' + token)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status, json.loads(response.read() or b'null')
        except urllib.error.HTTPError as error:
            raw = error.read()
            try:
                return error.code, json.loads(raw)
            except ValueError:
                return error.code, {'detail': raw.decode(errors='replace')[:200]}


class Report:
    def __init__(self):
        self.rows, self.section = [], ''

    def head(self, title):
        self.section = title
        print(f'\n== {title} ==')

    def add(self, state, name, detail=''):
        self.rows.append((state, self.section, name, detail))
        print(f'  {state:<5} {name}' + (f'  ({detail})' if detail and state != 'PASS' else ''))

    def check(self, name, ok, detail=''):
        self.add('PASS' if ok else 'FAIL', name, detail)
        return bool(ok)

    def skip(self, name, why):
        self.add('SKIP', name, why)

    def attempt(self, name, function):
        """Run a use case; an unexpected exception is a failure of that use case, not of the whole run."""
        try:
            function()
        except Exception as error:  # noqa: BLE001 - report it and carry on with the next use case
            self.add('FAIL', name, f'{type(error).__name__}: {error}')
            traceback.print_exc(limit=2)

    def summary(self):
        counts = {state: sum(1 for row in self.rows if row[0] == state) for state in ('PASS', 'FAIL', 'SKIP')}
        print(f"\nResult: {counts['PASS']} passed, {counts['FAIL']} failed, {counts['SKIP']} skipped")
        for state, section, name, detail in self.rows:
            if state == 'FAIL':
                print(f'  FAILED [{section}] {name}  {detail}')
        return 1 if counts['FAIL'] else 0


def read_accounts(path):
    found = {}
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        parts = [part.strip() for part in line.split('|')]
        if len(parts) == 3 and '@' in parts[1]:
            found[parts[1]] = parts[2]
    return found


def open_database():
    """The test database, or None when no connection settings are present."""
    if not os.getenv('IC_DB_USER'):
        return None
    from db import database
    return database


class Run:
    def __init__(self, api, ai, accounts, report, database):
        self.api, self.ai, self.accounts, self.r, self.database = api, ai, accounts, report, database
        self.today = datetime.now(MANILA).date()
        self.tag = secrets.token_hex(3)
        self.new_credentials = {}

    # ---------- helpers ----------
    def login(self, email, password):
        return self.api.call('POST', '/api/auth/login', {'email': email, 'password': password})

    def session(self, account):
        status, body = self.login(account[1], self.accounts[account[1]])
        if status != 200:
            raise SystemExit(f'Could not sign in as {account[1]} (HTTP {status}). Run manage.py dev-accounts first, with the same database.')
        return body['token'], body['user']

    def schedule(self):
        hour = datetime.now(MANILA).hour
        return {'days': [0, 1, 2, 3, 4, 5, 6], 'timeIn': f'{hour:02d}:00', 'timeOut': '23:59', 'grace': 60, 'mode': 'On-site', 'site': SITE}

    def sql(self, statement, args=()):
        with self.database() as connection:
            cursor = connection.cursor(dictionary=True)
            cursor.execute(statement, args)
            return cursor.fetchall() if cursor.description else None

    def student_attendance(self, token):
        return self.api.call('GET', '/api/student/attendance', token=token)[1]['attendance']

    def coordinator_attendance(self, email=None):
        rows = self.api.call('GET', '/api/coordinator/attendance', token=self.ctoken)[1]['attendance']
        return [row for row in rows if email is None or row['email'] == email]

    def onboard(self, label, apply_to):
        """Register, get approved, save a resume, apply, get accepted and deployed. Returns the intern."""
        email = f'e2e.{label}.{self.tag}@example.com'
        password = make_password()
        intern = {'label': label, 'email': email, 'password': password}
        body = {'email': email, 'password': password, 'name': f'E2E {label.title()} {self.tag}', 'classCode': BATCH,
                'program': PROGRAM, 'studentNumber': f'E2E-{self.tag}-{label}'}
        intern['register'] = self.api.call('POST', '/api/auth/student/register', body)[0]
        intern['pending_login'] = self.login(email, password)[0]
        intern['approve'] = self.api.call('POST', f'/api/coordinator/batches/{BATCH}/students/decision', {'email': email, 'action': 'approve'}, self.ctoken)[0]
        status, session = self.login(email, password)
        intern['login'] = status
        intern['token'] = session.get('token')
        intern['resume'] = self.api.call('PUT', '/api/student/resume', {'fields': {}, 'soft': ['Communication'], 'hard': ['SQL', 'Python', 'Documentation'],
                                                                        'savedAt': self.today.isoformat()}, intern['token'])[0]
        intern['apply'] = self.api.call('POST', '/api/student/applications', {'postingId': apply_to}, intern['token'])[0]
        applications = self.api.call('GET', '/api/partner/applications', token=self.ptoken)[1]['applications']
        mine = [row for row in applications if row['email'] == email]
        intern['application'] = mine[0]['id'] if mine else None
        if intern['application']:
            intern['accept'] = self.api.call('PUT', f"/api/partner/applications/{intern['application']}", {'status': 'Accepted'}, self.ptoken)[0]
            intern['deploy'] = self.api.call('POST', f"/api/coordinator/applications/{intern['application']}/deployment",
                                             {'schedule': self.schedule(), 'endorsement': PDF, 'acceptance': PDF}, self.ctoken)[0]
        self.new_credentials[email] = ('student', 'created', password)
        return intern

    def clock(self, intern, action, **changes):
        body = {'action': action, 'lat': SITE['lat'], 'lng': SITE['lng'], 'accuracy': 12, **({'photo': PHOTO} if action == 'in' else {})}
        if action == 'in' and 'challenge' not in changes:
            # the page asks for a capture code each time the camera opens
            code, issued = self.api.call('POST', '/api/student/attendance/challenge', {}, intern['token'])
            body['challenge'] = issued.get('token', '') if code == 200 else ''
        body.update(changes)
        return self.api.call('POST', '/api/student/attendance/clock', body, intern['token'])

    # ---------- the use cases ----------
    def run(self):
        r = self.r
        r.head('Platform')
        r.attempt('health', self.platform)
        r.head('Sign-in and access control')
        r.attempt('sign-in', self.sign_in)
        r.head('Partner: postings')
        r.attempt('postings', self.postings)
        r.head('Interns: sign-up, approval, application, deployment')
        r.attempt('onboarding', self.onboarding)
        r.head('Attendance: scripted clock attempts')
        r.attempt('clock attempts', self.clock_attempts)
        r.head('Attendance: reviews, explanations, notifications')
        r.attempt('reviews', self.reviews)
        r.head('Attendance: holidays, absences and excuses')
        r.attempt('absences', self.absences)
        r.head('Reports: submit, revise, grade')
        r.attempt('reports', self.reports)
        r.head('Placement letters (shared vault)')
        r.attempt('letters', self.letters)
        r.head('Notifications and audit trail')
        r.attempt('notifications', self.notifications)
        r.head('Isolation between coordinators')
        r.attempt('isolation', self.isolation)
        r.head('AI service: job matching and fallback')
        r.attempt('ai', self.ai_checks)

    def platform(self):
        status, body = self.api.call('GET', '/health')
        self.r.check('API is up and every table exists (including the attendance tables)', status == 200 and body.get('database') == 'mysql', f'HTTP {status} {body}')

    def sign_in(self):
        r = self.r
        self.ctoken, self.cuser = self.session(COORDINATOR)
        self.ptoken, self.puser = self.session(PARTNER)
        self.stoken, self.suser = self.session(STUDENT)
        r.check('coordinator signs in', bool(self.ctoken))
        r.check('partner signs in', bool(self.ptoken))
        r.check('approved student with a resume signs in', bool(self.stoken))
        status, _ = self.login(COORDINATOR[1], 'definitely-wrong')
        r.check('a wrong password is refused', status == 401, f'HTTP {status}')
        pending = self.login('dev.student.pending@example.com', self.accounts.get('dev.student.pending@example.com', 'x'))[0]
        r.check('a student waiting for approval cannot sign in', pending == 403, f'HTTP {pending}')
        for who, path, token in (('student', '/api/coordinator/attendance', self.stoken), ('partner', '/api/coordinator/attendance', self.ptoken),
                                 ('coordinator', '/api/student/attendance', self.ctoken), ('student', '/api/partner/applications', self.stoken),
                                 ('nobody', '/api/coordinator/attendance', None), ('nobody', '/api/student/attendance', None)):
            status, _ = self.api.call('GET', path, token=token)
            r.check(f'{who} cannot open {path}', status in (401, 403), f'HTTP {status}')

    def posting_body(self, **changes):
        body = {'title': f'E2E QA Intern {self.tag}', 'type': 'Internship · Hybrid', 'course': 'BSCS', 'location': 'Dasmariñas, Cavite',
                'coordinates': {'lat': SITE['lat'], 'lng': SITE['lng'], 'source': 'manual'}, 'salary': '', 'description': 'End-to-end test posting.',
                'requirements': ['SQL'], 'skills': [['SQL'], ['Python'], ['Documentation']], 'deadlineISO': '', 'deadline': '', 'status': 'open'}
        body.update(changes)
        return body

    def postings(self):
        r = self.r
        status, body = self.api.call('POST', '/api/partner/postings', self.posting_body(), self.ptoken)
        r.check('partner publishes an internship', status == 201 and body.get('id'), f'HTTP {status}')
        self.posting = body['id']
        listed = [p['id'] for p in self.api.call('GET', f'/api/postings?class_code={BATCH}', token=self.stoken)[1]['postings']]
        r.check('students in the batch see it, and the sample internship too', self.posting in listed and 'dev-qa-intern' in listed, str(listed))
        status, _ = self.api.call('PUT', f'/api/partner/postings/{self.posting}', self.posting_body(status='closed'), self.ptoken)
        listed = [p['id'] for p in self.api.call('GET', f'/api/postings?class_code={BATCH}')[1]['postings']]
        r.check('closing it removes it from the listing', status == 200 and self.posting not in listed)
        status, _ = self.api.call('POST', '/api/student/applications', {'postingId': self.posting}, self.stoken)
        r.check('nobody can apply to a closed posting', status == 400, f'HTTP {status}')
        self.api.call('PUT', f'/api/partner/postings/{self.posting}', self.posting_body(), self.ptoken)
        listed = [p['id'] for p in self.api.call('GET', f'/api/postings?class_code={BATCH}')[1]['postings']]
        r.check('reopening it brings it back', self.posting in listed)

    def onboarding(self):
        r = self.r
        self.interns = {}
        first = True
        for label in ('inside', 'outside', 'lowgps', 'nophoto'):
            intern = self.onboard(label, self.posting)
            self.interns[label] = intern
            if first:
                r.check('sign-up creates a pending account', intern['register'] == 201, f"HTTP {intern['register']}")
                r.check('a pending intern cannot sign in', intern['pending_login'] == 403, f"HTTP {intern['pending_login']}")
                r.check('the coordinator approves the sign-up and the intern can then sign in', intern['approve'] == 200 and intern['login'] == 200)
                r.check('saved resume lets the intern apply', intern['resume'] == 200 and intern['apply'] == 201, f"resume {intern['resume']} apply {intern['apply']}")
                dup = self.api.call('POST', '/api/student/applications', {'postingId': self.posting}, intern['token'])[0]
                r.check('a second application to the same posting is refused', dup == 409, f'HTTP {dup}')
                r.check('the partner sees the applicant and accepts', intern.get('application') and intern.get('accept') == 200)
                r.check('the coordinator deploys the intern with a schedule and worksite', intern.get('deploy') == 201, f"HTTP {intern.get('deploy')}")
                again = self.api.call('POST', f"/api/coordinator/applications/{intern['application']}/deployment",
                                      {'schedule': self.schedule(), 'endorsement': PDF, 'acceptance': PDF}, self.ctoken)[0]
                r.check('an intern cannot be deployed twice', again == 409, f'HTTP {again}')
                first = False
            else:
                r.check(f"intern '{label}' is deployed", intern.get('deploy') == 201, str({k: v for k, v in intern.items() if k in ('register', 'approve', 'login', 'apply', 'accept', 'deploy')}))

    def clock_attempts(self):
        r = self.r
        interns = self.interns
        expectations = (
            ('inside', {}, 'Present', []),
            ('outside', {'lat': SITE['lat'] + 0.01}, 'Flagged', ['out of radius']),
            ('lowgps', {'accuracy': 450}, 'Flagged', ['low GPS accuracy']),
            ('nophoto', {'photo': ''}, 'Flagged', ['missing photo']),
        )
        # Camera-only: these are refused before anything is saved, so the same intern can still clock in afterwards.
        gallery = (
            ('a PNG (gallery-style) photo', {'photo': make_jpeg(png=True)}, 422),
            ('an oversize photo', {'photo': make_jpeg(width=3000, height=4000)}, 422),
            ('a photo with no capture code', {'challenge': ''}, 400),
            ('a forged capture code', {'challenge': 'x.9999999999.AAAA.deadbeef'}, 400),
        )
        for label, changes, expected in gallery:
            code, body = self.clock(interns['inside'], 'in', **changes)
            r.check(f'time in with {label} is refused ({expected})', code == expected, f'HTTP {code} {body}')
        _, other = self.api.call('POST', '/api/student/attendance/challenge', {}, interns['outside']['token'])
        code, body = self.clock(interns['inside'], 'in', challenge=other.get('token', ''))
        r.check("another student's capture code is refused (400)", code == 400, f'HTTP {code} {body}')
        for label, changes, status, flags in expectations:
            code, body = self.clock(interns[label], 'in', **changes)
            r.check(f'time in: {label} is {status}' + (f" ({', '.join(flags)})" if flags else ''),
                    code == 200 and body.get('status') == status and body.get('flags') == flags, f'HTTP {code} {body}')
        code, body = self.clock(interns['inside'], 'in')
        r.check('a second time in the same day is refused', code == 409, f'HTTP {code}')
        code, body = self.clock(interns['outside'], 'in', lat=SITE['lat'])
        kept = self.student_attendance(interns['outside']['token'])[0]
        r.check('a refused attempt does not change the saved record (still the original flags and one open clock-in)',
                code == 409 and kept['flags'] == ['out of radius'] and kept['status'] == 'Clocked in', f'HTTP {code} {kept}')
        for label in interns:
            code, body = self.clock(interns[label], 'out')
            r.check(f'time out: {label}', code == 200, f'HTTP {code} {body}')
        code, _ = self.clock(interns['inside'], 'out')
        r.check('a second time out is refused', code == 409, f'HTTP {code}')
        seen = {row['email']: row for row in self.coordinator_attendance() if row['date'] == self.today.isoformat()}
        for label in ('outside', 'lowgps', 'nophoto'):
            row = seen.get(interns[label]['email'], {})
            r.check(f'coordinator sees {label} as flagged with hours withheld', row.get('status') == 'Flagged' and row.get('hours') == 0 and row.get('flags'), str(row))
        inside = seen.get(interns['inside']['email'], {})
        r.check('the clean day is Present and unflagged', inside.get('status') == 'Present' and not inside.get('flags'), str(inside))
        if not self.database:
            r.skip('every attempt is logged with outcome, distance and accuracy', 'no IC_DB_* settings')
            return
        rows = self.sql("SELECT s.email,a.action,a.outcome,a.reasons,a.distance_m,a.accuracy_m FROM attendance_attempts a JOIN student_accounts s ON s.id=a.student_id "
                        'WHERE s.email LIKE %s ORDER BY a.id', (f'e2e.%.{self.tag}@example.com',))
        outcome = lambda label, action: [x for x in rows if x['email'] == interns[label]['email'] and x['action'] == action]
        r.check('attempts log: three refused "photo not live" attempts, inside accepted, then a refused duplicate time in and time out',
                [x['outcome'] for x in outcome('inside', 'in')] == ['rejected'] * 3 + ['accepted', 'rejected'] and [x['outcome'] for x in outcome('inside', 'out')] == ['accepted', 'rejected'],
                str([(x['action'], x['outcome']) for x in rows if x['email'] == interns['inside']['email']]))
        far = outcome('outside', 'in')[0]
        r.check('attempts log: the outside attempt records its distance and reason', far['outcome'] == 'flagged' and far['reasons'] == 'out of radius' and far['distance_m'] > 150, str(far))
        low = outcome('lowgps', 'in')[0]
        r.check('attempts log: the low-accuracy attempt records the reported accuracy', low['outcome'] == 'flagged' and low['accuracy_m'] == 450, str(low))

    def reviews(self):
        r = self.r
        interns, today = self.interns, self.today.isoformat()

        def review(label, decision, token=None):
            return self.api.call('PUT', '/api/coordinator/attendance/review', {'email': interns[label]['email'], 'date': today, 'decision': decision}, token or self.ctoken)[0]

        def mine(label):
            return next(row for row in self.student_attendance(interns[label]['token']) if row['date'] == today)

        r.check('a partner cannot review attendance', review('outside', 'accepted', self.ptoken) in (401, 403))
        r.check('a clean clock-in does not need review', review('inside', 'accepted') == 409)
        r.check('a clock-in cannot be excused', review('outside', 'excused') == 409)
        r.check('the coordinator accepts a flagged clock-in', review('outside', 'accepted') == 200 and mine('outside')['review'] == 'accepted')
        r.check('the coordinator rejects a flagged clock-in and it earns nothing', review('lowgps', 'rejected') == 200 and mine('lowgps')['review'] == 'rejected' and mine('lowgps')['hours'] == 0)
        r.check('a review can be undone', review('lowgps', '') == 200 and mine('lowgps')['review'] == '')
        explained = self.api.call('PUT', '/api/student/attendance/explanation', {'date': today, 'type': 'GPS or phone issue', 'reason': 'My phone camera failed.'}, interns['nophoto']['token'])[0]
        row = next((x for x in self.coordinator_attendance(interns['nophoto']['email']) if x['date'] == today), {})
        r.check('the intern explains a flagged day and the coordinator sees it', explained == 200 and (row.get('note') or {}).get('type') == 'GPS or phone issue')
        review('nophoto', 'accepted')
        again = self.api.call('PUT', '/api/student/attendance/explanation', {'date': today, 'type': 'Other', 'reason': 'Changing my story later.'}, interns['nophoto']['token'])[0]
        r.check('an explanation cannot change after the coordinator reviewed the day', again == 409, f'HTTP {again}')
        student_notes = self.api.call('GET', '/api/student/notifications', token=interns['outside']['token'])[1]['notifications']
        r.check('the intern is notified that attendance was reviewed', any(n['title'] in ('Attendance reviewed', 'Attendance needs attention') for n in student_notes))

    def absences(self):
        r = self.r
        if not self.database:
            r.skip('absences, holidays and excuses', 'needs IC_DB_* settings to move the deployment date back in time')
            return
        intern, today = self.interns['inside'], self.today
        self.sql('UPDATE official_placements SET confirmed_at = confirmed_at - INTERVAL 5 DAY WHERE student_id=(SELECT id FROM student_accounts WHERE email=%s)', (intern['email'],))
        expected = {(today - timedelta(days=n)).isoformat() for n in (1, 2, 3, 4)}
        absent = lambda rows: {x['date'] for x in rows if x['status'] == 'Absent'}
        rows = self.student_attendance(intern['token'])
        r.check('scheduled days without a clock-in are recorded as absent (not today, not the day of deployment)', absent(rows) == expected, f'{sorted(absent(rows))} vs {sorted(expected)}')
        r.check('reading again does not duplicate absences', len([x for x in self.student_attendance(intern['token']) if x['status'] == 'Absent']) == 4)
        r.check('the coordinator sees the same absences', absent(self.coordinator_attendance(intern['email'])) == expected)
        day = (today - timedelta(days=2)).isoformat()
        holiday = {'classCode': BATCH, 'date': day, 'name': 'E2E suspension', 'type': 'Class / work suspension'}
        r.check('the coordinator adds a holiday', self.api.call('POST', '/api/coordinator/holidays', holiday, self.ctoken)[0] == 201)
        r.check('the same holiday cannot be added twice', self.api.call('POST', '/api/coordinator/holidays', holiday, self.ctoken)[0] == 409)
        r.check('an unknown holiday type is refused', self.api.call('POST', '/api/coordinator/holidays', {**holiday, 'date': '2026-01-05', 'type': 'Birthday'}, self.ctoken)[0] == 422)
        listed = [h['date'] for h in self.api.call('GET', f'/api/coordinator/holidays?class_code={BATCH}', token=self.ctoken)[1]['holidays']]
        r.check('the holiday is listed for the batch', day in listed)
        rows = self.student_attendance(intern['token'])
        statuses = {x['date']: x['status'] for x in rows}
        r.check('that day is now a Holiday, not an absence', statuses.get(day) == 'Holiday' and day not in absent(rows))
        r.check('a student cannot manage holidays', self.api.call('POST', '/api/coordinator/holidays', holiday, intern['token'])[0] in (401, 403))
        target = (today - timedelta(days=1)).isoformat()
        r.check('the intern explains an absence', self.api.call('PUT', '/api/student/attendance/explanation', {'date': target, 'type': 'Sick', 'reason': 'Fever, doctor visit.'}, intern['token'])[0] == 200)
        row = next(x for x in self.coordinator_attendance(intern['email']) if x['date'] == target)
        r.check('the coordinator sees the explanation on the absence', (row.get('note') or {}).get('type') == 'Sick')

        def decide(decision, date=target):
            return self.api.call('PUT', '/api/coordinator/attendance/review', {'email': intern['email'], 'date': date, 'decision': decision}, self.ctoken)[0]

        def state(date=target):
            return next(x for x in self.student_attendance(intern['token']) if x['date'] == date)

        r.check('an absence cannot be accepted like a clock-in', decide('accepted') == 409)
        r.check('the coordinator excuses the absence', decide('excused') == 200 and state()['review'] == 'excused')
        r.check('the coordinator can keep it absent instead, then undo', decide('unexcused') == 200 and state()['review'] == 'unexcused' and decide('') == 200 and state()['review'] == '')
        decide('excused')
        r.check('an explained and reviewed absence cannot be explained again', self.api.call('PUT', '/api/student/attendance/explanation', {'date': target, 'type': 'Other', 'reason': 'Trying to rewrite it.'}, intern['token'])[0] == 409)
        r.check('removing the holiday brings the absence back', self.api.call('DELETE', f'/api/coordinator/holidays/{BATCH}/{day}', token=self.ctoken)[0] == 200 and day in absent(self.student_attendance(intern['token'])))

    def reports(self):
        r = self.r
        task = {'classCode': BATCH, 'title': f'E2E weekly report {self.tag}', 'instructions': 'Describe what you did this week.', 'dueDate': '', 'maxPoints': 100}
        status, body = self.api.call('POST', '/api/coordinator/tasks', task, self.ctoken)
        r.check('the coordinator creates a classwork task', status == 201 and body.get('id'), f'HTTP {status}')
        task_id = body['id']
        intern = self.interns['inside']
        tasks = [t.get('id') for t in self.api.call('GET', '/api/student/tasks', token=intern['token'])[1]['tasks']]
        r.check('the intern sees the task', task_id in tasks, str(tasks)[:120])
        submit = lambda text: self.api.call('POST', f'/api/student/tasks/{task_id}/report', {'raw': text}, intern['token'])[0]
        r.check('the intern submits a report', submit('Wrote test cases for the login page.\nPaired with the QA lead.') == 200)
        r.check('a pending report cannot be replaced', submit('Replacing it.') == 409)
        reports = self.api.call('GET', '/api/coordinator/reports', token=self.ctoken)[1]['reports']
        mine = next((x for x in reports if x['taskId'] == task_id and x['email'] == intern['email']), {})
        r.check('the coordinator sees it as pending review, with a drafted bullet', mine.get('status') == 'Pending Review' and mine.get('bullet', '').startswith('Wrote test cases'))
        decide = lambda **fields: self.api.call('PUT', f'/api/coordinator/tasks/{task_id}/report', {'email': intern['email'], 'version': mine['version'], **fields}, self.ctoken)[0]
        r.check('asking for a revision needs an explanation', decide(status='Needs Revision', feedback='') == 400)
        r.check('the coordinator asks for a revision', decide(status='Needs Revision', feedback='Add what you learned.') == 200)
        r.check('the intern can resubmit after a revision request', submit('Wrote test cases for the login page and learned boundary testing.') == 200)
        r.check('a decision on an out-of-date version is refused', decide(status='Verified') == 409)
        fresh = next(x for x in self.api.call('GET', '/api/coordinator/reports', token=self.ctoken)[1]['reports'] if x['taskId'] == task_id and x['email'] == intern['email'])
        send = lambda **fields: self.api.call('PUT', f'/api/coordinator/tasks/{task_id}/report', {'email': intern['email'], 'version': fresh['version'], **fields}, self.ctoken)[0]
        r.check('a grade above the maximum is refused', send(status='Verified', score=250, feedback='ok') == 400)
        r.check('the coordinator verifies and grades the report', send(status='Verified', score=90, feedback='Good work.') == 200)
        final = next(x for x in self.api.call('GET', '/api/student/reports', token=intern['token'])[1]['reports'] if x['taskId'] == task_id)
        r.check('the intern sees the verified status and grade', final['status'] == 'Verified' and final['score'] == 90 and final['version'] == 2, str(final)[:200])
        other = self.api.call('GET', '/api/student/reports', token=self.interns['outside']['token'])[1]['reports']
        r.check("another intern cannot see this intern's report", all(x['taskId'] != task_id for x in other))

    def letters(self):
        r = self.r
        intern, other = self.interns['inside'], self.interns['outside']
        upload = lambda who, token, kind='endorsement', version=0: self.api.call('POST', f'/api/{who}/vault/letters', {'company': COMPANY, 'classCode': BATCH, 'email': intern['email'], 'kind': kind, 'file': PDF, 'version': version}, token)
        status, body = upload('partner', self.ptoken)
        r.check('the partner uploads a signed letter for an intern who applied', status == 200 and body.get('id'), f'HTTP {status} {body}')
        file_id = body['id']
        listing = self.api.call('GET', f'/api/coordinator/vault/letters?company={urllib.parse.quote(COMPANY)}&class_code={urllib.parse.quote(BATCH)}', token=self.ctoken)[1]['files']
        r.check('the coordinator sees it in the shared vault', any(x['id'] == file_id for x in listing))
        r.check('the intern can open their own letter', self.api.call('GET', f'/api/student/vault/letters/{file_id}', token=intern['token'])[0] == 200)
        r.check("another intern cannot open someone else's letter", self.api.call('GET', f'/api/student/vault/letters/{file_id}', token=other['token'])[0] == 404)
        r.check('the coordinator cannot replace a file the partner uploaded', upload('coordinator', self.ctoken, version=1)[0] == 403)
        r.check('the uploader can replace it', upload('partner', self.ptoken, version=1)[0] == 200)
        r.check('letters of a confirmed placement cannot be deleted', self.api.call('DELETE', f'/api/partner/vault/letters/{file_id}', token=self.ptoken)[0] == 409)

    def notifications(self):
        r = self.r
        for who, token in (('student', self.interns['outside']['token']), ('coordinator', self.ctoken), ('partner', self.ptoken)):
            items = self.api.call('GET', f'/api/{who}/notifications', token=token)[1]['notifications']
            r.check(f'{who} has notifications from the activity above', bool(items))
            unread = [n['id'] for n in items if n['unread']][:5]
            if unread:
                self.api.call('POST', f'/api/{who}/notifications/read', {'ids': unread}, token)
                after = {n['id']: n['unread'] for n in self.api.call('GET', f'/api/{who}/notifications', token=token)[1]['notifications']}
                r.check(f'{who} can mark notifications as read', all(not after.get(i, False) for i in unread))
        entries = self.api.call('GET', f'/api/coordinator/audit?class_code={BATCH}', token=self.ctoken)[1]['entries']
        text = ' | '.join(e['action'] for e in entries)
        for needle in ('Time in', 'flagged', 'Accepted flagged clock-in', 'Report submitted', 'Uploaded endorsement letter'):
            r.check(f"the audit trail records '{needle}'", needle in text)
        if self.database:
            r.check('the audit trail records holiday changes and excused absences', 'holiday' in text.lower() and 'Excused the absence' in text)
        r.check('a student cannot read the audit trail', self.api.call('GET', f'/api/coordinator/audit?class_code={BATCH}', token=self.stoken)[0] in (401, 403))

    def isolation(self):
        r = self.r
        email, password = f'e2e.coordinator2.{self.tag}@example.com', make_password()
        status, _ = self.api.call('POST', '/api/auth/coordinator/register', {
            'email': email, 'password': password, 'name': 'E2E Second Coordinator', 'classCode': f'E2E-{self.tag}', 'program': PROGRAM,
            'school': 'E2E School', 'theme': 'sky'})
        r.check('a second coordinator can register their own batch', status == 201, f'HTTP {status}')
        other = self.login(email, password)[1].get('token')
        victim = self.interns['inside']['email']
        r.check("their attendance list excludes the first coordinator's interns", all(row['email'] != victim for row in self.api.call('GET', '/api/coordinator/attendance', token=other)[1]['attendance']))
        review = self.api.call('PUT', '/api/coordinator/attendance/review', {'email': victim, 'date': self.today.isoformat(), 'decision': 'rejected'}, other)[0]
        r.check("they cannot review another coordinator's intern", review == 404, f'HTTP {review}')
        r.check("they cannot read another batch's holidays", self.api.call('GET', f'/api/coordinator/holidays?class_code={BATCH}', token=other)[0] == 404)
        r.check("they cannot add holidays to another batch", self.api.call('POST', '/api/coordinator/holidays', {'classCode': BATCH, 'date': '2026-12-31', 'name': 'x', 'type': 'Regular holiday'}, other)[0] == 404)
        r.check("they cannot decide another batch's sign-ups", self.api.call('POST', f'/api/coordinator/batches/{BATCH}/students/decision', {'email': victim, 'action': 'reject'}, other)[0] in (403, 404))
        audit = self.api.call('GET', f'/api/coordinator/audit?class_code={BATCH}', token=other)[1]
        r.check("they cannot read another batch's audit trail", not audit.get('entries'))

    def ai_checks(self):
        r = self.r
        if not self.ai:
            r.skip('job matching and fallback', 'no --ai URL')
            return
        probe = Api(self.ai)
        try:
            status, _ = probe.call('GET', '/health')
        except OSError:
            status = 0
        if status != 200:
            r.skip('job matching and fallback', f'AI service not reachable at {self.ai}')
            return
        postings = [{'id': 'qa', 'required_skills': ['SQL', 'Python', 'Documentation']}, {'id': 'kitchen', 'required_skills': ['Food Safety', 'Kitchen Operations']}]
        status, body = probe.call('POST', '/api/match/rank', {'student_skills': ['SQL', 'Python', 'Documentation'], 'postings': postings})
        scores = {m['posting_id']: m for m in body.get('matches', [])}
        r.check('matching ranks the related posting first, with a threshold and meets_threshold flags',
                status == 200 and body['matches'][0]['posting_id'] == 'qa' and isinstance(body.get('threshold'), float)
                and scores['qa']['meets_threshold'] is True and scores['kitchen']['meets_threshold'] is False, str(body)[:200])
        status, body = probe.call('POST', '/api/match/careers', {'student_skills': ['Python', 'SQL', 'Documentation'], 'limit': 3})
        r.check('the O*NET fallback returns occupations for a skill list', status == 200 and bool(body.get('matches')) and 'title' in body['matches'][0], f'HTTP {status}')
        status, body = probe.call('POST', '/api/match/rank', {'student_skills': [], 'postings': postings})
        r.check('matching refuses an empty skill list', status == 422, f'HTTP {status}')


def main(argv=None):
    parser = argparse.ArgumentParser(description='End-to-end use-case check of the running app API.')
    parser.add_argument('--api', default='http://127.0.0.1:8001')
    parser.add_argument('--ai', default='http://127.0.0.1:8000', help='AI service URL, or empty to skip those checks')
    parser.add_argument('--accounts', default=str(CREDENTIAL_FILE), help='file written by manage.py dev-accounts')
    parser.add_argument('--no-save-credentials', action='store_true', help='do not append the new interns to the accounts file')
    args = parser.parse_args(argv)
    if not Path(args.accounts).exists():
        raise SystemExit(f'{args.accounts} not found. Run manage.py dev-accounts first.')
    accounts = read_accounts(args.accounts)
    missing = [a[1] for a in (COORDINATOR, STUDENT, PARTNER) if a[1] not in accounts]
    if missing:
        raise SystemExit('Missing passwords for: ' + ', '.join(missing) + '. Run manage.py dev-accounts.')
    report = Report()
    run = Run(Api(args.api), args.ai, accounts, report, open_database())
    try:
        run.run()
    finally:
        if run.new_credentials and not args.no_save_credentials:
            write_credentials(args.accounts, run.new_credentials)
            print(f'\nNew intern accounts (inside, outside, lowgps, nophoto) are listed in {args.accounts}')
    return report.summary()


if __name__ == '__main__':
    sys.exit(main())
