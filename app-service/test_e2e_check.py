"""The end-to-end script's own helpers, and that its payloads still pass the app's validation models."""
import contextlib
import io
import tempfile
from pathlib import Path
from unittest import TestCase

import e2e_check as module
import main
import placements


def quiet(function, *args):
    with contextlib.redirect_stdout(io.StringIO()):
        return function(*args)


class ReportTests(TestCase):
    def test_exit_code_is_one_only_when_something_failed(self):
        report = module.Report()
        quiet(report.head, 'Section')
        quiet(report.check, 'a', True)
        quiet(report.skip, 'b', 'not needed')
        self.assertEqual(quiet(report.summary), 0)
        quiet(report.check, 'c', False, 'HTTP 500')
        self.assertEqual(quiet(report.summary), 1)

    def test_an_unexpected_exception_fails_that_use_case_but_the_run_continues(self):
        report = module.Report()

        def boom():
            raise ValueError('bad payload')

        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            report.attempt('first', boom)
            report.check('second', True)
        states = [row[0] for row in report.rows]
        self.assertEqual(states, ['FAIL', 'PASS'])
        self.assertIn('ValueError', report.rows[0][3])


class AccountFileTests(TestCase):
    def test_passwords_are_read_by_email_and_comments_are_ignored(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'accounts.txt'
            path.write_text('# header\n# role | email | password\nstudent | a@example.com | pw1\nnot a row\n'
                            'coordinator | b@example.com | p|w2\n', encoding='utf-8')
            found = module.read_accounts(path)
        self.assertEqual(found['a@example.com'], 'pw1')
        self.assertNotIn('not a row', found)
        self.assertEqual(len(found), 1)  # a password containing a pipe is not a valid row, never half-parsed


class PayloadTests(TestCase):
    """If an app model changes, this fails here instead of as a confusing 422 in the middle of a run."""
    def setUp(self):
        self.run = module.Run(module.Api('http://127.0.0.1:1'), '', {}, module.Report(), None)

    def test_the_deployment_schedule_and_scans_pass_the_placement_models(self):
        schedule = placements.Schedule(**self.run.schedule())
        self.assertEqual(sorted(schedule.days), [0, 1, 2, 3, 4, 5, 6])
        self.assertLess(schedule.timeIn, schedule.timeOut)
        self.assertEqual(schedule.site.radius, module.SITE['radius'])
        placements.Evidence(**module.PDF)

    def test_the_posting_passes_the_posting_model(self):
        main.Posting(**self.run.posting_body())
        main.Posting(**self.run.posting_body(status='closed'))

    def test_the_clock_requests_pass_the_clock_model(self):
        import attendance
        attendance.Clock(action='in', photo=module.PHOTO, lat=module.SITE['lat'], lng=module.SITE['lng'], accuracy=12)
        attendance.Clock(action='out', lat=module.SITE['lat'], lng=module.SITE['lng'], accuracy=12)
        attendance.Clock(action='in', photo='', lat=module.SITE['lat'], lng=module.SITE['lng'], accuracy=12)  # the no-photo case

    def test_the_gallery_style_photos_are_really_refused_by_the_clock_model(self):
        import attendance
        from pydantic import ValidationError
        for photo in (module.make_jpeg(png=True), module.make_jpeg(width=3000, height=4000)):
            with self.assertRaises(ValidationError):
                attendance.Clock(action='in', photo=photo, lat=0, lng=0, accuracy=12)

    def test_the_outside_attempt_really_is_outside_the_radius_and_the_low_accuracy_one_really_exceeds_the_limit(self):
        import attendance
        site = {'lat': module.SITE['lat'], 'lng': module.SITE['lng']}
        self.assertGreater(attendance.distance(module.SITE['lat'] + 0.01, module.SITE['lng'], site), module.SITE['radius'])
        self.assertEqual(attendance.distance(module.SITE['lat'], module.SITE['lng'], site), 0)
        self.assertGreater(450, attendance.DEFAULT_ACCURACY_LIMIT_M)

    def test_intern_registration_passes_the_student_model(self):
        from student_auth import StudentRegistration
        StudentRegistration(email=f'e2e.inside.{self.run.tag}@example.com', password=module.make_password(), name='E2E Inside',
                            classCode=module.BATCH, program=module.PROGRAM, studentNumber='E2E-1')
        from coordinator_auth import CoordinatorRegistration
        CoordinatorRegistration(email='e2e.coordinator2.abc@example.com', password=module.make_password(), name='E2E Second Coordinator',
                                classCode='E2E-abc', program=module.PROGRAM, school='E2E School', theme='sky')
