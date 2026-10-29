"""Coordinator-confirmed deployments with retained documentary evidence."""
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from db import database
from student_auth import student
from coordinator_auth import coordinator, owned_batch
from partner_auth import partner
from student_resume import Resume, Photo

router = APIRouter()


class Site(BaseModel):
    lat: float = Field(ge=-90,le=90,allow_inf_nan=False)
    lng: float = Field(ge=-180,le=180,allow_inf_nan=False)
    place: str = Field(min_length=1,max_length=300)
    radius: int = Field(ge=10,le=5000)


class Schedule(BaseModel):
    days: list[int] = Field(min_length=1,max_length=7)
    timeIn: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    timeOut: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    grace: int = Field(ge=0,le=60)
    mode: str = Field(pattern=r'^(On-site|Hybrid|Remote)$')
    site: Site | None = None

    @model_validator(mode='after')
    def valid_schedule(self):
        if any(day not in range(7) for day in self.days) or len(set(self.days)) != len(self.days):
            raise ValueError('Select valid work days.')
        if self.timeOut<=self.timeIn:
            raise ValueError('Time out must be later than time in.')
        return self


class Evidence(BaseModel):
    name: str = Field(min_length=1,max_length=255)
    data: str = Field(max_length=2000100)

    @model_validator(mode='after')
    def valid_scan(self):
        if self.data.startswith('data:application/pdf;base64,'):
            Resume(pdfData=self.data)
        else:
            Photo(avatar=self.data)
        if not self.data:
            raise ValueError('Upload a signed document.')
        return self


class Confirm(BaseModel):
    schedule: Schedule
    endorsement: Evidence
    acceptance: Evidence


@router.post('/api/coordinator/applications/{application_id}/deployment',status_code=201)
def confirm(application_id:int,body:Confirm,account=Depends(coordinator)):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        cursor.execute('SELECT a.*,s.class_code,s.status AS student_status,j.latitude,j.longitude FROM internship_applications a JOIN student_accounts s ON s.id=a.student_id JOIN job_postings j ON j.id=a.posting_id JOIN coordinator_batches o ON o.class_code=s.class_code WHERE a.id=%s AND o.coordinator_id=%s', (application_id,account['id']))
        application=cursor.fetchone()
        if not application:
            raise HTTPException(404,'Application not found.')
        batch=owned_batch(cursor,application['class_code'],account)
        cursor.execute('SELECT id FROM student_accounts WHERE id=%s FOR UPDATE',(application['student_id'],))
        cursor.fetchone()
        cursor.execute('SELECT status,internship FROM internship_applications WHERE id=%s FOR UPDATE',(application_id,))
        current=cursor.fetchone()
        if batch['status']!='active' or application['student_status']!='active' or not current['internship'] or current['status']!='Accepted':
            raise HTTPException(409,'Only an accepted internship in an active batch can be deployed.')
        cursor.execute('SELECT student_id FROM official_placements WHERE student_id=%s FOR UPDATE',(application['student_id'],))
        if cursor.fetchone():
            raise HTTPException(409,'This student already has an official placement.')
        schedule=body.schedule.model_dump()
        if schedule['mode']!='Remote' and not schedule['site']:
            if application.get('latitude') is None or application.get('longitude') is None:
                raise HTTPException(400,'Set the worksite coordinates using the branch location option before deployment.')
            schedule['site']=dict(lat=application['latitude'],lng=application['longitude'],place='Company worksite',radius=100)
        cursor.execute('INSERT INTO official_placements (student_id,application_id,coordinator_id,schedule,endorsement,acceptance,confirmed_at) VALUES (%s,%s,%s,%s,%s,%s,UTC_TIMESTAMP())',
            (application['student_id'],application_id,account['id'],json.dumps(schedule),body.endorsement.model_dump_json(),body.acceptance.model_dump_json()))
    return {'ok':True}


QUERY='SELECT p.*,s.name,s.email,s.student_number,s.class_code,a.company_id,a.title,c.name AS company FROM official_placements p JOIN student_accounts s ON s.id=p.student_id JOIN internship_applications a ON a.id=p.application_id JOIN companies c ON c.id=a.company_id '


def read_placements(where,args):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        cursor.execute(QUERY+where,args)
        return {'placements':[dict(name=row['name'],email=row['email'],studentNo=row['student_number'],classCode=row['class_code'],
            applicationId=row['application_id'],company=row['company'],position=row['title'],status='Deployed',hours=0,
            schedule=json.loads(row['schedule']) if isinstance(row['schedule'],str) else row['schedule'],
            deployedAt=row['confirmed_at'].date().isoformat(),databasePlacement=True,real=True,
            history=[{'status':'Deployed','date':row['confirmed_at'].date().isoformat(),'note':'Confirmed by coordinator'}]) for row in cursor.fetchall()]}


@router.get('/api/student/placements')
def mine(account=Depends(student)):
    return read_placements('WHERE p.student_id=%s',(account['id'],))


@router.get('/api/coordinator/placements')
def batches(account=Depends(coordinator)):
    return read_placements('JOIN coordinator_batches o ON o.class_code=s.class_code WHERE o.coordinator_id=%s',(account['id'],))


@router.get('/api/partner/placements')
def company(account=Depends(partner)):
    return read_placements('WHERE a.company_id=%s',(account['company_id'],))
