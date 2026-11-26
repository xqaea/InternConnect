"""Attendance photos come only from the live camera: no file picker, gallery, drag-and-drop or upload path may exist."""
import re
from pathlib import Path
from unittest import TestCase

ROOT = Path(__file__).resolve().parent.parent
ATTENDANCE_FILES = ['pages/student/attendance.html', 'pages/student/day-log.html', 'assets/js/student/attendance.js',
                    'assets/js/student/day-log.js', 'assets/js/core/attendance.js', 'assets/js/student/runtime.js']
FORBIDDEN = {
    'a file input': r'''type\s*=\s*["']?file''',
    'a file input made in script': r'''\.type\s*=\s*["']file["']''',
    'an image accept filter': r'''accept\s*=\s*["']?(?:image|\*)''',
    'the capture attribute': r'''\bcapture\s*=''',
    'FileReader': r'FileReader',
    'drag and drop': r'''ondrop|addEventListener\(\s*["']drop["']|dataTransfer''',
    'a file picker API': r'showOpenFilePicker|showPicker',
    'creating inputs from script': r'''createElement\(\s*["']input["']''',
}


def text(path):
    return (ROOT / path).read_text(encoding='utf-8')


class CameraOnlyTests(TestCase):
    def test_no_attendance_screen_can_pick_a_file_or_use_the_gallery(self):
        for path in ATTENDANCE_FILES:
            source = text(path)
            for name, pattern in FORBIDDEN.items():
                with self.subTest(file=path, forbidden=name):
                    self.assertIsNone(re.search(pattern, source), f'{path} contains {name}')

    def test_the_only_source_of_the_attendance_photo_is_a_frame_drawn_from_the_live_camera(self):
        source = text('assets/js/student/attendance.js')
        self.assertIn('getUserMedia', source)
        assignments = re.findall(r'attendancePhoto\s*=\s*([^;\n]+)', source)
        self.assertTrue(assignments)
        for value in assignments:
            self.assertTrue(value.strip() == "''" or value.strip().startswith("canvas.toDataURL('image/jpeg'"), value)

    def test_the_capture_screen_has_a_video_and_a_canvas_and_no_upload_control(self):
        page = text('pages/student/attendance.html')
        self.assertIn('id="attendanceCamera"', page)
        self.assertIn('id="attendanceCanvas"', page)
        self.assertNotIn('<input', page.split('id="attendanceCameraModal"', 1)[1].split('</div></div>', 1)[0])
