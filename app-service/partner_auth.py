"""Partner registration and batch-owned approval; legacy provisioned accounts stay active."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import Field, field_validator
import mysql.connector
from db import database
from security import hash_password, token_hash
from student_auth import RegistrationProfile
from coordinator_auth import coordinator, owned_batch, Decision

router = APIRouter()
PARTNER_QUERY = ('SELECT a.*,c.name AS company,c.class_code, '
                 "COALESCE(p.status,'active') AS status,COALESCE(p.category,'') AS category, "
                 "COALESCE(p.avatar,'') AS avatar,p.created_at "
                 'FROM partner_accounts a JOIN companies c ON c.id=a.company_id '
                 'LEFT JOIN partner_profiles p ON p.account_id=a.id ')


def public_partner(row):
    return dict(email=row['email'], name=row['name'], company=row['company'],
                classCode=row['class_code'], category=row.get('category', ''),
                avatar=row.get('avatar', ''), status=row['status'], role='partnercompany',
                theme='sky', sharedPostings=True, databaseAccount=True)


def partner(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(PARTNER_QUERY + 'JOIN posting_sessions s ON s.account_id=a.id WHERE s.token_hash=%s AND s.expires_at>UTC_TIMESTAMP()', (token_hash(credentials.credentials),))
        account = cursor.fetchone()
    if not account:
        raise HTTPException(401, 'Your session expired. Sign in again.')
    if account['status'] != 'active':
        raise HTTPException(403, 'Your partner account is waiting for approval or is inactive.')
    return account


class PartnerRegistration(RegistrationProfile):
    company: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=150)

    @field_validator('company', 'category')
    @classmethod
    def required_text(cls, value):
        if not value.strip():
            raise ValueError('This field is required.')
        return value.strip()


@router.post('/api/auth/partner/register', status_code=201)
def register(body: PartnerRegistration):
    encoded = hash_password(body.password)
    try:
        with database() as connection:
            cursor = connection.cursor(dictionary=True)
            cursor.execute('SELECT b.code FROM student_batches b JOIN coordinator_batches o ON o.class_code=b.code WHERE b.code=%s AND b.status=\'active\' FOR UPDATE', (body.classCode,))
            if not cursor.fetchone():
                raise HTTPException(400, 'Invalid or inactive class code. Ask your coordinator for the correct one.')
            cursor.execute('INSERT INTO companies (name,class_code) VALUES (%s,%s) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)', (body.company, body.classCode))
            company_id = cursor.lastrowid
            cursor.execute('INSERT INTO partner_accounts (email,name,password_hash,company_id) VALUES (%s,%s,%s,%s)', (body.email, body.name, encoded, company_id))
            cursor.execute('INSERT INTO partner_profiles (account_id,category,avatar,status,created_at) VALUES (%s,%s,%s,\'pending\',UTC_TIMESTAMP())', (cursor.lastrowid, body.category, body.avatar))
    except mysql.connector.IntegrityError as error:
        if error.errno == 1062:
            raise HTTPException(409, 'This company email is already registered. Sign in instead.') from None
        raise
    return {'status': 'pending', 'message': 'Account created. Your coordinator must approve it before you can sign in.'}


@router.get('/api/coordinator/partners')
def partners(account=Depends(coordinator)):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(PARTNER_QUERY + 'JOIN coordinator_batches o ON o.class_code=c.class_code WHERE o.coordinator_id=%s', (account['id'],))
        rows = cursor.fetchall()
    return {'partners': [dict(public_partner(row), requestedAt=row['created_at'].date().isoformat() if row['created_at'] else '') for row in rows]}


@router.post('/api/coordinator/batches/{code}/partners/decision')
def decide_partner(code: str, body: Decision, account=Depends(coordinator)):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        batch = owned_batch(cursor, code, account)
        if body.action == 'approve' and batch['status'] != 'active':
            raise HTTPException(400, 'Reopen this batch before approving partners.')
        cursor.execute(PARTNER_QUERY + 'WHERE a.email=%s AND c.class_code=%s FOR UPDATE', (body.email.strip().lower(), code))
        row = cursor.fetchone()
        if not row or row['status'] != 'pending':
            raise HTTPException(409, 'This request was already handled or is no longer available.')
        if body.action == 'approve':
            cursor.execute("UPDATE partner_profiles SET status='active' WHERE account_id=%s", (row['id'],))
        else:
            cursor.execute('DELETE FROM posting_sessions WHERE account_id=%s', (row['id'],))
            cursor.execute('DELETE FROM partner_profiles WHERE account_id=%s', (row['id'],))
            cursor.execute('DELETE FROM partner_accounts WHERE id=%s', (row['id'],))
    return {'ok': True}
