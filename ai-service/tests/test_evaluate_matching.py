import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

import evaluate_matching as ev

SAMPLE = Path(__file__).resolve().parents[1] / 'evaluation_sample' / 'pairs_SYNTHETIC_not_for_reporting.csv'
HEADER = 'pair_id,source,student_skills,job_skills,rater_1,rater_2,rater_3\n'


def word_overlap_scorer(student, job):
    """Deterministic stand-in for the model: similarity grows with shared words."""
    a = {word for skill in student for word in skill.lower().split()}
    b = {word for skill in job for word in skill.lower().split()}
    return 0.15 + 0.8 * len(a & b) / len(a | b)


def write_csv(directory, body, name='pairs.csv'):
    path = Path(directory) / name
    path.write_text(HEADER + body, encoding='utf-8')
    return path


class LoadPairsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def load(self, body):
        return ev.load_pairs(write_csv(self.tmp.name, body))

    def test_relevant_label_uses_the_mean_at_four_or_higher(self):
        pairs = self.load('a,real,X,Y,4,4,4\nb,real,X,Y,4,4,3\nc,real,X,Y,5,4,3\n')
        self.assertEqual([p.relevant for p in pairs], [True, False, True])  # 4.0, 3.67, 4.0
        self.assertAlmostEqual(pairs[1].mean, 11 / 3)

    def test_skills_are_split_on_semicolons_and_trimmed(self):
        pair = self.load('a,real, Python ;SQL; ,SQL ; Reporting,5,5,5\n')[0]
        self.assertEqual(pair.student_skills, ['Python', 'SQL'])
        self.assertEqual(pair.job_skills, ['SQL', 'Reporting'])

    def test_invalid_rows_name_the_line(self):
        bad = {
            'duplicate pair_id': 'a,real,X,Y,4,4,4\na,real,X,Y,4,4,4\n',
            'bad source': 'a,maybe,X,Y,4,4,4\n',
            'empty pair_id': ',real,X,Y,4,4,4\n',
            'empty skills': 'a,real,,Y,4,4,4\n',
            'missing rating': 'a,real,X,Y,4,,4\n',
            'rating above 5': 'a,real,X,Y,4,6,4\n',
            'rating below 1': 'a,real,X,Y,4,0,4\n',
            'non-numeric rating': 'a,real,X,Y,4,high,4\n',
        }
        for name, body in bad.items():
            with self.subTest(name), self.assertRaisesRegex(ValueError, r'Line \d'):
                self.load(body)

    def test_missing_columns_and_too_few_raters_are_rejected(self):
        path = Path(self.tmp.name) / 'bad.csv'
        path.write_text('pair_id,source,student_skills,rater_1,rater_2\na,real,X,4,4\n', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'Missing column'):
            ev.load_pairs(path)
        path.write_text('pair_id,source,student_skills,job_skills,rater_1\na,real,X,Y,4\n', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'at least two rater'):
            ev.load_pairs(path)

    def test_empty_file_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'no rated pairs'):
            self.load('')

    def test_the_shipped_sample_is_valid_and_synthetic(self):
        pairs = ev.load_pairs(SAMPLE)
        self.assertEqual(len(pairs), 40)
        self.assertEqual({p.source for p in pairs}, {'synthetic'})
        self.assertEqual(sum(p.relevant for p in pairs), 20)


class SplitTests(unittest.TestCase):
    labels = [True] * 25 + [False] * 25

    def test_split_is_stratified_disjoint_and_complete(self):
        cal, held = ev.split_stratified(self.labels, seed=7)
        self.assertEqual((len(cal), len(held)), (40, 10))
        self.assertEqual(sum(self.labels[i] for i in held), 5)
        self.assertEqual(sum(self.labels[i] for i in cal), 20)
        self.assertEqual(set(cal) & set(held), set())
        self.assertEqual(set(cal) | set(held), set(range(50)))

    def test_split_is_reproducible_and_seed_dependent(self):
        first = ev.split_stratified(self.labels, seed=7)
        again = ev.split_stratified(self.labels, seed=7)
        other = ev.split_stratified(self.labels, seed=8)
        self.assertTrue(np.array_equal(first[1], again[1]))
        self.assertFalse(np.array_equal(first[1], other[1]))

    def test_a_class_with_one_pair_cannot_be_split(self):
        with self.assertRaisesRegex(ValueError, 'at least 2 relevant'):
            ev.split_stratified([True] + [False] * 9)

    def test_folds_partition_the_calibration_set_and_keep_both_classes_in_every_fold(self):
        labels = np.array([True] * 20 + [False] * 20)
        folds = ev.stratified_folds(labels, k=5, seed=3)
        self.assertEqual(sorted(i for fold in folds for i in fold), list(range(40)))
        for fold in folds:
            self.assertEqual((int(labels[fold].sum()), int((~labels[fold]).sum())), (4, 4))

    def test_folds_need_enough_pairs_per_class(self):
        with self.assertRaisesRegex(ValueError, 'at least 5 relevant'):
            ev.stratified_folds([True] * 4 + [False] * 20, k=5)


class MetricTests(unittest.TestCase):
    def test_precision_recall_f1_counts(self):
        result = ev.prf([1, 1, 1, 0, 0, 0], [1, 1, 0, 1, 0, 0])
        self.assertEqual((result['tp'], result['fp'], result['fn'], result['tn']), (2, 1, 1, 2))
        self.assertAlmostEqual(result['precision'], 2 / 3)
        self.assertAlmostEqual(result['recall'], 2 / 3)
        self.assertAlmostEqual(result['f1'], 2 / 3)

    def test_undefined_ratios_count_as_zero(self):
        result = ev.prf([0, 0, 1], [0, 0, 0])  # nothing predicted relevant
        self.assertEqual((result['precision'], result['recall'], result['f1']), (0.0, 0.0, 0.0))
        self.assertEqual(ev.prf([0, 0], [0, 0])['recall'], 0.0)

    def test_pearson(self):
        self.assertAlmostEqual(ev.pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1.0)
        self.assertAlmostEqual(ev.pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1.0)
        self.assertIsNone(ev.pearson([1, 1, 1, 1], [1, 2, 3, 4]))
        self.assertIsNone(ev.pearson([1, 2], [1, 2]))

    def test_interpretation_follows_chapter_three_table_six(self):
        cases = {0.95: 'very strong positive', 0.81: 'very strong positive', 0.70: 'strong positive',
                 0.50: 'moderate positive', -0.30: 'weak negative', 0.10: 'very weak or no positive'}
        for value, expected in cases.items():
            with self.subTest(value):
                self.assertTrue(ev.interpret_r(value).startswith(expected), ev.interpret_r(value))
        self.assertEqual(ev.interpret_r(None), 'undefined')

    def test_fleiss_kappa_known_values(self):
        self.assertAlmostEqual(ev.fleiss_kappa([[1, 1], [0, 0], [1, 0]]), 1 / 3)
        self.assertAlmostEqual(ev.fleiss_kappa([[1, 1], [0, 0], [1, 1], [0, 0]]), 1.0)
        self.assertAlmostEqual(ev.fleiss_kappa([[1, 0], [0, 1]]), -1.0)
        self.assertIsNone(ev.fleiss_kappa([[1, 1], [1, 1]]))  # no variation, chance agreement is total
        with self.assertRaises(ValueError):
            ev.fleiss_kappa([[1], [0]])

    def test_bootstrap_interval_is_reproducible_and_exact_for_a_perfect_classifier(self):
        truth = np.array([1, 1, 1, 0, 0, 0], dtype=bool)
        first = ev.bootstrap_prf_ci(truth, truth, resamples=200, seed=5)
        again = ev.bootstrap_prf_ci(truth, truth, resamples=200, seed=5)
        self.assertEqual(first, again)
        self.assertEqual(first['f1'], [1.0, 1.0])
        noisy = ev.bootstrap_prf_ci(truth, np.array([1, 1, 0, 0, 0, 1], dtype=bool), resamples=500, seed=5)
        low, high = noisy['f1']
        self.assertLess(low, high)
        self.assertTrue(0.0 <= low <= high <= 1.0)


class ThresholdSelectionTests(unittest.TestCase):
    scores = np.array([0.70, 0.80, 0.90, 0.75, 0.85, 0.95, 0.72, 0.78, 0.88, 0.92,
                       0.10, 0.20, 0.30, 0.40, 0.50, 0.15, 0.25, 0.35, 0.45, 0.48])
    labels = np.array([True] * 10 + [False] * 10)

    def test_a_clean_gap_gives_perfect_f1_and_ties_go_to_the_baseline(self):
        folds = ev.stratified_folds(self.labels, k=5, seed=1)
        chosen = ev.select_threshold(self.scores, self.labels, folds)
        self.assertEqual(chosen['mean_f1'], 1.0)
        self.assertEqual(chosen['threshold'], 0.6)  # every tau in (0.50, 0.70] ties; 0.60 is the baseline
        self.assertEqual(len(chosen['curve']), 101)

    def test_ties_away_from_the_baseline_pick_the_closest_then_the_lower(self):
        scores = np.array([0.90] * 5 + [0.80] * 5 + [0.10] * 10)
        labels = np.array([True] * 10 + [False] * 10)
        folds = ev.stratified_folds(labels, k=5, seed=1)
        # Every tau in (0.10, 0.80] gives F1 = 1, so the closest candidate to the baseline wins.
        self.assertEqual(ev.select_threshold(scores, labels, folds, baseline=0.95)['threshold'], 0.8)
        self.assertEqual(ev.select_threshold(scores, labels, folds, baseline=0.5)['threshold'], 0.5)
        # 0.25 and 0.75 are exactly as far from 0.5 and both score F1 = 1: the lower one wins.
        tied = ev.select_threshold(scores, labels, folds, grid=[0.25, 0.75], baseline=0.5)
        self.assertEqual((tied['mean_f1'], tied['threshold']), (1.0, 0.25))

    def test_every_candidate_reports_its_fold_scores(self):
        folds = ev.stratified_folds(self.labels, k=5, seed=1)
        curve = ev.select_threshold(self.scores, self.labels, folds, grid=[0.0, 0.6, 1.0])['curve']
        self.assertEqual([c['threshold'] for c in curve], [0.0, 0.6, 1.0])
        self.assertTrue(all(len(c['fold_f1']) == 5 for c in curve))
        self.assertEqual(curve[2]['mean_f1'], 0.0)  # nothing reaches tau = 1.0


class EvaluateTests(unittest.TestCase):
    def setUp(self):
        self.pairs = ev.load_pairs(SAMPLE)

    def run_eval(self, **kwargs):
        return ev.evaluate(self.pairs, word_overlap_scorer, resamples=100, allow_synthetic=True, **kwargs)

    def test_synthetic_pairs_are_refused_by_default(self):
        with self.assertRaisesRegex(ValueError, 'synthetic'):
            ev.evaluate(self.pairs, word_overlap_scorer, resamples=10)

    def test_synthetic_run_is_marked_not_for_reporting_and_warns_about_size(self):
        results = self.run_eval()
        self.assertTrue(results['reporting_status'].startswith('NOT FOR REPORTING'))
        self.assertTrue(any('N = 40' in warning for warning in results['warnings']))
        self.assertTrue(any('held-out set has only 8' in warning for warning in results['warnings']))

    def test_split_sizes_and_disjoint_ids(self):
        split = self.run_eval()['split']
        self.assertEqual((split['calibration'], split['held_out']), (32, 8))
        self.assertEqual((split['calibration_relevant'], split['held_out_relevant']), (16, 4))
        self.assertEqual(set(split['calibration_pair_ids']) & set(split['held_out_pair_ids']), set())

    def test_the_held_out_set_has_no_influence_on_tau(self):
        first = self.run_eval()
        held = set(first['split']['held_out_pair_ids'])
        ids = {(tuple(p.student_skills), tuple(p.job_skills)): p.pair_id for p in self.pairs}

        def scorer_with_held_out_zeroed(student, job):
            return 0.0 if ids[(tuple(student), tuple(job))] in held else word_overlap_scorer(student, job)

        second = ev.evaluate(self.pairs, scorer_with_held_out_zeroed, resamples=100, allow_synthetic=True)
        self.assertEqual(first['threshold_selection']['tau'], second['threshold_selection']['tau'])
        self.assertEqual(first['threshold_selection']['curve'], second['threshold_selection']['curve'])
        self.assertNotEqual(first['held_out_metrics']['f1'], second['held_out_metrics']['f1'])

    def test_results_are_reproducible_from_the_seed(self):
        self.assertEqual(self.run_eval(seed=11)['held_out_metrics'], self.run_eval(seed=11)['held_out_metrics'])

    def test_reported_quantities_are_present_and_sensible(self):
        results = self.run_eval()
        held = results['held_out_metrics']
        for key in ('precision', 'recall', 'f1'):
            low, high = held['ci95'][key]
            self.assertTrue(0.0 <= low <= high <= 1.0)
        self.assertEqual(held['tp'] + held['fp'] + held['fn'] + held['tn'], 8)
        self.assertGreater(results['correlation']['pearson_r_all_pairs'], 0.5)  # overlap tracks the human ratings
        self.assertGreater(results['agreement']['fleiss_kappa'], 0.5)
        self.assertEqual(len(results['pairs']), 40)
        self.assertEqual({row['split'] for row in results['pairs']}, {'calibration', 'held-out'})
        json.dumps(results)  # must be serialisable as is

    def test_markdown_states_status_tau_and_the_scope_of_the_numbers(self):
        text = ev.render_markdown(self.run_eval())
        for needle in ('NOT FOR REPORTING', 'Selected τ', 'Held-out performance', 'Pearson r', "Fleiss' κ",
                       'not probabilities'):
            self.assertIn(needle, text)


class CommandLineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.out = Path(self.tmp.name) / 'results'

    def run_main(self, *args):
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = ev.main(list(args), scorer=word_overlap_scorer, model_name='fake')
        return code, stdout.getvalue(), stderr.getvalue()

    def test_synthetic_input_is_refused_without_the_flag(self):
        code, _, err = self.run_main('--input', str(SAMPLE), '--out', str(self.out))
        self.assertEqual(code, 2)
        self.assertIn('synthetic', err)
        self.assertFalse(self.out.exists())

    def test_synthetic_run_writes_files_marked_not_for_reporting(self):
        code, out, _ = self.run_main('--input', str(SAMPLE), '--out', str(self.out), '--allow-synthetic',
                                     '--resamples', '50')
        self.assertEqual(code, 0)
        self.assertIn('NOT FOR REPORTING', out)
        names = sorted(path.name for path in self.out.iterdir())
        self.assertEqual(names, ['NOT_FOR_REPORTING_matching_evaluation.json', 'NOT_FOR_REPORTING_matching_evaluation.md'])
        self.assertTrue(json.loads((self.out / names[0]).read_text(encoding='utf-8'))['run']['synthetic_pairs'] > 0)

    def test_real_pairs_write_plainly_named_reports(self):
        rows = SAMPLE.read_text(encoding='utf-8').replace(',synthetic,', ',real,')
        real = Path(self.tmp.name) / 'real.csv'
        real.write_text(rows, encoding='utf-8')
        code, out, _ = self.run_main('--input', str(real), '--out', str(self.out), '--resamples', '50')
        self.assertEqual(code, 0)
        self.assertIn('Eligible for reporting', out)
        self.assertEqual(sorted(path.name for path in self.out.iterdir()),
                         ['matching_evaluation.json', 'matching_evaluation.md'])

    def test_bad_input_returns_an_error_code_not_a_traceback(self):
        bad = Path(self.tmp.name) / 'bad.csv'
        bad.write_text(HEADER + 'a,real,X,Y,4,9,4\n', encoding='utf-8')
        code, _, err = self.run_main('--input', str(bad), '--out', str(self.out))
        self.assertEqual(code, 2)
        self.assertIn('Line 2', err)


if __name__ == '__main__':
    unittest.main()
