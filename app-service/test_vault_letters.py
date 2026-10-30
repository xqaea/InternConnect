"""One upload, shared reads, and company/student permission boundaries."""
import json
from datetime import datetime
from unittest import TestCase
from unittest.mock import MagicMock,patch
from fastapi import HTTPException
from pydantic import ValidationError
import vault_letters as module
import placements
from test_coordinator_auth import database_for
from test_placements import confirmation


def record():
    return dict(id=7,company_id=3,student_id=2,kind='endorsement',email='student@example.com',
                student_name='Student',company='Company',class_code='OWNED',owner_role='coordinator',
                owner_id=4,version=1,updated_at=datetime(2026,10,30),payload=confirmation().endorsement.model_dump_json())


def upload(**changes):
    return module.Upload(**{**dict(company='Company',classCode='OWNED',email='student@example.com',
                                 kind='endorsement',file=confirmation().endorsement.model_dump()),**changes})


class VaultLetterTests(TestCase):
    def test_one_upload_records_student_company_and_audit_before_deployment(self):
        cursor=MagicMock(lastrowid=7)
        cursor.fetchone.side_effect=[{'id':3,'class_code':'OWNED'}, {'id':2}, None]
        with patch.object(module,'database',lambda:database_for(cursor)):
            self.assertEqual(module.upload_letter(upload(),'coordinator',{'id':4}),{'id':7})
        calls=cursor.execute.call_args_list
        self.assertIn('o.coordinator_id=%s',calls[0].args[0])
        self.assertEqual(calls[1].args[1],('OWNED',3,'student@example.com'))
        self.assertEqual(calls[3].args[1][:3],(3,2,'endorsement'))
        self.assertEqual(json.loads(calls[3].args[1][3]),confirmation().endorsement.model_dump())
        self.assertIn('INSERT INTO audit_events',calls[-1].args[0])
        self.assertFalse(any('official_placements' in call.args[0] for call in calls))

    def test_all_three_roles_read_the_same_record_with_their_own_scope(self):
        for role,account,condition,key in [('student',{'id':2},'d.student_id=%s',2),
                                         ('partner',{'company_id':3},'d.company_id=%s',3),
                                         ('coordinator',{'id':4},'o.coordinator_id=%s',4)]:
            cursor=MagicMock();cursor.fetchone.return_value=record()
            with patch.object(module,'database',lambda:database_for(cursor)):
                response=module.read_letter(7,role,account)
            self.assertEqual(json.loads(response.body)['document'],confirmation().endorsement.model_dump())
            self.assertEqual(response.headers['cache-control'],'no-store')
            self.assertIn(condition,cursor.execute.call_args.args[0])
            self.assertEqual(cursor.execute.call_args.args[1],(7,key))

    def test_other_student_partner_and_coordinator_get_no_file(self):
        for role,account in [('student',{'id':90}),('partner',{'company_id':90}),('coordinator',{'id':90})]:
            cursor=MagicMock();cursor.fetchone.return_value=None
            with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as denied:
                module.read_letter(7,role,account)
            self.assertEqual(denied.exception.status_code,404)

    def test_company_and_student_must_match_the_authors_scope(self):
        for rows in [[None],[{'id':3,'class_code':'OWNED'},None]]:
            cursor=MagicMock();cursor.fetchone.side_effect=rows
            with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as denied:
                module.upload_letter(upload(),'coordinator',{'id':4})
            self.assertEqual(denied.exception.status_code,404)
            self.assertFalse(any('INSERT' in call.args[0] for call in cursor.execute.call_args_list))
        cursor=MagicMock();cursor.fetchone.return_value=None
        with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException):
            module.list_letters('partner',{'company_id':3},'Different Company','OTHER')
        self.assertEqual(cursor.execute.call_args.args[1],(3,'Different Company','OTHER'))

    def test_shared_list_and_student_list_return_metadata_only(self):
        cursor=MagicMock();cursor.fetchone.return_value={'id':3}
        cursor.fetchall.side_effect=[[{'id':2,'email':'student@example.com','name':'Student'}],[record()]]
        with patch.object(module,'database',lambda:database_for(cursor)):
            result=module.list_letters('coordinator',{'id':4},'Company','OWNED')
        self.assertEqual(result['files'][0]['id'],7)
        self.assertTrue(result['files'][0]['canEdit'])
        self.assertNotIn('data',result['files'][0])
        cursor=MagicMock();cursor.fetchall.return_value=[record()]
        with patch.object(module,'database',lambda:database_for(cursor)):
            result=module.student_metadata({'id':2})
        self.assertEqual(cursor.execute.call_args.args[1],(2,))
        self.assertEqual(result[0]['id'],7)
        self.assertFalse(result[0]['canEdit'])

    def test_only_uploader_can_replace_and_stale_versions_cannot_overwrite(self):
        for existing,status in [({**record(),'owner_role':'partner'},403),({**record(),'version':2},409)]:
            cursor=MagicMock();cursor.fetchone.side_effect=[{'id':3,'class_code':'OWNED'},{'id':2},existing]
            with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as denied:
                module.upload_letter(upload(version=1),'coordinator',{'id':4})
            self.assertEqual(denied.exception.status_code,status)
        cursor=MagicMock();cursor.fetchone.side_effect=[{'id':3,'class_code':'OWNED'},{'id':2},record()]
        with patch.object(module,'database',lambda:database_for(cursor)):
            module.upload_letter(upload(version=1),'coordinator',{'id':4})
        update=cursor.execute.call_args_list[3].args[0]
        self.assertIn('JSON_ARRAY_APPEND(history',update)
        self.assertIn('version=version+1',update)

    def test_confirmed_placement_letters_cannot_be_deleted(self):
        cursor=MagicMock();cursor.fetchone.side_effect=[record(),{'id':2},{'student_id':2}]
        with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as denied:
            module.delete_letter(7,'coordinator',{'id':4})
        self.assertEqual(denied.exception.status_code,409)
        self.assertFalse(any(call.args[0].startswith('DELETE') for call in cursor.execute.call_args_list))

    def test_uploaded_letters_take_precedence_over_deployment_copies(self):
        shared=[{'id':7,'kind':'endorsement','name':'updated.pdf'}]
        cursor=MagicMock();cursor.fetchone.return_value={'endorsement':confirmation().endorsement.model_dump(),'acceptance':confirmation().acceptance.model_dump()}
        with patch.object(placements,'shared_student_letters',return_value=shared),patch.object(placements,'database',lambda:database_for(cursor)):
            result=placements.student_documents({'id':2})['documents']
        self.assertEqual([row['name'] for row in result],['updated.pdf','signed.pdf'])

    def test_only_supported_letter_types_and_scans_can_be_uploaded(self):
        for changes in [dict(kind='Other'),dict(file={'name':'bad.pdf','data':'data:application/pdf;base64,aGVsbG8='})]:
            with self.assertRaises(ValidationError):upload(**changes)
