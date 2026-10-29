"""Narrative report submission, review and grading under batch ownership."""
import json
import re
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from db import database
from student_auth import student
from coordinator_auth import coordinator

router=APIRouter()


class Submission(BaseModel):
    raw: str = Field(min_length=1,max_length=30000)

    @model_validator(mode='after')
    def not_blank(self):
        if not self.raw.strip():
            raise ValueError('Write your report first.')
        return self


def bullet(raw):
    first=next((re.sub(r'^[\s\-•*]+','',line).strip() for line in raw.splitlines() if re.sub(r'^[\s\-•*]+','',line).strip()),'')
    first=first.rstrip('. ')[:160]
    return first[:1].upper()+first[1:]+'.' if first else ''


@router.post('/api/student/tasks/{task_id}/report')
def submit(task_id:str,body:Submission,account=Depends(student)):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        cursor.execute('SELECT payload FROM classwork_tasks WHERE id=%s AND class_code=%s FOR UPDATE',(task_id,account['class_code']))
        task=cursor.fetchone()
        if not task:
            raise HTTPException(404,'Task not found.')
        payload=json.loads(task['payload']) if isinstance(task['payload'],str) else task['payload']
        if payload['status']!='open':
            raise HTTPException(409,'Submissions for this task are closed.')
        cursor.execute('SELECT status FROM narrative_reports WHERE task_id=%s AND student_id=%s FOR UPDATE',(task_id,account['id']))
        previous=cursor.fetchone()
        if previous and previous['status']!='Needs Revision':
            raise HTTPException(409,'This report has already been submitted. Wait for coordinator feedback.')
        cursor.execute("INSERT INTO narrative_reports (task_id,student_id,raw,bullet,status,submitted_at,version) VALUES (%s,%s,%s,%s,'Pending Review',UTC_TIMESTAMP(),1) ON DUPLICATE KEY UPDATE raw=VALUES(raw),bullet=VALUES(bullet),status='Pending Review',submitted_at=UTC_TIMESTAMP(),version=version+1,feedback='',score=NULL,grade_feedback='',reviewed_by=NULL,reviewed_at=NULL",(task_id,account['id'],body.raw.strip(),bullet(body.raw)))
    return {'ok':True}


QUERY='SELECT r.*,s.email,s.name,t.payload AS task_payload,c.name AS company FROM narrative_reports r JOIN student_accounts s ON s.id=r.student_id JOIN classwork_tasks t ON t.id=r.task_id LEFT JOIN official_placements p ON p.student_id=s.id LEFT JOIN internship_applications a ON a.id=p.application_id LEFT JOIN companies c ON c.id=a.company_id '


def read(where,args):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        cursor.execute(QUERY+where+' ORDER BY r.submitted_at,r.student_id',args)
        reports=[]
        for row in cursor.fetchall():
            task=json.loads(row['task_payload']) if isinstance(row['task_payload'],str) else row['task_payload']
            # UTC storage, Philippine calendar/time for display and due-date comparisons.
            submitted=row['submitted_at']+timedelta(hours=8)
            date=submitted.strftime('%Y-%m-%d')
            due=task.get('dueDate','')
            late=bool(due and submitted.strftime('%Y-%m-%d %H:%M')>due+' '+task.get('dueTime','23:59'))
            reports.append(dict(taskId=row['task_id'],taskTitle=task['title'],email=row['email'],name=row['name'],
                raw=row['raw'],bullet=row['bullet'],company=row['company'] or '',date=date,status=row['status'],
                feedback=row['feedback'],score=row['score'],gradeFeedback=row['grade_feedback'],version=row['version'],
                late=late,databaseReport=True,meta=date+' · '+(row['company'] or 'Not placed')+(' · Late' if late else '')))
        return {'reports':reports}


@router.get('/api/student/reports')
def mine(account=Depends(student)):
    return read('WHERE r.student_id=%s',(account['id'],))


@router.get('/api/coordinator/reports')
def batches(account=Depends(coordinator)):
    return read('JOIN coordinator_batches o ON o.class_code=s.class_code WHERE o.coordinator_id=%s',(account['id'],))


class Decision(BaseModel):
    email: str = Field(min_length=3,max_length=254)
    version: int = Field(ge=1)
    status: str | None = Field(default=None,pattern=r'^(Verified|Needs Revision|Rejected)$')
    feedback: str = Field(default='',max_length=3000)
    score: float | None = Field(default=None,ge=0,allow_inf_nan=False)


@router.put('/api/coordinator/tasks/{task_id}/report')
def decide(task_id:str,body:Decision,account=Depends(coordinator)):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        cursor.execute('SELECT t.payload FROM classwork_tasks t JOIN coordinator_batches o ON o.class_code=t.class_code WHERE t.id=%s AND o.coordinator_id=%s FOR UPDATE',(task_id,account['id']))
        task=cursor.fetchone()
        if not task:
            raise HTTPException(404,'Task not found.')
        cursor.execute('SELECT r.* FROM narrative_reports r JOIN student_accounts s ON s.id=r.student_id WHERE r.task_id=%s AND s.email=%s FOR UPDATE',(task_id,body.email.strip().lower()))
        report=cursor.fetchone()
        if not report:
            raise HTTPException(404,'Report not found.')
        if report['version']!=body.version:
            raise HTTPException(409,'This report changed. Refresh before reviewing it.')
        payload=json.loads(task['payload']) if isinstance(task['payload'],str) else task['payload']
        if body.status:
            if report['status']!='Pending Review':
                raise HTTPException(409,'This report has already been reviewed. Refresh to see the decision.')
            if body.status!='Verified' and not body.feedback.strip():
                raise HTTPException(400,'Explain the revision or rejection to the student.')
            cursor.execute('UPDATE narrative_reports SET status=%s,feedback=%s,reviewed_by=%s,reviewed_at=UTC_TIMESTAMP() WHERE task_id=%s AND student_id=%s',(body.status,body.feedback,account['id'],task_id,report['student_id']))
        if body.score is not None:
            if body.score>payload['maxPoints']:
                raise HTTPException(400,'Grade exceeds the maximum points for this task.')
            cursor.execute('UPDATE narrative_reports SET score=%s,grade_feedback=%s WHERE task_id=%s AND student_id=%s',(body.score,body.feedback,task_id,report['student_id']))
    return {'ok':True}
