"""A single signed-letter record shared by its company, coordinator and student."""
import json
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from db import database
from coordinator_auth import coordinator
from partner_auth import partner
from student_auth import student
from placements import Evidence

router=APIRouter()
ELIGIBLE=("SELECT s.id,s.email,s.name FROM student_accounts s WHERE s.class_code=%s AND "
          "EXISTS(SELECT 1 FROM internship_applications a WHERE a.student_id=s.id AND a.company_id=%s "
          "AND a.internship=1 AND a.status IN ('Pending','Accepted'))")
FILES=('SELECT d.*,s.email,s.name AS student_name,c.name AS company,c.class_code '
       'FROM vault_letters d JOIN student_accounts s ON s.id=d.student_id JOIN companies c ON c.id=d.company_id ')
METADATA=FILES.replace('d.*',"d.id,d.company_id,d.student_id,d.kind,d.owner_role,d.owner_id,d.version,d.updated_at,JSON_OBJECT('name',JSON_UNQUOTE(JSON_EXTRACT(d.payload,'$.name'))) AS payload")


class Upload(BaseModel):
    company: str = Field(min_length=1,max_length=200)
    classCode: str = Field(min_length=1,max_length=100)
    email: str = Field(min_length=1,max_length=254)
    kind: Literal['endorsement','acceptance']
    file: Evidence
    version: int = Field(default=0,ge=0)


def company_scope(cursor,role,account,company,code):
    if role=='coordinator':
        cursor.execute('SELECT c.* FROM companies c JOIN coordinator_batches o ON o.class_code=c.class_code WHERE c.name=%s AND c.class_code=%s AND o.coordinator_id=%s',(company,code,account['id']))
    else:
        cursor.execute('SELECT * FROM companies WHERE id=%s AND name=%s AND class_code=%s',(account['company_id'],company,code))
    found=cursor.fetchone()
    if not found: raise HTTPException(404,'Company vault not found.')
    return found


def metadata(row,role=None,account=None):
    file=json.loads(row['payload']) if isinstance(row['payload'],str) else row['payload']
    return dict(id=row['id'],kind=row['kind'],name=file['name'],email=row['email'],studentId=row['student_id'],
                studentName=row['student_name'],company=row['company'],version=row['version'],
                owner='hr' if row['owner_role']=='partner' else 'coordinator',
                canEdit=bool(account and role==row['owner_role'] and account['id']==row['owner_id']),
                uploadedAt=row['updated_at'].date().isoformat())


def list_letters(role,account,company,code):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        owned=company_scope(cursor,role,account,company,code)
        cursor.execute(ELIGIBLE,(code,owned['id']))
        interns=cursor.fetchall()
        cursor.execute(METADATA+'WHERE d.company_id=%s ORDER BY d.id',(owned['id'],))
        files=[metadata(row,role,account) for row in cursor.fetchall()]
    return {'interns':interns,'files':files}


def scoped_file(cursor,file_id,role,account):
    if role=='student':
        where,args='d.student_id=%s',(account['id'],)
    elif role=='partner':
        where,args='d.company_id=%s',(account['company_id'],)
    else:
        where,args='EXISTS(SELECT 1 FROM coordinator_batches o WHERE o.class_code=c.class_code AND o.coordinator_id=%s)',(account['id'],)
    cursor.execute(FILES+'WHERE d.id=%s AND '+where,(file_id,*args))
    row=cursor.fetchone()
    if not row: raise HTTPException(404,'Letter not found.')
    return row


def read_letter(file_id,role,account):
    with database() as connection:
        row=scoped_file(connection.cursor(dictionary=True),file_id,role,account)
    file=json.loads(row['payload']) if isinstance(row['payload'],str) else row['payload']
    return JSONResponse({'document':file},headers={'Cache-Control':'no-store'})


def audit(cursor,company,role,account,student_id,file_id,action):
    cursor.execute('INSERT INTO audit_events (class_code,actor_role,actor_id,subject_id,resource_id,action,status,created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,UTC_TIMESTAMP())',
                   (company['class_code'],role,account['id'],student_id,'letter-'+str(file_id),action,'Success'))


def upload_letter(body,role,account):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        company=company_scope(cursor,role,account,body.company,body.classCode)
        cursor.execute(ELIGIBLE+' AND s.email=%s FOR UPDATE',(body.classCode,company['id'],body.email.strip().lower()))
        intern=cursor.fetchone()
        if not intern: raise HTTPException(404,'This student has no internship application with this company.')
        cursor.execute('SELECT * FROM vault_letters WHERE company_id=%s AND student_id=%s AND kind=%s FOR UPDATE',(company['id'],intern['id'],body.kind))
        existing=cursor.fetchone()
        if existing:
            if existing['owner_role']!=role or existing['owner_id']!=account['id']:
                raise HTTPException(403,'Only the uploader can replace this letter.')
            if existing['version']!=body.version: raise HTTPException(409,'This letter changed. Refresh the vault before replacing it.')
            cursor.execute("UPDATE vault_letters SET history=JSON_ARRAY_APPEND(history,'$',JSON_OBJECT('file',JSON_EXTRACT(payload,'$'),'version',version,'uploadedAt',updated_at)),payload=%s,version=version+1,updated_at=UTC_TIMESTAMP() WHERE id=%s",(body.file.model_dump_json(),existing['id']))
            file_id=existing['id']
        else:
            if body.version: raise HTTPException(409,'This letter was removed. Refresh the vault.')
            cursor.execute("INSERT INTO vault_letters (company_id,student_id,kind,payload,history,owner_role,owner_id,version,updated_at) VALUES (%s,%s,%s,%s,JSON_ARRAY(),%s,%s,1,UTC_TIMESTAMP())",(company['id'],intern['id'],body.kind,body.file.model_dump_json(),role,account['id']))
            file_id=cursor.lastrowid
        audit(cursor,company,role,account,intern['id'],file_id,('Replaced ' if existing else 'Uploaded ')+body.kind+' letter')
    return {'id':file_id}


def delete_letter(file_id,role,account):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        row=scoped_file(cursor,file_id,role,account)
        if row['owner_role']!=role or row['owner_id']!=account['id']:
            raise HTTPException(403,'Only the uploader can delete this letter.')
        cursor.execute('SELECT id FROM student_accounts WHERE id=%s FOR UPDATE',(row['student_id'],))
        cursor.fetchone()
        cursor.execute('SELECT p.student_id FROM official_placements p JOIN internship_applications a ON a.id=p.application_id WHERE p.student_id=%s AND a.company_id=%s',(row['student_id'],row['company_id']))
        if cursor.fetchone(): raise HTTPException(409,'Letters for a confirmed placement are retained. Upload a replacement if needed.')
        cursor.execute('DELETE FROM vault_letters WHERE id=%s AND version=%s',(file_id,row['version']))
        if cursor.rowcount!=1: raise HTTPException(409,'This letter changed. Refresh the vault.')
        audit(cursor,row,role,account,row['student_id'],file_id,'Deleted '+row['kind']+' letter')
    return {'ok':True}


def student_metadata(account):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        cursor.execute(METADATA+'WHERE d.student_id=%s ORDER BY d.id DESC',(account['id'],))
        return [metadata(row) for row in cursor.fetchall()]


@router.get('/api/coordinator/vault/letters')
def coordinator_list(company:str,class_code:str,account=Depends(coordinator)):
    return list_letters('coordinator',account,company,class_code)

@router.get('/api/partner/vault/letters')
def partner_list(company:str,class_code:str,account=Depends(partner)):
    return list_letters('partner',account,company,class_code)

@router.post('/api/coordinator/vault/letters')
def coordinator_upload(body:Upload,account=Depends(coordinator)):
    return upload_letter(body,'coordinator',account)

@router.post('/api/partner/vault/letters')
def partner_upload(body:Upload,account=Depends(partner)):
    return upload_letter(body,'partner',account)

@router.get('/api/coordinator/vault/letters/{file_id}')
def coordinator_read(file_id:int,account=Depends(coordinator)):
    return read_letter(file_id,'coordinator',account)

@router.get('/api/partner/vault/letters/{file_id}')
def partner_read(file_id:int,account=Depends(partner)):
    return read_letter(file_id,'partner',account)

@router.get('/api/student/vault/letters/{file_id}')
def student_read(file_id:int,account=Depends(student)):
    return read_letter(file_id,'student',account)

@router.delete('/api/coordinator/vault/letters/{file_id}')
def coordinator_delete(file_id:int,account=Depends(coordinator)):
    return delete_letter(file_id,'coordinator',account)

@router.delete('/api/partner/vault/letters/{file_id}')
def partner_delete(file_id:int,account=Depends(partner)):
    return delete_letter(file_id,'partner',account)
