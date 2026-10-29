"""Student registration and session records; batches are provisioned by the server admin."""
import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator
import mysql.connector
from db import database
from security import hash_password, token_hash

router = APIRouter(prefix='/api/auth/student')
bearer = HTTPBearer()
STUDENT_QUERY = ('SELECT a.*,b.program,b.school,b.theme,b.status AS batch_status '
                 'FROM student_accounts a JOIN student_batches b ON b.code=a.class_code ')


def public_student(account):
    return dict(email=account['email'], name=account['name'], role='student',
                studentNumber=account['student_number'], classCode=account['class_code'],
                program=account['program'], school=account['school'], theme=account['theme'],
                schoolEmail=account['school_email'], personalEmail=account['personal_email'],
                avatar=account['avatar'], status=account['status'], databaseAccount=True)


class RegistrationProfile(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=1024)
    name: str = Field(min_length=1, max_length=150)
    classCode: str = Field(min_length=1, max_length=100, pattern=r'^[A-Za-z0-9_-]+$')
    program: str = Field(min_length=1, max_length=150)
    schoolEmail: str = Field(default='', max_length=254)
    personalEmail: str = Field(default='', max_length=254)
    avatar: str = Field(default='', max_length=100000)

    @field_validator('email', 'schoolEmail', 'personalEmail')
    @classmethod
    def email_format(cls, value, info):
        value = value.strip().lower()
        if not value and info.field_name != 'email':
            return ''
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.(?:edu|edu\.ph|com)', value, re.I):
            raise ValueError('Use a valid email ending in .edu, .edu.ph, or .com.')
        return value

    @field_validator('name', 'classCode', 'program')
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError('This field is required.')
        return value.strip()

    @field_validator('password')
    @classmethod
    def strong_password(cls, value):
        if not all(re.search(pattern, value) for pattern in (r'[A-Z]', r'[a-z]', r'[0-9]', r'[^A-Za-z0-9]')):
            raise ValueError('Include uppercase, lowercase, number and special character.')
        return value

    @field_validator('avatar')
    @classmethod
    def avatar_format(cls, value):
        if value and not re.fullmatch(r'data:image/jpeg;base64,[A-Za-z0-9+/=]+', value):
            raise ValueError('Use the profile photo picker.')
        return value


class StudentRegistration(RegistrationProfile):
    studentNumber: str = Field(min_length=1, max_length=100)

    @field_validator('studentNumber')
    @classmethod
    def student_number(cls, value):
        if not value.strip():
            raise ValueError('Student number is required.')
        return value.strip()


@router.post('/register', status_code=201)
def register(body: StudentRegistration):
    # Hash before opening a transaction; never store a plaintext password.
    encoded = hash_password(body.password)
    try:
        with database() as connection:
            cursor = connection.cursor(dictionary=True)
            cursor.execute('SELECT * FROM student_batches WHERE code=%s FOR UPDATE', (body.classCode,))
            batch = cursor.fetchone()
            if not batch or batch['status'] != 'active':
                raise HTTPException(400, 'Invalid or inactive class code. Ask your coordinator for the correct code.')
            if batch['program'] != body.program:
                raise HTTPException(400, 'This class code belongs to a different program.')
            cursor.execute('INSERT INTO student_accounts (email,password_hash,name,student_number,class_code,school_email,personal_email,avatar,created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,UTC_TIMESTAMP())',
                           (body.email, encoded, body.name, body.studentNumber, body.classCode, body.schoolEmail, body.personalEmail, body.avatar))
    except mysql.connector.IntegrityError as error:
        if error.errno == 1062:
            raise HTTPException(409, 'This student email is already registered. Sign in instead.') from None
        raise
    return {'message': 'Account created. Your class membership is waiting for approval.', 'status': 'pending'}


def student(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(STUDENT_QUERY + 'JOIN student_sessions s ON s.account_id=a.id WHERE s.token_hash=%s AND s.expires_at>UTC_TIMESTAMP()', (token_hash(credentials.credentials),))
        account = cursor.fetchone()
    if not account:
        raise HTTPException(401, 'Your session expired. Sign in again.')
    if account['status'] != 'active':
        raise HTTPException(403, 'Your student account is waiting for approval or is inactive.')
    return account


@router.get('/me')
def me(account=Depends(student)):
    import json
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute('SELECT payload FROM student_resumes WHERE account_id=%s', (account['id'],))
        row = cursor.fetchone()
    payload = row['payload'] if row else None
    return {'user': public_student(account), 'resume': json.loads(payload) if isinstance(payload, str) else payload}


@router.delete('/session')
def logout(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    with database() as connection:
        connection.cursor().execute('DELETE FROM student_sessions WHERE token_hash=%s', (token_hash(credentials.credentials),))
    return {'ok': True}
