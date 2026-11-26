"""Coordinator-managed holidays and no-work days for a batch (thesis Chapter 1, Scope and Delimitations)."""
from datetime import date
import mysql.connector
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from db import database
from coordinator_auth import coordinator, owned_batch
from audit import record_batch_event

router=APIRouter()
KINDS=('Regular holiday','Special non-working day','Class / work suspension','Company no-work day')


class Holiday(BaseModel):
    classCode: str = Field(min_length=1,max_length=100)
    date: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    name: str = Field(min_length=1,max_length=150)
    type: str = Field(min_length=1,max_length=40)

    @field_validator('date')
    @classmethod
    def real_date(cls,value):
        moment=date.fromisoformat(value)
        if not 2020<=moment.year<=2100:
            raise ValueError('Choose a date between 2020 and 2100.')
        return value

    @field_validator('name')
    @classmethod
    def trimmed_name(cls,value):
        value=value.strip()
        if not value:
            raise ValueError('Give the day a name.')
        return value

    @field_validator('type')
    @classmethod
    def known_type(cls,value):
        if value not in KINDS:
            raise ValueError('Choose one of: '+', '.join(KINDS)+'.')
        return value


@router.get('/api/coordinator/holidays')
def holidays(class_code:str,account=Depends(coordinator)):
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        owned_batch(cursor,class_code,account)
        cursor.execute('SELECT holiday_date,name,kind FROM attendance_holidays WHERE class_code=%s ORDER BY holiday_date',(class_code,))
        return {'holidays':[dict(date=row['holiday_date'].isoformat(),name=row['name'],type=row['kind']) for row in cursor.fetchall()]}


@router.post('/api/coordinator/holidays',status_code=201)
def add(body:Holiday,account=Depends(coordinator)):
    try:
        with database() as connection:
            cursor=connection.cursor(dictionary=True)
            owned_batch(cursor,body.classCode,account)
            cursor.execute('INSERT INTO attendance_holidays (class_code,holiday_date,name,kind,created_by,created_at) VALUES (%s,%s,%s,%s,%s,UTC_TIMESTAMP())',
                           (body.classCode,body.date,body.name,body.type,account['id']))
            # A holiday is never an absence: drop absences already recorded for that day that nobody has reviewed.
            cursor.execute("DELETE a FROM attendance_absences a JOIN student_accounts s ON s.id=a.student_id WHERE s.class_code=%s AND a.work_date=%s AND a.review=''",
                           (body.classCode,body.date))
            record_batch_event(cursor,body.classCode,account['id'],'holiday-'+body.date,'Added holiday: '+body.name+' ('+body.type.lower()+')')
    except mysql.connector.IntegrityError as error:
        if error.errno==1062:
            raise HTTPException(409,'That date is already in the holiday list.') from None
        raise
    return {'ok':True}


@router.delete('/api/coordinator/holidays/{class_code}/{holiday_date}')
def remove(class_code:str,holiday_date:str,account=Depends(coordinator)):
    try:
        date.fromisoformat(holiday_date)
    except ValueError:
        raise HTTPException(400,'Use a date like 2026-12-25.') from None
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        owned_batch(cursor,class_code,account)
        cursor.execute('SELECT name FROM attendance_holidays WHERE class_code=%s AND holiday_date=%s FOR UPDATE',(class_code,holiday_date))
        row=cursor.fetchone()
        if not row:
            raise HTTPException(404,'Holiday not found.')
        cursor.execute('DELETE FROM attendance_holidays WHERE class_code=%s AND holiday_date=%s',(class_code,holiday_date))
        record_batch_event(cursor,class_code,account['id'],'holiday-'+holiday_date,'Removed holiday: '+row['name'])
    return {'ok':True}
