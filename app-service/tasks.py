"""Batch-owned classwork, including downloadable templates and attachments."""
import base64
import json
import re
from datetime import date
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
import mysql.connector
from db import database
from coordinator_auth import coordinator, owned_batch
from student_auth import student

router=APIRouter()


class Task(BaseModel):
    classCode: str = Field(min_length=1,max_length=100)
    title: str = Field(min_length=1,max_length=200)
    instructions: str = Field(default='',max_length=15000)
    dueDate: str = Field(default='',max_length=10)
    dueTime: str = Field(default='23:59',pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    maxPoints: float = Field(default=100,gt=0,le=10000,allow_inf_nan=False)
    repeat: str = Field(default='',pattern=r'^(|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$')
    status: str = Field(default='open',pattern=r'^(open|closed|archived)$')
    template: str | None = Field(default=None,max_length=255)
    templateData: str = Field(default='',max_length=1000100)
    attachments: list[str] = Field(default_factory=list,max_length=10)
    attachmentData: list[str] = Field(default_factory=list,max_length=10)

    @model_validator(mode='after')
    def valid_content(self):
        if not self.title.strip():
            raise ValueError('Enter a task title.')
        if self.dueDate:
            date.fromisoformat(self.dueDate)
        if len(self.attachments)!=len(self.attachmentData) or any(not name or len(name)>255 for name in self.attachments):
            raise ValueError('Each attachment needs its file and name.')
        if bool(self.template)!=bool(self.templateData):
            raise ValueError('Choose the template file again.')
        total=0
        for data in ([self.templateData] if self.templateData else [])+self.attachmentData:
            if len(data)>1000100 or not re.fullmatch(r'data:[\w.+/-]*;base64,[A-Za-z0-9+/=]*',data):
                raise ValueError('Invalid task file.')
            try:
                size=len(base64.b64decode(data.split(',',1)[1],validate=True))
            except ValueError:
                raise ValueError('Invalid task file.') from None
            if size>750000:
                raise ValueError('Each task file must be under 750 KB.')
            total+=size
        if total>2000000:
            raise ValueError('Task files must be under 2 MB together.')
        return self


@router.post('/api/coordinator/tasks',status_code=201)
def create(body:Task,account=Depends(coordinator)):
    key='task-'+uuid4().hex
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        batch=owned_batch(cursor,body.classCode,account)
        if batch['status']!='active':
            raise HTTPException(409,'Reopen this batch before creating tasks.')
        cursor.execute('INSERT INTO classwork_tasks (id,class_code,payload,created_at,updated_at) VALUES (%s,%s,%s,UTC_TIMESTAMP(),UTC_TIMESTAMP())',(key,body.classCode,body.model_dump_json()))
    return {'id':key}


@router.put('/api/coordinator/tasks/{task_id}')
def update(task_id:str,body:Task,account=Depends(coordinator)):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        owned_batch(cursor,body.classCode,account)
        cursor.execute('SELECT id FROM classwork_tasks WHERE id=%s AND class_code=%s FOR UPDATE',(task_id,body.classCode))
        if not cursor.fetchone():
            raise HTTPException(404,'Task not found.')
        cursor.execute('SELECT MAX(score) AS highest FROM narrative_reports WHERE task_id=%s',(task_id,))
        highest=cursor.fetchone()['highest']
        if highest is not None and body.maxPoints<highest:
            raise HTTPException(409,'Maximum points cannot be lower than an existing grade.')
        cursor.execute('UPDATE classwork_tasks SET payload=%s,updated_at=UTC_TIMESTAMP() WHERE id=%s',(body.model_dump_json(),task_id))
    return {'ok':True}


@router.delete('/api/coordinator/tasks/{task_id}')
def delete(task_id:str,account=Depends(coordinator)):
    try:
        with database() as connection:
            cursor=connection.cursor(dictionary=True)
            cursor.execute('SELECT t.id FROM classwork_tasks t JOIN coordinator_batches o ON o.class_code=t.class_code WHERE t.id=%s AND o.coordinator_id=%s FOR UPDATE',(task_id,account['id']))
            if not cursor.fetchone():
                raise HTTPException(404,'Task not found.')
            cursor.execute('DELETE FROM classwork_tasks WHERE id=%s',(task_id,))
    except mysql.connector.IntegrityError as error:
        if error.errno==1451:
            raise HTTPException(409,'This task has submissions. Archive it to preserve them.') from None
        raise
    return {'ok':True}


def read_tasks(where,args):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        cursor.execute('SELECT t.* FROM classwork_tasks t '+where+' ORDER BY t.created_at DESC,t.id',args)
        tasks=[]
        for row in cursor.fetchall():
            payload=json.loads(row['payload']) if isinstance(row['payload'],str) else row['payload']
            tasks.append(dict(payload,id=row['id'],classCode=row['class_code'],databaseTask=True,turnedIn=0,total=0,approvedLogs=0))
        return {'tasks':tasks}


@router.get('/api/coordinator/tasks')
def batches(account=Depends(coordinator)):
    return read_tasks('JOIN coordinator_batches o ON o.class_code=t.class_code WHERE o.coordinator_id=%s',(account['id'],))


@router.get('/api/student/tasks')
def mine(account=Depends(student)):
    return read_tasks("WHERE t.class_code=%s AND JSON_UNQUOTE(JSON_EXTRACT(t.payload,'$.status'))!='archived'",(account['class_code'],))
