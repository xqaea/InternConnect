"""Scoped notifications derived from authoritative records, with durable receipts."""
from datetime import timedelta
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from db import database
from student_auth import student
from coordinator_auth import coordinator
from partner_auth import partner
from security import token_hash

router=APIRouter()


class Seen(BaseModel):
    ids: list[str] = Field(min_length=1,max_length=100)


def feed(role,account):
    items=[]
    def add(identity,title,message,section,href,at,batch=""):
        items.append(dict(id=token_hash(identity),title=title,message=message,section=section,href=href,
                          classCode=batch,at=at.isoformat(),date=(at+timedelta(hours=8)).date().isoformat()))
    with database() as connection:
        cursor=connection.cursor(dictionary=True)
        if role=='student':
            cursor.execute("SELECT id,payload,created_at FROM classwork_tasks WHERE class_code=%s AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.status'))='open' ORDER BY created_at DESC LIMIT 100",(account['class_code'],))
            import json
            for row in cursor.fetchall():
                task=json.loads(row['payload']) if isinstance(row['payload'],str) else row['payload']
                add('task:'+row['id'],'New task',task['title']+(' - Due '+task['dueDate'] if task.get('dueDate') else ''),'classwork','task-detail.html?task='+row['id'],row['created_at'])
            cursor.execute("SELECT r.*,t.payload FROM narrative_reports r JOIN classwork_tasks t ON t.id=r.task_id WHERE r.student_id=%s ORDER BY r.submitted_at DESC LIMIT 100",(account['id'],))
            for row in cursor.fetchall():
                task=json.loads(row['payload']) if isinstance(row['payload'],str) else row['payload']
                if row['status']!='Pending Review':
                    add('review:'+row['task_id']+':'+str(row['version'])+':'+row['status'],'Report reviewed',task['title']+': '+row['status'],'classwork','task-detail.html?task='+row['task_id'],row['reviewed_at'] or row['submitted_at'])
                if row['score'] is not None:
                    add('grade:'+row['task_id']+':'+str(row['version'])+':'+str(row['score'])+':'+row['grade_feedback'],'Report graded',task['title']+': '+str(row['score'])+' / '+str(task['maxPoints']),'classwork','task-detail.html?task='+row['task_id'],row['reviewed_at'] or row['submitted_at'])
            cursor.execute('SELECT a.id,a.title,a.status,a.updated_at FROM internship_applications a WHERE a.student_id=%s ORDER BY a.updated_at DESC LIMIT 100',(account['id'],))
            for row in cursor.fetchall():
                add('application:'+str(row['id'])+':'+row['status'],'Application update',row['title']+': '+row['status'],'jobs','job-matching.html',row['updated_at'])
            cursor.execute('SELECT confirmed_at,application_id FROM official_placements WHERE student_id=%s',(account['id'],))
            for row in cursor.fetchall():
                add('deployment:'+str(row['application_id']),'Deployment confirmed','Your coordinator confirmed your official placement.','attendance','attendance.html',row['confirmed_at'])
            cursor.execute("SELECT work_date,clock_out,review,JSON_UNQUOTE(JSON_EXTRACT(payload,'$.status')) AS status FROM student_attendance WHERE student_id=%s AND clock_out IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.status')) IN ('Flagged','Outside schedule','Late') ORDER BY work_date DESC LIMIT 100",(account['id'],))
            for row in cursor.fetchall():
                day=row['work_date'].isoformat()
                add('attendance:'+day+':'+row['review'],'Attendance reviewed' if row['review'] else 'Attendance needs attention',
                    day+': '+(row['review'] or row['status'])+'.','attendance','day-log.html?date='+day,row['clock_out'])
        elif role=='coordinator':
            cursor.execute("SELECT r.task_id,r.student_id,r.version,r.submitted_at,s.name,s.class_code FROM narrative_reports r JOIN student_accounts s ON s.id=r.student_id JOIN coordinator_batches o ON o.class_code=s.class_code WHERE o.coordinator_id=%s AND r.status='Pending Review' ORDER BY r.submitted_at DESC LIMIT 100",(account['id'],))
            for row in cursor.fetchall():
                add('submission:'+row['task_id']+':'+str(row['student_id'])+':'+str(row['version']),'Task submitted',row['name']+' submitted a report for review.','classwork','task-detail.html?task='+row['task_id'],row['submitted_at'],row['class_code'])
            cursor.execute("SELECT s.id,s.name,s.created_at,s.class_code FROM student_accounts s JOIN coordinator_batches o ON o.class_code=s.class_code WHERE o.coordinator_id=%s AND s.status='pending' ORDER BY s.created_at DESC LIMIT 100",(account['id'],))
            for row in cursor.fetchall():
                add('student-request:'+str(row['id']),'Student request',row['name']+' requested to join your batch.','requests','requests.html',row['created_at'],row['class_code'])
            cursor.execute("SELECT a.id,c.name,p.created_at,c.class_code FROM partner_accounts a JOIN partner_profiles p ON p.account_id=a.id JOIN companies c ON c.id=a.company_id JOIN coordinator_batches o ON o.class_code=c.class_code WHERE o.coordinator_id=%s AND p.status='pending' ORDER BY p.created_at DESC LIMIT 100",(account['id'],))
            for row in cursor.fetchall():
                add('partner-request:'+str(row['id']),'Partner request',row['name']+' requested a partner link.','requests','requests.html',row['created_at'],row['class_code'])
            cursor.execute("SELECT a.id,a.title,a.updated_at,s.name,s.class_code FROM internship_applications a JOIN student_accounts s ON s.id=a.student_id JOIN coordinator_batches o ON o.class_code=s.class_code LEFT JOIN official_placements p ON p.application_id=a.id WHERE o.coordinator_id=%s AND a.internship=1 AND a.status='Accepted' AND p.student_id IS NULL ORDER BY a.updated_at DESC LIMIT 100",(account['id'],))
            for row in cursor.fetchall():
                add('accepted:'+str(row['id']),'Placement needs confirmation',row['name']+' was accepted for '+row['title']+'.','placements','placements.html',row['updated_at'],row['class_code'])
        else:
            cursor.execute('SELECT a.id,a.posting_id,a.title,a.created_at,s.name FROM internship_applications a JOIN student_accounts s ON s.id=a.student_id WHERE a.company_id=%s ORDER BY a.created_at DESC LIMIT 100',(account['company_id'],))
            for row in cursor.fetchall():
                add('applicant:'+str(row['id']),'New applicant',row['name']+' applied for '+row['title']+'.','postings','postings.html?job='+row['posting_id'],row['created_at'])
        items=sorted(items,key=lambda item:(item['at'],item['id']),reverse=True)[:100]
        ids=[item['id'] for item in items]
        read=set()
        if ids:
            placeholders=','.join(['%s']*len(ids))
            cursor.execute('SELECT event_id FROM notification_receipts WHERE role=%s AND account_id=%s AND event_id IN ('+placeholders+')',(role,account['id'],*ids))
            read={row['event_id'] for row in cursor.fetchall()}
        for item in items:
            item['unread']=item['id'] not in read
    return {'notifications':items}


def mark(role,account,body):
    if any(len(identity)!=64 or any(char not in '0123456789abcdef' for char in identity) for identity in body.ids):
        from fastapi import HTTPException
        raise HTTPException(422,'Invalid notification identifiers.')
    with database() as connection:
        cursor=connection.cursor()
        for identity in set(body.ids):
            cursor.execute('INSERT INTO notification_receipts (role,account_id,event_id,read_at) VALUES (%s,%s,%s,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE event_id=VALUES(event_id)',(role,account['id'],identity))
    return {'ok':True}


def register(role,dependency):
    def get(account=Depends(dependency)):
        return feed(role,account)
    def seen(body:Seen,account=Depends(dependency)):
        return mark(role,account,body)
    router.add_api_route('/api/'+role+'/notifications',get,methods=['GET'])
    router.add_api_route('/api/'+role+'/notifications/read',seen,methods=['POST'])


register('student',student)
register('coordinator',coordinator)
register('partner',partner)
