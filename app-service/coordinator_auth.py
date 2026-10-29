"""Coordinator identities and ownership of batches and student join requests."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator
import mysql.connector
from db import database
from security import hash_password, token_hash
from student_auth import RegistrationProfile, STUDENT_QUERY, public_student

router = APIRouter()
bearer = HTTPBearer()
COORDINATOR_QUERY = ('SELECT a.*,o.class_code FROM coordinator_accounts a '
                     'LEFT JOIN coordinator_batches o ON o.coordinator_id=a.id ')


def public_coordinator(account):
    return dict(email=account['email'], name=account['name'], role='coordinator',
                classCode=account.get('class_code') or '', program=account['program'],
                school=account['school'], theme=account['theme'], schoolEmail=account['school_email'],
                personalEmail=account['personal_email'], avatar=account['avatar'],
                status=account['status'], databaseAccount=True)


class CoordinatorRegistration(RegistrationProfile):
    school: str = Field(min_length=1, max_length=200)
    theme: str = Field(default='sky', pattern=r'^(sky|emerald|rose)$')

    @field_validator('school')
    @classmethod
    def school_name(cls, value):
        if not value.strip():
            raise ValueError('School is required.')
        return value.strip()


class BatchCreate(BaseModel):
    code: str = Field(min_length=1, max_length=100, pattern=r'^[A-Za-z0-9_-]+$')
    term: str = Field(min_length=1, max_length=150)

    @field_validator('code', 'term')
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError('This field is required.')
        return value.strip()


class BatchUpdate(BaseModel):
    term: str | None = Field(default=None, min_length=1, max_length=150)
    status: str | None = Field(default=None, pattern=r'^(active|closed|archived)$')


def coordinator(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute('SELECT a.* FROM coordinator_accounts a JOIN coordinator_sessions s ON s.account_id=a.id WHERE s.token_hash=%s AND s.expires_at>UTC_TIMESTAMP()', (token_hash(credentials.credentials),))
        account = cursor.fetchone()
    if not account:
        raise HTTPException(401, 'Your session expired. Sign in again.')
    if account['status'] != 'active':
        raise HTTPException(403, 'Your coordinator account is inactive.')
    return account


def owned_batch(cursor, code, account):
    cursor.execute('SELECT b.* FROM student_batches b JOIN coordinator_batches o ON o.class_code=b.code WHERE b.code=%s AND o.coordinator_id=%s FOR UPDATE', (code, account['id']))
    batch = cursor.fetchone()
    if not batch:
        raise HTTPException(404, 'Batch not found.')
    return batch


@router.post('/api/auth/coordinator/register', status_code=201)
def register(body: CoordinatorRegistration):
    encoded = hash_password(body.password)
    try:
        with database() as connection:
            cursor = connection.cursor()
            cursor.execute('INSERT INTO coordinator_accounts (email,password_hash,name,program,school,theme,school_email,personal_email,avatar,created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,UTC_TIMESTAMP())',
                           (body.email, encoded, body.name, body.program, body.school, body.theme, body.schoolEmail, body.personalEmail, body.avatar))
            account_id = cursor.lastrowid
            cursor.execute('INSERT INTO student_batches (code,program,school,theme) VALUES (%s,%s,%s,%s)', (body.classCode, body.program, body.school, body.theme))
            cursor.execute('INSERT INTO coordinator_batches (class_code,coordinator_id,created_at) VALUES (%s,%s,UTC_TIMESTAMP())', (body.classCode, account_id))
    except mysql.connector.IntegrityError as error:
        if error.errno == 1062:
            raise HTTPException(409, 'This email or class code is already registered. Use a new class code, or sign in.') from None
        raise
    return {'message': 'Coordinator account and initial batch created.'}


@router.get('/api/coordinator/state')
def state(account=Depends(coordinator)):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute('SELECT b.*,o.term,o.created_at FROM student_batches b JOIN coordinator_batches o ON o.class_code=b.code WHERE o.coordinator_id=%s ORDER BY o.created_at,b.code', (account['id'],))
        batches = cursor.fetchall()
        cursor.execute(STUDENT_QUERY + 'JOIN coordinator_batches o ON o.class_code=a.class_code WHERE o.coordinator_id=%s', (account['id'],))
        students = [dict(public_student(row), requestedAt=row['created_at'].date().isoformat()) for row in cursor.fetchall()]
    account['class_code'] = batches[0]['code'] if batches else ''
    return {'user': public_coordinator(account), 'batches': [dict(code=b['code'], program=b['program'], school=b['school'], theme=b['theme'], status=b['status'], term=b['term'], createdAt=b['created_at'].date().isoformat(), coordinator=account['email']) for b in batches], 'students': students}


@router.delete('/api/auth/coordinator/session')
def logout(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    with database() as connection:
        connection.cursor().execute('DELETE FROM coordinator_sessions WHERE token_hash=%s', (token_hash(credentials.credentials),))
    return {'ok': True}


@router.post('/api/coordinator/batches', status_code=201)
def create_batch(body: BatchCreate, account=Depends(coordinator)):
    try:
        with database() as connection:
            cursor = connection.cursor()
            cursor.execute('INSERT INTO student_batches (code,program,school,theme) VALUES (%s,%s,%s,%s)', (body.code, account['program'], account['school'], account['theme']))
            cursor.execute('INSERT INTO coordinator_batches (class_code,coordinator_id,term,created_at) VALUES (%s,%s,%s,UTC_TIMESTAMP())', (body.code, account['id'], body.term))
    except mysql.connector.IntegrityError as error:
        if error.errno == 1062:
            raise HTTPException(409, 'This class code is already registered.') from None
        raise
    return {'code': body.code}


@router.put('/api/coordinator/batches/{code}')
def update_batch(code: str, body: BatchUpdate, account=Depends(coordinator)):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        owned_batch(cursor, code, account)
        if body.term is not None:
            if not body.term.strip():
                raise HTTPException(400, 'Batch name is required.')
            cursor.execute('UPDATE coordinator_batches SET term=%s WHERE class_code=%s', (body.term.strip(), code))
        if body.status:
            cursor.execute('UPDATE student_batches SET status=%s WHERE code=%s', (body.status, code))
    return {'ok': True}


@router.delete('/api/coordinator/batches/{code}')
def delete_batch(code: str, account=Depends(coordinator)):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        # Lock the coordinator too, so concurrent deletes cannot remove their last batch.
        cursor.execute('SELECT id FROM coordinator_accounts WHERE id=%s FOR UPDATE', (account['id'],))
        cursor.fetchone()
        owned_batch(cursor, code, account)
        cursor.execute('SELECT COUNT(*) AS count FROM coordinator_batches WHERE coordinator_id=%s', (account['id'],))
        if cursor.fetchone()['count'] <= 1:
            raise HTTPException(400, 'Keep at least one batch.')
        cursor.execute('SELECT COUNT(*) AS count FROM student_accounts WHERE class_code=%s', (code,))
        if cursor.fetchone()['count']:
            raise HTTPException(400, 'This batch contains students. Archive it to preserve records.')
        cursor.execute('SELECT COUNT(*) AS count FROM companies WHERE class_code=%s', (code,))
        if cursor.fetchone()['count']:
            raise HTTPException(400, 'This batch contains partner companies. Archive it to preserve records.')
        cursor.execute('DELETE FROM coordinator_batches WHERE class_code=%s', (code,))
        cursor.execute('DELETE FROM student_batches WHERE code=%s', (code,))
    return {'ok': True}


class Decision(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    action: str = Field(pattern=r'^(approve|reject)$')


@router.post('/api/coordinator/batches/{code}/students/decision')
def decide_student(code: str, body: Decision, account=Depends(coordinator)):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        batch = owned_batch(cursor, code, account)
        if body.action == 'approve' and batch['status'] != 'active':
            raise HTTPException(400, 'Reopen this batch before approving students.')
        cursor.execute('SELECT id,status FROM student_accounts WHERE email=%s AND class_code=%s FOR UPDATE', (body.email.strip().lower(), code))
        student = cursor.fetchone()
        if not student or student['status'] != 'pending':
            raise HTTPException(409, 'This request was already handled or is no longer available.')
        if body.action == 'approve':
            cursor.execute("UPDATE student_accounts SET status='active' WHERE id=%s", (student['id'],))
        else:
            cursor.execute('DELETE FROM student_sessions WHERE account_id=%s', (student['id'],))
            cursor.execute('DELETE FROM student_accounts WHERE id=%s', (student['id'],))
    return {'ok': True}
