"""Server-recorded activity; clients cannot create or rewrite audit entries."""
from datetime import timedelta
from fastapi import APIRouter, Depends
from db import database
from coordinator_auth import coordinator

router = APIRouter()


def resource_label(resource_id):
    value=str(resource_id)
    return 'Letter '+value[7:] if value.startswith('letter-') else 'Task '+value


def record_report(cursor, task_id, role, account_id, student_id, action):
    # Use the workflow transaction: a failed audit write rolls back the action too.
    cursor.execute('INSERT INTO audit_events (class_code,actor_role,actor_id,subject_id,resource_id,action,status,created_at) SELECT class_code,%s,%s,%s,id,%s,%s,UTC_TIMESTAMP() FROM classwork_tasks WHERE id=%s',
                   (role, account_id, student_id, action, 'Success', task_id))


@router.get('/api/coordinator/audit')
def activity(class_code: str, account=Depends(coordinator)):
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute('SELECT e.* FROM audit_events e WHERE e.class_code=%s AND EXISTS (SELECT 1 FROM coordinator_batches o WHERE o.class_code=e.class_code AND o.coordinator_id=%s) ORDER BY e.id DESC LIMIT 500',
                       (class_code, account['id']))
        return {'entries': [dict(id=row['id'], at=(row['created_at']+timedelta(hours=8)).strftime('%Y-%m-%d %H:%M:%S'),
                    user=row['actor_role'].title()+' #'+str(row['actor_id']),
                    action=row['action']+' · '+resource_label(row['resource_id'])+' · Student #'+str(row['subject_id']),
                    status=row['status']) for row in cursor.fetchall()]}
