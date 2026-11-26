import contextlib
import io
import json
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path

import benchmark as bm
import evaluate_matching as ev

VOCAB = {
    'BSCS': ['Python', 'SQL', 'Git', 'Linux', 'Networking', 'Java'],
    'BSHM': ['Front Desk', 'Housekeeping', 'Food Safety', 'Guest Service', 'Events', 'Bartending'],
    'BSBA': ['Bookkeeping', 'Excel', 'Marketing', 'Sales', 'Canva', 'Inventory'],
}


def raw_population(students_per_program=3, postings_per_course=4):
    students, postings = [], []
    for program, vocab in VOCAB.items():
        for i in range(students_per_program):
            students.append({'key': f'{program.lower()}{i}@example.test', 'program': program,
                             'skills_raw': [vocab[(i + k) % len(vocab)] for k in range(3)]})
        for j in range(postings_per_course):
            postings.append({'key': f'post-{program.lower()}-{j}', 'course': program,
                             'title': f'{program} role {j}', 'skills_raw': [vocab[(j + k) % len(vocab)] for k in range(3)]})
    return students, postings


def fill_sheets(out_dir, rating_for):
    """Write ratings into every rater sheet. rating_for(rater_number, pair_id) -> number, text or None."""
    for sheet in sorted(Path(out_dir).glob('hr_sheet_R*.csv')):
        number = int(sheet.stem[-2:])
        columns, rows = bm._read_csv(sheet)
        for row in rows:
            value = rating_for(number, row['pair_id'])
            row['rating'] = '' if value is None else str(value)
        bm._write_csv(sheet, columns, rows)


def kinds(out_dir):
    _, rows = bm._read_csv(Path(out_dir) / 'benchmark_key_PRIVATE.csv')
    return {row['pair_id']: row['kind'] for row in rows}


def word_overlap_scorer(student, job):
    a, b = {s.lower() for s in student}, {s.lower() for s in job}
    return 0.1 + 0.8 * len(a & b) / len(a | b)


class CleaningTests(unittest.TestCase):
    def test_ordinary_skills_are_kept_and_whitespace_collapsed(self):
        self.assertEqual(bm.clean_skill('  Python   3 '), 'Python 3')
        self.assertEqual(bm.clean_skill('ISO 27001'), 'ISO 27001')
        self.assertEqual(bm.clean_skill('Office 365'), 'Office 365')

    def test_identifier_like_or_malformed_skills_are_dropped(self):
        for bad in ('', ' ', 'x', 'a' * 61, 'juan@school.edu.ph', 'www.mysite.com', 'https://x.io/me',
                    'call 0917 123 4567', 'ID 20241234567', None):
            with self.subTest(bad=bad):
                self.assertIsNone(bm.clean_skill(bad))

    def test_semicolons_cannot_break_the_csv_list_format(self):
        self.assertEqual(bm.clean_skill('Sales; Marketing'), 'Sales, Marketing')

    def test_clean_skills_dedupes_case_insensitively_and_counts_drops(self):
        skills, dropped = bm.clean_skills(['SQL', 'sql', 'Python', 'a@b.com', '', 'Git'])
        self.assertEqual(skills, ['SQL', 'Python', 'Git'])
        self.assertEqual(dropped, 2)

    def test_titles_are_trimmed_and_identifier_like_titles_are_replaced(self):
        self.assertEqual(bm.clean_title('  QA   Intern '), 'QA Intern')
        self.assertEqual(bm.clean_title('Apply at hr@firm.com'), 'Untitled posting')
        self.assertEqual(bm.clean_title(''), 'Untitled posting')
        self.assertEqual(len(bm.clean_title('x' * 500)), bm.MAX_TITLE_LENGTH)

    def test_read_list_ignores_comments_and_blank_lines_and_lowercases(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'list.txt'
            path.write_text('﻿# consented\nAna@Example.test\n\n  ben@example.test  \n', encoding='utf-8')
            self.assertEqual(bm.read_list(path), {'ana@example.test', 'ben@example.test'})


class PrepareTests(unittest.TestCase):
    def test_pseudonyms_are_unique_and_students_that_cannot_be_rated_are_excluded(self):
        students_raw, postings_raw = raw_population()
        students_raw += [
            {'key': 'few@example.test', 'program': 'BSCS', 'skills_raw': ['Python']},        # one skill
            {'key': 'odd@example.test', 'program': None, 'skills_raw': ['Python', 'SQL']},  # unknown program
        ]
        postings_raw.append({'key': 'bad-post', 'course': 'BSCS', 'title': 't', 'skills_raw': ['SQL']})
        students, postings, notes = bm.prepare(students_raw, postings_raw, seed=1)
        self.assertEqual((len(students), len(postings)), (9, 12))
        self.assertEqual((notes['students_excluded'], notes['postings_excluded']), (2, 1))
        self.assertEqual(len({s['sid'] for s in students}), 9)
        self.assertTrue(all(s['sid'].startswith('S') and '@' not in s['sid'] for s in students))

    def test_prepare_is_reproducible_from_the_seed(self):
        raw = raw_population()
        first = [s['ref'] for s in bm.prepare(*raw, seed=3)[0]]
        self.assertEqual(first, [s['ref'] for s in bm.prepare(*raw, seed=3)[0]])
        self.assertNotEqual(first, [s['ref'] for s in bm.prepare(*raw, seed=4)[0]])


class BuildPairsTests(unittest.TestCase):
    def build(self, n=30, cross_share=0.4, seed=5, **population):
        students, postings, _ = bm.prepare(*raw_population(**population), seed=seed)
        return bm.build_pairs(students, postings, n, cross_share, seed)

    def test_composition_is_balanced_by_program_and_follows_the_cross_share(self):
        pairs, warnings = self.build()
        self.assertEqual(warnings, [])
        self.assertEqual(len(pairs), 30)
        for program in bm.PROGRAMS:
            mine = [p for p in pairs if p['student']['program'] == program]
            self.assertEqual(len(mine), 10)
            self.assertEqual(sum(p['kind'] == 'same-course' for p in mine), 6)
            self.assertTrue(all((p['posting']['course'] == program) == (p['kind'] == 'same-course') for p in mine))

    def test_pairs_are_unique_ids_are_contiguous_and_usage_is_spread(self):
        pairs, _ = self.build()
        self.assertEqual(len({(p['student']['sid'], p['posting']['pid']) for p in pairs}), 30)
        self.assertEqual(sorted(p['pair_id'] for p in pairs), [f'P{i:03d}' for i in range(1, 31)])
        uses = [sum(p['student']['sid'] == sid for p in pairs) for sid in {p['student']['sid'] for p in pairs}]
        self.assertLessEqual(max(uses) - min(uses), 1)  # 10 pairs over 3 students per program

    def test_selection_is_reproducible_and_seed_dependent(self):
        ids = lambda pairs: [(p['student']['sid'], p['posting']['pid'], p['kind']) for p in sorted(pairs, key=lambda p: p['pair_id'])]
        self.assertEqual(ids(self.build(seed=9)[0]), ids(self.build(seed=9)[0]))
        self.assertNotEqual(ids(self.build(seed=9)[0]), ids(self.build(seed=10)[0]))

    def test_one_hundred_pairs_split_34_33_33_across_programs(self):
        pairs, warnings = self.build(n=100, students_per_program=3, postings_per_course=12)
        self.assertEqual(warnings, [])
        counts = sorted(sum(p['student']['program'] == program for p in pairs) for program in bm.PROGRAMS)
        self.assertEqual(counts, [33, 33, 34])

    def test_shortage_is_reported_not_hidden(self):
        students, postings, _ = bm.prepare([raw_population()[0][0]], [raw_population()[1][0]], seed=1)
        pairs, warnings = bm.build_pairs(students, postings, 10, 0.4, 1)
        self.assertEqual(len(pairs), 1)
        text = ' '.join(warnings)
        self.assertIn('Built 1 of the 10', text)
        self.assertIn('No eligible students in BSHM', text)

    def test_no_students_means_no_pairs(self):
        self.assertEqual(bm.build_pairs([], [], 10, 0.4, 1)[0], [])


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.out = Path(self.tmp.name) / 'benchmark'

    def export(self, **kwargs):
        options = dict(n=30, raters=3, seed=5)
        options.update(kwargs)
        return bm.export(*raw_population(), self.out, **options)

    def test_expected_files_are_written(self):
        summary = self.export()
        names = sorted(p.name for p in self.out.iterdir())
        self.assertEqual(names, ['benchmark_key_PRIVATE.csv', 'benchmark_pairs_master.csv', 'export_summary.json',
                                 'hr_rubric_DRAFT.md', 'hr_sheet_R01.csv', 'hr_sheet_R02.csv', 'hr_sheet_R03.csv'])
        self.assertEqual(summary['pairs'], 30)
        self.assertIn('never used', summary['selection_rule'])
        self.assertEqual(json.loads((self.out / 'export_summary.json').read_text())['pairs'], 30)
        self.assertIn('DRAFT', (self.out / 'hr_rubric_DRAFT.md').read_text(encoding='utf-8'))

    def test_nothing_that_identifies_a_person_or_company_reaches_the_rater_files(self):
        self.export()
        for path in list(self.out.glob('hr_sheet_R*.csv')) + [self.out / 'benchmark_pairs_master.csv']:
            text = path.read_text(encoding='utf-8-sig')
            self.assertNotIn('@', text, path.name)
            self.assertNotIn('post-', text, path.name)
            self.assertNotIn('example.test', text, path.name)
        key = (self.out / 'benchmark_key_PRIVATE.csv').read_text(encoding='utf-8-sig')
        self.assertIn('example.test', key)  # the private key does map back, and says so in its name

    def test_sheets_have_blank_ratings_all_pairs_and_a_different_order_per_rater(self):
        self.export()
        _, first = bm._read_csv(self.out / 'hr_sheet_R01.csv')
        _, second = bm._read_csv(self.out / 'hr_sheet_R02.csv')
        self.assertEqual({row['rating'] for row in first}, {''})
        self.assertEqual(sorted(r['pair_id'] for r in first), sorted(r['pair_id'] for r in second))
        self.assertNotEqual([r['pair_id'] for r in first], [r['pair_id'] for r in second])
        self.assertEqual(list(first[0]), bm.SHEET_COLUMNS)

    def test_existing_files_are_not_overwritten_without_force(self):
        self.export()
        fill_sheets(self.out, lambda number, pair_id: 4)
        with self.assertRaisesRegex(ValueError, 'Refusing to overwrite'):
            self.export()
        _, rows = bm._read_csv(self.out / 'hr_sheet_R01.csv')
        self.assertEqual({row['rating'] for row in rows}, {'4'})  # completed work survived
        self.export(force=True)
        _, rows = bm._read_csv(self.out / 'hr_sheet_R01.csv')
        self.assertEqual({row['rating'] for row in rows}, {''})

    def test_argument_limits(self):
        with self.assertRaisesRegex(ValueError, 'cross-share'):
            self.export(cross_share=1.5)
        with self.assertRaisesRegex(ValueError, 'raters'):
            self.export(raters=1)
        with self.assertRaisesRegex(ValueError, 'No pairs'):
            bm.export([], [], self.out, n=10, raters=2)


class MergeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.out = Path(self.tmp.name) / 'benchmark'
        bm.export(*raw_population(), self.out, n=30, raters=3, seed=5)
        self.master = self.out / 'benchmark_pairs_master.csv'
        self.merged = Path(self.tmp.name) / 'pairs.csv'

    def merge(self):
        return bm.merge_sheets(self.master, self.out, self.merged)

    def test_complete_sheets_merge_into_the_evaluation_format(self):
        fill_sheets(self.out, lambda number, pair_id: {1: 5, 2: 1, 3: 4}[number])
        result = self.merge()
        self.assertEqual((result['pairs'], result['raters']), (30, 3))
        pairs = ev.load_pairs(self.merged)  # the evaluator accepts it as is
        self.assertEqual({p.source for p in pairs}, {'real'})
        self.assertEqual(pairs[0].ratings, [5.0, 1.0, 4.0])  # rater_1..3 follow the sheet file order

    def test_incomplete_or_invalid_ratings_are_listed_not_guessed(self):
        def rating(number, pair_id):
            if number == 1 and pair_id == 'P001':
                return None
            if number == 2 and pair_id == 'P002':
                return 6
            if number == 3 and pair_id == 'P003':
                return 'high'
            return 3
        fill_sheets(self.out, rating)
        with self.assertRaises(ValueError) as caught:
            self.merge()
        message = str(caught.exception)
        for needle in ('R01 P001: rating is missing', 'R02 P002', 'outside 1 to 5', "R03 P003: rating is 'high'"):
            self.assertIn(needle, message)
        self.assertFalse(self.merged.exists())

    def test_edited_skills_unknown_missing_and_duplicate_rows_are_caught(self):
        fill_sheets(self.out, lambda number, pair_id: 3)
        sheet = self.out / 'hr_sheet_R01.csv'
        columns, rows = bm._read_csv(sheet)
        rows[0]['student_skills'] += '; Hacking'                                   # edited text
        rows[1]['pair_id'] = 'P999'                                                # unknown pair
        rows.pop(2)                                                                # a missing pair
        rows.append(dict(rows[3]))                                                 # a duplicated row
        bm._write_csv(sheet, columns, rows)
        with self.assertRaises(ValueError) as caught:
            self.merge()
        message = str(caught.exception)
        for needle in ('skills text was edited', "unknown pair 'P999'", 'is not in the sheet', 'appears twice'):
            self.assertIn(needle, message)

    def test_a_single_sheet_or_wrong_columns_cannot_be_merged(self):
        fill_sheets(self.out, lambda number, pair_id: 3)
        (self.out / 'hr_sheet_R02.csv').unlink()
        (self.out / 'hr_sheet_R03.csv').unlink()
        with self.assertRaisesRegex(ValueError, 'need at least two'):
            self.merge()
        (self.out / 'hr_sheet_R02.csv').write_text('a;b;c\n1;2;3\n', encoding='utf-8')
        (self.out / 'hr_sheet_R03.csv').write_text('a;b;c\n1;2;3\n', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'CSV UTF-8'):
            self.merge()


class FetchTests(unittest.TestCase):
    STUDENTS = [
        {'email': 'Ana@Example.test', 'program': 'BS Computer Science',
         'payload': json.dumps({'soft': ['Teamwork', 'Communication'], 'hard': ['Python', 'SQL']})},
        {'email': 'ben@example.test', 'program': 'BS Hospitality Management',
         'payload': {'soft': [], 'hard': ['Front Desk', 'Housekeeping']}},
        {'email': 'nope@example.test', 'program': 'BS Business Administration', 'payload': {'hard': ['Excel', 'Sales']}},
        {'email': 'cy@example.test', 'program': 'BS Culinary Arts', 'payload': {'hard': ['Baking', 'Plating']}},
    ]
    POSTINGS = [
        {'id': 'post-1', 'payload': json.dumps({'title': 'QA Intern', 'course': 'BSCS', 'skills': [['SQL'], ['Python']]})},
        {'id': 'post-2', 'payload': {'title': 'Other', 'course': 'BSBA', 'skills': [['Excel']]}},
    ]

    def fake_database(self):
        students, postings = self.STUDENTS, self.POSTINGS

        class Cursor:
            def execute(self, sql, *args):
                self.sql = sql

            def fetchall(self):
                return students if 'student_accounts' in self.sql else postings

        class Connection:
            def cursor(self, dictionary=False):
                return Cursor()

        @contextmanager
        def database():
            yield Connection()
        return database

    def test_only_consenting_students_and_approved_postings_are_read(self):
        students, postings, notes = bm.fetch_from_db({'ana@example.test', 'ben@example.test', 'cy@example.test'},
                                                     {'post-1'}, database=self.fake_database())
        self.assertEqual({s['key'] for s in students}, {'ana@example.test', 'ben@example.test', 'cy@example.test'})
        self.assertNotIn('nope@example.test', {s['key'] for s in students})
        self.assertEqual([p['key'] for p in postings], ['post-1'])
        ana = next(s for s in students if s['key'] == 'ana@example.test')
        self.assertEqual((ana['program'], ana['skills_raw']), ('BSCS', ['Teamwork', 'Communication', 'Python', 'SQL']))
        self.assertIsNone(next(s for s in students if s['key'] == 'cy@example.test')['program'])
        self.assertEqual(postings[0]['skills_raw'], ['SQL', 'Python'])
        self.assertEqual(notes['consenting_students_with_a_saved_resume'], 3)
        self.assertEqual(notes['approved_postings_found'], 1)

    def test_students_outside_a_known_program_are_dropped_by_prepare(self):
        students, _, _ = bm.fetch_from_db({'cy@example.test'}, {'post-1'}, database=self.fake_database())
        prepared, _, notes = bm.prepare(students, [], seed=1)
        self.assertEqual(prepared, [])
        self.assertEqual(notes['students_excluded'], 1)


class CommandLineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)
        self.consent = self.dir / 'consent.txt'
        self.consent.write_text('consenting@example.test\n', encoding='utf-8')
        self.approved = self.dir / 'approved.txt'
        self.approved.write_text('post-bscs-0\n', encoding='utf-8')
        self.out = self.dir / 'benchmark'

    @staticmethod
    def fetch(consented, approved):
        students, postings = raw_population()
        return students, postings, {'consent_list_entries': len(consented)}

    def run_main(self, *args, fetch=None):
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = bm.main(list(args), fetch=fetch)
        return code, stdout.getvalue(), stderr.getvalue()

    def test_export_then_merge_then_evaluate_round_trip(self):
        code, out, _ = self.run_main('export', '--consent-list', str(self.consent), '--approved-postings',
                                     str(self.approved), '--pairs', '60', '--raters', '3', '--out', str(self.out),
                                     fetch=self.fetch)
        self.assertEqual(code, 0)
        self.assertIn('Built 60 pairs for 3 evaluators', out)
        self.assertIn('benchmark_key_PRIVATE.csv', out)
        kind_of = kinds(self.out)
        high = {1: 5, 2: 4, 3: 5}
        low = {1: 1, 2: 2, 3: 1}
        fill_sheets(self.out, lambda number, pair_id: (high if kind_of[pair_id] == 'same-course' else low)[number])
        merged = self.dir / 'pairs.csv'
        code, out, _ = self.run_main('merge', '--sheets', str(self.out), '--out', str(merged))
        self.assertEqual(code, 0)
        self.assertIn('Merged 60 pairs from 3 evaluators', out)
        results = ev.evaluate(ev.load_pairs(merged), word_overlap_scorer, resamples=50, seed=3)  # real pairs: no flag
        self.assertTrue(results['reporting_status'].startswith('Eligible for reporting'))
        self.assertEqual(results['split']['calibration'] + results['split']['held_out'], 60)
        self.assertEqual(results['run']['relevant_pairs'], 36)  # 60% same-course pairs were rated high
        self.assertGreater(results['agreement']['fleiss_kappa'], 0.5)

    def test_empty_consent_list_is_refused_before_touching_the_database(self):
        self.consent.write_text('# nobody yet\n', encoding='utf-8')

        def must_not_run(*args):
            raise AssertionError('the database must not be read without consent entries')

        code, _, err = self.run_main('export', '--consent-list', str(self.consent), '--approved-postings',
                                     str(self.approved), '--out', str(self.out), fetch=must_not_run)
        self.assertEqual(code, 2)
        self.assertIn('at least one entry', err)

    def test_missing_database_settings_give_a_clear_error_not_a_traceback(self):
        def unavailable(*args):
            raise RuntimeError('Set IC_DB_USER and IC_DB_PASSWORD before starting the app API.')

        code, _, err = self.run_main('export', '--consent-list', str(self.consent), '--approved-postings',
                                     str(self.approved), '--out', str(self.out), fetch=unavailable)
        self.assertEqual(code, 2)
        self.assertIn('IC_DB_USER', err)

    def test_merge_reports_problems_with_exit_code_two(self):
        self.run_main('export', '--consent-list', str(self.consent), '--approved-postings', str(self.approved),
                      '--pairs', '30', '--raters', '2', '--out', str(self.out), fetch=self.fetch)
        code, _, err = self.run_main('merge', '--sheets', str(self.out), '--out', str(self.dir / 'pairs.csv'))
        self.assertEqual(code, 2)
        self.assertIn('rating is missing', err)


if __name__ == '__main__':
    unittest.main()
