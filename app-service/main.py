from datetime import date, datetime, timedelta, timezone
import json
import math
import os
import secrets
from uuid import uuid4
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
import mysql.connector
from db import database
from security import verify_password, token_hash
from student_auth import router as student_router, STUDENT_QUERY, public_student
from coordinator_auth import router as coordinator_router, COORDINATOR_QUERY, public_coordinator
from partner_auth import router as partner_router, PARTNER_QUERY, public_partner, partner
from student_resume import router as resume_router
from applications import router as applications_router
from placements import router as placements_router
from attendance import router as attendance_router
from tasks import router as tasks_router
from reports import router as reports_router
from notifications import router as notifications_router
from audit import router as audit_router
from vault_letters import router as vault_letters_router

app = FastAPI(title='InternConnect App API')
app.include_router(student_router)
app.include_router(coordinator_router)
app.include_router(partner_router)
app.include_router(resume_router)
app.include_router(applications_router)
app.include_router(placements_router)
app.include_router(attendance_router)
app.include_router(tasks_router)
app.include_router(reports_router)
app.include_router(notifications_router)
app.include_router(audit_router)
app.include_router(vault_letters_router)
app.add_middleware(CORSMiddleware,
    allow_origins=[x.strip() for x in os.getenv('IC_APP_ALLOWED_ORIGINS', '').split(',') if x.strip()],
    allow_origin_regex=r'^https?://(localhost|127\.0\.0\.1)(:\d+)?$',
    allow_methods=['GET', 'POST', 'PUT', 'DELETE'], allow_headers=['Content-Type', 'Authorization'])
bearer = HTTPBearer()


@app.exception_handler(mysql.connector.Error)
async def database_error(request, error):
    return JSONResponse(status_code=503, content={'detail': 'Posting database is unavailable. Check server database configuration.'})


@app.exception_handler(RuntimeError)
async def configuration_error(request, error):
    return JSONResponse(status_code=503, content={'detail': 'Posting database is not configured.'})


class Login(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=1024)


class Coordinates(BaseModel):
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(ge=-180, le=180, allow_inf_nan=False)
    source: str = 'browser-gps'


class Posting(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    type: str = Field(pattern=r'^(Internship|Full-time|Part-time) · (Onsite|Hybrid|Remote)$')
    course: str = Field(min_length=1, max_length=150)
    location: str = Field(min_length=1, max_length=500)
    coordinates: Coordinates | None = None
    salary: str = Field(default='', max_length=300)
    description: str = Field(default='', max_length=10000)
    requirements: list[str] = Field(default_factory=list, max_length=100)
    skills: list[list[str]] = Field(min_length=1, max_length=100)
    deadlineISO: str = ''
    deadline: str = Field(default='', max_length=300)
    status: str = Field(default='open', pattern=r'^(open|closed)$')
    onet_soc_code: str | None = Field(default=None, pattern=r'^\d{2}-\d{4}\.\d{2}$')

    @field_validator('title', 'course', 'location')
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError('This field must not be blank.')
        return value.strip()

    @field_validator('skills')
    @classmethod
    def skill_names(cls, rows):
        if any(not row or not row[0].strip() or len(row[0]) > 150 for row in rows):
            raise ValueError('Every skill needs a nonempty name of at most 150 characters.')
        return [[row[0].strip()] for row in rows]

    @field_validator('deadlineISO')
    @classmethod
    def deadline_date(cls, value):
        if value:
            date.fromisoformat(value)
        return value


def posting_json(row):
    payload = json.loads(row['payload']) if isinstance(row['payload'], str) else row['payload']
    return {**payload, 'id': row['id'], 'company': row['company'],
            'coordinates': {'lat': row['latitude'], 'lng': row['longitude'], 'source': (payload.get('coordinates') or {}).get('source', 'browser-gps')} if row['latitude'] is not None and row['longitude'] is not None else None,
            'status': row['status'], 'postedAt': row['posted_at'].isoformat()}


@app.get('/health')
def health():
    with database() as connection:
        cursor = connection.cursor()
        # Check every implemented storage boundary, without loading user records.
        # These identifiers are fixed server constants, never request input.
        for table in ('audit_events', 'companies', 'partner_accounts', 'posting_sessions', 'job_postings',
                      'student_batches', 'student_accounts', 'student_sessions',
                      'coordinator_accounts', 'coordinator_batches', 'coordinator_sessions',
                      'login_attempts', 'partner_profiles', 'student_resumes', 'internship_applications', 'official_placements', 'student_attendance', 'classwork_tasks', 'narrative_reports', 'notification_receipts', 'vault_letters'):
            cursor.execute(f'SELECT * FROM {table} LIMIT 0')
            cursor.fetchall()
    return {'status': 'ok', 'database': 'mysql'}


def authenticate(body: Login, role: str):
    rejection = None
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        email = body.email.strip().lower()
        attempt_key = token_hash(role + ':' + email)
        cursor.execute('DELETE FROM login_attempts WHERE updated_at<UTC_TIMESTAMP()-INTERVAL 1 DAY')
        # The row lock serializes simultaneous attempts for the same email.
        cursor.execute('INSERT INTO login_attempts (attempt_key,failures,updated_at) VALUES (%s,0,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempt_key=VALUES(attempt_key)', (attempt_key,))
        cursor.execute('SELECT failures,blocked_until,UTC_TIMESTAMP() AS now FROM login_attempts WHERE attempt_key=%s FOR UPDATE', (attempt_key,))
        attempt = cursor.fetchone()
        now = attempt['now']
        if attempt['blocked_until'] and attempt['blocked_until'] > now:
            retry = math.ceil((attempt['blocked_until'] - now).total_seconds())
            rejection = HTTPException(429, {'message': 'Too many failed attempts.', 'retry_after': retry}, headers={'Retry-After': str(retry)})
        else:
            query = STUDENT_QUERY + 'WHERE a.email=%s' if role == 'student' else PARTNER_QUERY + 'WHERE a.email=%s'
            if role == 'coordinator':
                query = COORDINATOR_QUERY + 'WHERE a.email=%s ORDER BY o.created_at,o.class_code LIMIT 1'
            cursor.execute(query, (email,))
            account = cursor.fetchone()
            encoded = account['password_hash'] if account else 'pbkdf2_sha256$invalid$' + '0' * 64
            valid_password = verify_password(body.password, encoded)
            if not account or not valid_password:
                failures = 1 if attempt['blocked_until'] else attempt['failures'] + 1
                blocked_until = now + timedelta(minutes=5) if failures >= 5 else None
                cursor.execute('UPDATE login_attempts SET failures=%s,blocked_until=%s,updated_at=UTC_TIMESTAMP() WHERE attempt_key=%s', (failures, blocked_until, attempt_key))
                rejection = (HTTPException(429, {'message': 'Too many failed attempts.', 'retry_after': 300}, headers={'Retry-After': '300'}) if blocked_until else
                             HTTPException(401, {'message': 'Invalid email or password.', 'remaining_attempts': 5 - failures}))
            else:
                cursor.execute('DELETE FROM login_attempts WHERE attempt_key=%s', (attempt_key,))
                if account['status'] != 'active':
                    rejection = HTTPException(403, 'Your account is waiting for approval or is inactive.')
                else:
                    token = secrets.token_urlsafe(32)
                    table = {'student': 'student_sessions', 'coordinator': 'coordinator_sessions', 'partnercompany': 'posting_sessions'}[role]
                    cursor.execute(f'DELETE FROM {table} WHERE expires_at<=UTC_TIMESTAMP()')
                    cursor.execute(f'INSERT INTO {table} (token_hash,account_id,expires_at) VALUES (%s,%s,%s)', (token_hash(token), account['id'], now + timedelta(hours=8)))
    # Raise only after committing failed attempts; the DB context rolls back on errors.
    if rejection:
        raise rejection
    if role == 'student':
        user = public_student(account)
    elif role == 'coordinator':
        user = public_coordinator(account)
    else:
        user = public_partner(account)
    return {'token': token, 'user': user}


@app.post('/api/auth/partner/login')
def login(body: Login):
    return authenticate(body, 'partnercompany')


@app.post('/api/auth/student/login')
def student_login(body: Login):
    return authenticate(body, 'student')


@app.post('/api/auth/coordinator/login')
def coordinator_login(body: Login):
    return authenticate(body, 'coordinator')


@app.get('/api/partner/me')
def partner_profile(account=Depends(partner)):
    return {'user': public_partner(account)}


@app.delete('/api/auth/partner/session')
def logout(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    with database() as connection:
        connection.cursor().execute('DELETE FROM posting_sessions WHERE token_hash=%s', (token_hash(credentials.credentials),))
    return {'ok': True}


@app.get('/api/postings')
def open_postings(class_code: str):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT p.*,c.name AS company FROM job_postings p JOIN companies c ON c.id=p.company_id WHERE c.class_code=%s AND p.status='open' ORDER BY p.posted_at DESC,p.id", (class_code,))
        return {'postings': [posting_json(row) for row in cursor.fetchall()]}


@app.get('/api/partner/postings')
def own_postings(account=Depends(partner)):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute('SELECT p.*,c.name AS company FROM job_postings p JOIN companies c ON c.id=p.company_id WHERE p.company_id=%s ORDER BY p.posted_at DESC,p.id', (account['company_id'],))
        return {'postings': [posting_json(row) for row in cursor.fetchall()]}


@app.post('/api/partner/postings', status_code=201)
def create_posting(body: Posting, account=Depends(partner)):
    posting_id = 'post-' + uuid4().hex
    with database() as connection:
        connection.cursor().execute('INSERT INTO job_postings (id,company_id,payload,latitude,longitude,status,posted_at) VALUES (%s,%s,%s,%s,%s,%s,%s)', (posting_id, account['company_id'], body.model_dump_json(), body.coordinates.lat if body.coordinates else None, body.coordinates.lng if body.coordinates else None, body.status, date.today()))
    return {'id': posting_id}


@app.put('/api/partner/postings/{posting_id}')
def update_posting(posting_id: str, body: Posting, account=Depends(partner)):
    with database() as connection:
        cursor = connection.cursor()
        cursor.execute('SELECT id FROM job_postings WHERE id=%s AND company_id=%s FOR UPDATE', (posting_id, account['company_id']))
        if not cursor.fetchone():
            raise HTTPException(404, 'Posting not found.')
        cursor.execute('UPDATE job_postings SET payload=%s,latitude=%s,longitude=%s,status=%s WHERE id=%s AND company_id=%s', (body.model_dump_json(), body.coordinates.lat if body.coordinates else None, body.coordinates.lng if body.coordinates else None, body.status, posting_id, account['company_id']))
    return {'id': posting_id}
