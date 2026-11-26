"""Official deployment requires ownership, acceptance, evidence and valid schedule."""
import base64
import json
from datetime import datetime
from unittest import TestCase
from unittest.mock import MagicMock,patch
from fastapi import HTTPException
from pydantic import ValidationError
import placements as module
from test_coordinator_auth import database_for


def schedule():
    return dict(days=[1,2,3,4,5],timeIn='08:00',timeOut='17:00',grace=15,mode='On-site')


def confirmation():
    scan=dict(name='signed.pdf',data='data:application/pdf;base64,'+base64.b64encode(b'%PDF-1.7\nexample').decode())
    return module.Confirm(schedule=schedule(),endorsement=scan,acceptance=scan)


class PlacementTests(TestCase):
    def setUp(self):
        patcher=patch.object(module,'shared_student_letters',return_value=[])
        patcher.start();self.addCleanup(patcher.stop)
    def test_student_letter_list_contains_metadata_without_file_contents(self):
        cursor=MagicMock()
        scan=confirmation().endorsement.model_dump()
        cursor.fetchone.return_value={'endorsement':json.dumps(scan),'acceptance':json.dumps(scan)}
        with patch.object(module,'database',lambda:database_for(cursor)):
            result=module.student_documents({'id':2})
        self.assertEqual(cursor.execute.call_args.args[1],(2,))
        self.assertEqual([row['kind'] for row in result['documents']],['endorsement','acceptance'])
        self.assertNotIn('data',result['documents'][0])

    def test_student_can_only_read_their_own_signed_letters(self):
        cursor=MagicMock()
        scan=confirmation().endorsement.model_dump()
        def execute(query,args):
            self.assertIn('WHERE student_id=%s',query)
            cursor.fetchone.return_value={'document':json.dumps(scan)} if args==(2,) else None
        cursor.execute.side_effect=execute
        with patch.object(module,'database',lambda:database_for(cursor)):
            response=module.student_document('endorsement',{'id':2})
            self.assertEqual(json.loads(response.body)['document'],scan)
            self.assertEqual(response.headers['cache-control'],'no-store')
            with self.assertRaises(HTTPException) as denied:
                module.student_document('endorsement',{'id':3})
            self.assertEqual(denied.exception.status_code,404)

    def test_missing_placement_and_unknown_document_kind(self):
        cursor=MagicMock();cursor.fetchone.return_value=None
        with patch.object(module,'database',lambda:database_for(cursor)):
            self.assertEqual(module.student_documents({'id':2}),{'documents':[]})
            with self.assertRaises(HTTPException) as missing:
                module.student_document('acceptance',{'id':2})
            self.assertEqual(missing.exception.status_code,404)
        with patch.object(module,'database') as database:
            with self.assertRaises(HTTPException):
                module.student_document('schedule',{'id':2})
            database.assert_not_called()

    def run_confirm(self,rows):
        cursor=MagicMock()
        cursor.fetchone.side_effect=rows
        with patch.object(module,'database',lambda:database_for(cursor)):
            result=module.confirm(9,confirmation(),{'id':4})
        return cursor,result

    def test_confirm_stores_schedule_evidence_and_coordinator(self):
        cursor,result=self.run_confirm([{'student_id':2,'class_code':'OWNED','student_status':'active','latitude':0,'longitude':0},
            {'status':'active'},{'id':2},{'status':'Accepted','internship':1},None])
        self.assertTrue(result['ok'])
        args=cursor.execute.call_args.args[1]
        self.assertEqual(args[:3],(2,9,4))
        self.assertEqual(json.loads(args[3])['timeIn'],'08:00')
        self.assertEqual(json.loads(args[3])['site']['lat'],0)
        self.assertTrue(json.loads(args[4])['data'].startswith('data:application/pdf'))
        self.assertEqual(cursor.execute.call_args_list[0].args[1],(9,4))

    def test_unrelated_coordinator_cannot_confirm(self):
        with self.assertRaises(HTTPException) as result:
            self.run_confirm([None])
        self.assertEqual(result.exception.status_code,404)

    def test_physical_worksite_requires_coordinates(self):
        with self.assertRaises(HTTPException) as result:
            self.run_confirm([{'student_id':2,'class_code':'OWNED','student_status':'active'},
                {'status':'active'},{'id':2},{'status':'Accepted','internship':1},None])
        self.assertEqual(result.exception.status_code,400)

    def test_only_accepted_internships_in_active_batches_can_deploy(self):
        for batch,status,internship in [('closed','Accepted',1),('active','Pending',1),('active','Accepted',0)]:
            with self.assertRaises(HTTPException) as result:
                self.run_confirm([{'student_id':2,'class_code':'OWNED','student_status':'active'},
                    {'status':batch},{'id':2},{'status':status,'internship':internship}])
            self.assertEqual(result.exception.status_code,409)

    def test_student_cannot_receive_duplicate_official_placements(self):
        with self.assertRaises(HTTPException) as result:
            self.run_confirm([{'student_id':2,'class_code':'OWNED','student_status':'active'},
                {'status':'active'},{'id':2},{'status':'Accepted','internship':1},{'student_id':2}])
        self.assertEqual(result.exception.status_code,409)

    def test_schedule_and_evidence_validation(self):
        for patch_data in ({'days':[]},{'days':[8]},{'days':[1,1]}, {'timeOut':'07:00'}, {'grace':61}):
            with self.assertRaises(ValidationError):
                module.Schedule(**{**schedule(),**patch_data})
        for data in ('','javascript:alert(1)','data:application/pdf;base64,aGVsbG8='):
            with self.assertRaises(ValidationError):
                module.Evidence(name='scan.pdf',data=data)

    def test_role_reads_are_scoped_and_do_not_expose_signed_files(self):
        row=dict(name='Student',email='student@example.com',student_number='001',class_code='OWNED',
            application_id=9,company='Company',title='Intern',schedule=json.dumps(schedule()),confirmed_at=datetime(2026,10,29))
        for operation,account,key in [(module.mine,{'id':2},2),(module.company,{'company_id':3},3),(module.batches,{'id':4},4)]:
            cursor=MagicMock()
            cursor.fetchall.return_value=[row]
            with patch.object(module,'database',lambda:database_for(cursor)):
                result=operation(account)['placements'][0]
            self.assertEqual(cursor.execute.call_args.args[1],(key,))
            self.assertEqual(result['status'],'Deployed')
            self.assertNotIn('endorsement',result)
