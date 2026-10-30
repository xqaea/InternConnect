"""Applications retain the exact saved resume at submission time."""
import json
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import mysql.connector
from db import database
from student_auth import student, public_student
from partner_auth import partner
from coordinator_auth import coordinator

router = APIRouter()
QUERY = 'SELECT a.*,s.email,s.name,s.class_code,s.student_number,b.program,c.name AS company FROM internship_applications a JOIN student_accounts s ON s.id=a.student_id JOIN student_batches b ON b.code=s.class_code JOIN companies c ON c.id=a.company_id '


def decode(value):
    return json.loads(value) if isinstance(value, str) else value


def public_application(row):
    return dict(id=row['id'], job=row['posting_id'], title=row['title'], company=row['company'],
                date=row['created_at'].date().isoformat(), status=row['status'],
                internship=bool(row['internship']), email=row['email'], name=row['name'],
                classCode=row['class_code'], program=row['program'], databaseApplication=True,
                resume=decode(row['resume_snapshot']))


class Apply(BaseModel):
    postingId: str = Field(min_length=1, max_length=64)


@router.post('/api/student/applications', status_code=201)
def apply(body: Apply, account=Depends(student)):
    try:
        with database() as connection:
            cursor = connection.cursor(dictionary=True)
            # Serialize concurrent applications from this student.
            cursor.execute('SELECT id FROM student_accounts WHERE id=%s FOR UPDATE', (account['id'],))
            cursor.fetchone()
            cursor.execute("SELECT p.*,c.class_code FROM job_postings p JOIN companies c ON c.id=p.company_id WHERE p.id=%s AND c.class_code=%s FOR UPDATE", (body.postingId, account['class_code']))
            posting = cursor.fetchone()
            if not posting or posting['status'] != 'open':
                raise HTTPException(400, 'This posting is no longer available.')
            job = decode(posting['payload'])
            if job.get('deadlineISO') and date.fromisoformat(job['deadlineISO']) < date.today():
                raise HTTPException(400, 'The application deadline has passed.')
            internship = job['type'].startswith('Internship')
            if internship:
                cursor.execute("SELECT id FROM internship_applications WHERE student_id=%s AND internship=1 AND status IN ('Pending','Accepted') LIMIT 1", (account['id'],))
                if cursor.fetchone():
                    raise HTTPException(409, 'You already have an active internship application.')
            cursor.execute('SELECT payload FROM student_resumes WHERE account_id=%s', (account['id'],))
            saved = cursor.fetchone()
            resume = decode(saved['payload']) if saved else None
            if not resume or not resume.get('savedAt') or not resume.get('hard'):
                raise HTTPException(400, 'Save your resume with at least one technical skill before applying.')
            snapshot = dict(resume, profile=public_student(account))
            cursor.execute("INSERT INTO internship_applications (student_id,posting_id,company_id,title,internship,resume_snapshot,status,created_at,updated_at) VALUES (%s,%s,%s,%s,%s,%s,'Pending',UTC_TIMESTAMP(),UTC_TIMESTAMP())", (account['id'], body.postingId, posting['company_id'], job['title'], internship, json.dumps(snapshot)))
    except mysql.connector.IntegrityError as error:
        if error.errno == 1062:
            raise HTTPException(409, 'You already applied to this posting.') from None
        raise
    return {'ok': True}


@router.get('/api/student/applications')
def mine(account=Depends(student)):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(QUERY + 'WHERE a.student_id=%s ORDER BY a.created_at,a.id', (account['id'],))
        return {'applications': [public_application(row) for row in cursor.fetchall()]}


@router.get('/api/partner/applications')
def company_applications(account=Depends(partner)):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(QUERY + 'WHERE a.company_id=%s ORDER BY a.created_at,a.id', (account['company_id'],))
        return {'applications': [public_application(row) for row in cursor.fetchall()]}


@router.get('/api/coordinator/applications')
def batch_applications(account=Depends(coordinator)):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(QUERY + 'JOIN coordinator_batches o ON o.class_code=s.class_code WHERE o.coordinator_id=%s ORDER BY a.created_at,a.id', (account['id'],))
        return {'applications': [public_application(row) for row in cursor.fetchall()]}


class Status(BaseModel):
    status: str = Field(pattern=r'^(Pending|Accepted|Not Selected)$')


@router.put('/api/partner/applications/{application_id}')
def decide(application_id: int, body: Status, account=Depends(partner)):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute('SELECT id,status FROM internship_applications WHERE id=%s AND company_id=%s FOR UPDATE', (application_id, account['company_id']))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(404, 'Application not found.')
        if row['status'] != 'Pending' and body.status != row['status']:
            raise HTTPException(409, 'This application already has a final decision. Refresh to see its status.')
        cursor.execute('UPDATE internship_applications SET status=%s,updated_at=UTC_TIMESTAMP() WHERE id=%s', (body.status, application_id))
    return {'ok': True}
