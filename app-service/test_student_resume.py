"""Resume ownership, reload and payload validation without live database changes."""
import base64
import json
from unittest import TestCase
from unittest.mock import MagicMock, patch
from pydantic import ValidationError
import student_resume as resume
import student_auth
from test_coordinator_auth import database_for
from test_student_auth import account


class ResumeTests(TestCase):
    def test_education_program_and_school_are_saved_separately(self):
        body=resume.Resume(fields={'ed-educationProgram':'BS Computer Science',
                                   'ed-educationSchool':'Example College',
                                   'ed-education':'BS Computer Science\nExample College'})
        cursor=MagicMock()
        with patch.object(resume, 'database', lambda: database_for(cursor)):
            resume.save_resume(body, account())
        fields=json.loads(cursor.execute.call_args.args[1][1])['fields']
        self.assertEqual(fields['ed-educationProgram'], 'BS Computer Science')
        self.assertEqual(fields['ed-educationSchool'], 'Example College')

    def test_multiple_experiences_keep_their_own_dates_in_storage(self):
        body=resume.Resume(workExperiences=[
            dict(text='First role', position='Intern', bullets=['Built a report'], start='2022-01', end='2022-06'),
            dict(text='Second role', company='Example Company', location='Cavite', start='2023-02', end='2024-03')])
        cursor=MagicMock()
        with patch.object(resume, 'database', lambda: database_for(cursor)):
            resume.save_resume(body, account())
        stored=json.loads(cursor.execute.call_args.args[1][1])
        self.assertEqual(stored['workExperiences'][1]['start'], '2023-02')
        self.assertEqual(stored['workExperiences'][1]['company'], 'Example Company')
        self.assertEqual(stored['workExperiences'][1]['location'], 'Cavite')
        self.assertEqual(stored['workExperiences'][0]['end'], '2022-06')
        self.assertEqual(stored['workExperiences'][0]['position'], 'Intern')
        self.assertEqual(stored['workExperiences'][0]['bullets'], ['Built a report'])
        self.assertIsNone(resume.Resume(fields={'ed-workexp':'Existing resume'}).workExperiences)

    def test_experience_dates_are_validated_per_entry(self):
        for entry in [dict(text='Role', start='2024-03', end='2023-01'),
                      dict(text='Role', start='2024-02'), dict(text=' '),
                      dict(text='Role', start='2024-13', end='2025-01'),
                      dict(text='Role', bullets=['']), dict(text='Role', bullets=['x'*2001]),
                      dict(text='Role', company='x'*201), dict(text='Role', location='x'*201)]:
            with self.assertRaises(ValidationError):
                resume.Resume(workExperiences=[entry])

    def test_month_year_ranges_are_saved_and_validated(self):
        fields={'ed-workStart':'2023-01','ed-workEnd':'2024-03'}
        self.assertEqual(resume.Resume(fields=fields).fields,fields)
        for invalid in ({'ed-workStart':'2024-03','ed-workEnd':'2023-01'},
                        {'ed-workStart':'2023-13','ed-workEnd':'2024-03'},
                        {'ed-workStart':'2023-01'}):
            with self.assertRaises(ValidationError):
                resume.Resume(fields=invalid)

    def test_save_uses_authenticated_id_and_keeps_resume_options(self):
        cursor = MagicMock()
        body = resume.Resume(fields={'ed-name': 'Resume Name'}, hard=['Python'],
            soft=['Communication'] * 6, photoOn=True, custom=[{'title':'Projects','text':'Built an app'}])
        with patch.object(resume, 'database', lambda: database_for(cursor)):
            self.assertEqual(resume.save_resume(body, account()), {'ok': True})
        args = cursor.execute.call_args.args[1]
        self.assertEqual(args[0], account()['id'])
        stored = json.loads(args[1])
        self.assertTrue(stored['photoOn'])
        self.assertEqual(len(stored['soft']), 6)
        self.assertEqual(stored['custom'][0]['text'], 'Built an app')
        self.assertNotIn('verified', stored)

    def test_me_loads_only_current_students_saved_resume(self):
        for payload in (None, {'hard':['Python'], 'photoOn':True}):
            cursor = MagicMock()
            cursor.fetchone.return_value = {'payload':json.dumps(payload)} if payload else None
            with patch.object(student_auth, 'database', lambda: database_for(cursor)):
                result = student_auth.me(account())
            self.assertEqual(result['resume'], payload)
            self.assertNotIn('password_hash', result['user'])
            self.assertEqual(cursor.execute.call_args.args[1], (account()['id'],))

    def test_rejects_uneditable_fields_and_oversized_text(self):
        for fields in ({'verified':'Forged experience'}, {'ed-objective':'x' * 10001}):
            with self.assertRaises(ValidationError):
                resume.Resume(fields=fields)

    def test_pdf_validates_content_and_can_be_removed(self):
        value = 'data:application/pdf;base64,' + base64.b64encode(b'%PDF-1.7\nexample').decode()
        self.assertEqual(resume.Resume(pdf='resume.pdf', pdfData=value).pdfData, value)
        self.assertEqual(resume.Resume(pdf='', pdfData='').pdfData, '')
        for invalid in ('javascript:alert(1)', 'data:application/pdf;base64,broken',
                        'data:application/pdf;base64,' + base64.b64encode(b'<html>').decode()):
            with self.assertRaises(ValidationError):
                resume.Resume(pdfData=invalid)

    def test_photo_validation_and_account_scope(self):
        avatar = 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\nexample').decode()
        cursor = MagicMock()
        with patch.object(resume, 'database', lambda: database_for(cursor)):
            resume.save_photo(resume.Photo(avatar=avatar), account())
        self.assertEqual(cursor.execute.call_args.args[1], (avatar, account()['id']))
        for invalid in ('https://example.com/a.png', 'data:image/png;base64,broken',
                        'data:image/webp;base64,' + base64.b64encode(b'RIFFxxxxFAKE').decode()):
            with self.assertRaises(ValidationError):
                resume.Photo(avatar=invalid)
