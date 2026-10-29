"""Classwork ownership, lifecycle and file payload regression checks."""
import base64
import json
from unittest import TestCase
from unittest.mock import MagicMock,patch
from pydantic import ValidationError
from fastapi import HTTPException
import mysql.connector
import tasks as module
from test_coordinator_auth import database_for


class TaskTests(TestCase):
    def task(self,**changes):
        return module.Task(**{**dict(classCode='OWNED',title='Weekly report',dueDate='2026-11-01'),**changes})

    def test_create_uses_owned_active_batch_and_keeps_files(self):
        data='data:text/plain;base64,'+base64.b64encode(b'Template content').decode()
        cursor=MagicMock()
        cursor.fetchone.return_value={'status':'active'}
        with patch.object(module,'database',lambda:database_for(cursor)):
            result=module.create(self.task(template='template.txt',templateData=data),{'id':4})
        self.assertTrue(result['id'].startswith('task-'))
        self.assertEqual(cursor.execute.call_args_list[0].args[1],('OWNED',4))
        self.assertEqual(json.loads(cursor.execute.call_args.args[1][2])['templateData'],data)

    def test_foreign_batch_cannot_create(self):
        cursor=MagicMock()
        cursor.fetchone.return_value=None
        with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as result:
            module.create(self.task(),{'id':4})
        self.assertEqual(result.exception.status_code,404)
        self.assertEqual(cursor.execute.call_count,1)

    def test_closed_batch_cannot_create(self):
        cursor=MagicMock()
        cursor.fetchone.return_value={'status':'closed'}
        with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as result:
            module.create(self.task(),{'id':4})
        self.assertEqual(result.exception.status_code,409)

    def test_update_cannot_move_task_between_batches(self):
        cursor=MagicMock()
        cursor.fetchone.side_effect=[{'status':'active'},None]
        with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as result:
            module.update('other-task',self.task(),{'id':4})
        self.assertEqual(result.exception.status_code,404)
        self.assertEqual(cursor.execute.call_args.args[1],('other-task','OWNED'))

    def test_delete_is_owned_and_referenced_tasks_are_preserved(self):
        cursor=MagicMock()
        cursor.fetchone.return_value={'id':'task-test'}
        cursor.execute.side_effect=[None,mysql.connector.IntegrityError(errno=1451)]
        with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as result:
            module.delete('task-test',{'id':4})
        self.assertEqual(result.exception.status_code,409)
        self.assertEqual(cursor.execute.call_args_list[0].args[1],('task-test',4))

    def test_maximum_points_cannot_drop_below_an_existing_grade(self):
        cursor=MagicMock()
        cursor.fetchone.side_effect=[{'status':'active'},{'id':'task-test'},{'highest':90}]
        with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as result:
            module.update('task-test',self.task(maxPoints=50),{'id':4})
        self.assertEqual(result.exception.status_code,409)

    def test_invalid_dates_points_files_and_missing_file_content_rejected(self):
        for changes in [dict(dueDate='2026-02-30'),dict(maxPoints=0),dict(title=' '),dict(template='file.pdf'),
                        dict(attachments=['file.pdf'],attachmentData=[]),dict(template='file.txt',templateData='javascript:alert(1)')]:
            with self.assertRaises(ValidationError):
                self.task(**changes)

    def test_student_read_excludes_archived_tasks_and_other_batches(self):
        cursor=MagicMock()
        cursor.fetchall.return_value=[{'id':'task-test','class_code':'OWNED','payload':self.task().model_dump_json()}]
        with patch.object(module,'database',lambda:database_for(cursor)):
            result=module.mine({'class_code':'OWNED'})
        self.assertEqual(result['tasks'][0]['title'],'Weekly report')
        self.assertTrue(result['tasks'][0]['databaseTask'])
        self.assertEqual(cursor.execute.call_args.args[1],('OWNED',))
        self.assertIn("!='archived'",cursor.execute.call_args.args[0])
