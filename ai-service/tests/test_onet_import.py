import csv
import io
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from onet_import import import_archive
from onet_occupations import OccupationCatalog
from onet_skills import load_skill_catalog, normalize_skills


def make_archive(path, broken=False):
    ratings = [
        ['O*NET-SOC Code', 'Element ID', 'Element Name', 'Scale ID', 'Data Value', 'Recommend Suppress', 'Not Relevant'],
        ['15-1252.00', '2.A.1', 'Critical Thinking', 'IM', '4.0', 'N', ''],
        ['15-1252.00', '2.A.2', 'Suppressed skill', 'IM', '4.9', 'Y', ''],
        ['15-1252.00', '2.A.3', 'Irrelevant skill', 'IM', '4.8', 'N', 'Y'],
        ['15-1252.00', '2.A.1', 'Critical Thinking', 'LV', '5.0', 'N', ''],
    ]
    tables = {
        'essential_skills.csv': ratings,
        'transferable_skills.csv': [ratings[0], ['15-1252.00', '2.B.1', 'Programming', 'IM', '4.5', 'N', '']],
        'knowledge.csv': [ratings[0], ['15-1252.00', '2.C.1', 'Computers', 'IM', '4.2', 'N', '']],
        'occupation_data.csv': [['O*NET-SOC Code', 'Title', 'Description'], ['15-1252.00', 'Software Developers', 'Develop software.']],
        'job_titles.csv': [['O*NET-SOC Code', 'Job Title', 'Short Title'], ['15-1252.00', 'Coder', '']],
        'sample_of_reported_titles.csv': [['O*NET-SOC Code', 'Reported Job Title'], ['15-1252.00', 'App Developer']],
        'software_skills.csv': [['O*NET-SOC Code', 'Workplace Example', 'Element ID', 'Element Name'], ['15-1252.00', 'Python', '2.E.1', 'Development software']],
        'task_statements.csv': [['O*NET-SOC Code', 'Task ID', 'Task', 'Task Type'], ['15-1252.00', '1', 'Develop applications.', 'Core']],
    }
    if broken:
        tables['task_statements.csv'] = [['wrong header'], ['wrong data']]
    with ZipFile(path, 'w') as archive:
        for name, rows in tables.items():
            buffer = io.StringIO(newline='')
            csv.writer(buffer).writerows(rows)
            archive.writestr('db_31_0_csv/' + name, buffer.getvalue())
        archive.writestr('../outside.txt', 'must not be extracted')


class OnetImportTests(unittest.TestCase):
    def test_import_activates_vocabulary_and_occupation_context(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            root = Path(directory)
            archive = root / 'database.zip'
            make_archive(archive)
            data = root / 'data'
            manifest = import_archive(archive, data)
            self.assertEqual(manifest['version'], '31.0')
            self.assertEqual(len(manifest['row_counts']), 8)
            self.assertFalse((root / 'outside.txt').exists())
            self.assertEqual(normalize_skills(['PYTHON'], load_skill_catalog(data)), ['Python'])
            catalog = OccupationCatalog(data)
            self.assertEqual(catalog.search('coder')[0]['code'], '15-1252.00')
            self.assertEqual(catalog.search('app developer')[0]['exact_title_match'], True)
            self.assertEqual(catalog.search('unrelated role'), [])
            profile = catalog.get('15-1252.00')
            self.assertEqual([item['name'] for item in profile['skills']], ['Programming', 'Critical Thinking'])
            self.assertEqual(profile['software'], ['Python'])
            self.assertEqual(profile['knowledge'][0]['name'], 'Computers')
            self.assertEqual(profile['tasks'][0]['description'], 'Develop applications.')
            self.assertIsNone(catalog.get('00-0000.00'))

    def test_bad_archive_preserves_existing_data(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            root = Path(directory)
            archive = root / 'database.zip'
            make_archive(archive, broken=True)
            data = root / 'data'
            data.mkdir()
            original = data / 'essential_skills.csv'
            original.write_text('existing data', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'missing required columns'):
                import_archive(archive, data)
            self.assertEqual(original.read_text(encoding='utf-8'), 'existing data')
            self.assertFalse((data / 'manifest.json').exists())

    def test_wrong_version_is_rejected(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            archive = Path(directory) / 'database.zip'
            with ZipFile(archive, 'w') as output:
                output.writestr('db_30_0_csv/essential_skills.csv', 'old data')
            with self.assertRaisesRegex(ValueError, '31.0'):
                import_archive(archive, Path(directory) / 'data')
