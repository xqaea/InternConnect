"""Offline evaluation of the semantic matching engine, following thesis Chapter 3 (Sampling Procedure, Table 4).

Input: a CSV of human-rated student-profile / job-posting pairs (format below).
Method, in order:
  1. Label a pair relevant when the mean HR rating is 4.0 or higher.
  2. Split the pairs 80/20, stratified by label, with a fixed seed: a calibration set and a held-out set.
  3. Select the similarity threshold tau with stratified 5-fold cross-validation on the calibration set only
     (candidate with the highest mean validation-fold F1).
  4. Report precision, recall and F1 at that tau on the held-out set only, with bootstrap 95% confidence intervals.
  5. Report Pearson r between the mean HR rating and the similarity score, and Fleiss' kappa among the raters
     (each rater's rating of 4 or higher counts as "relevant").

Scores come from the service's own /api/match/score code path (`main.score_match`): the local Sentence-BERT model,
O*NET skill normalisation and cosine similarity. Nothing is retrained.

CSV columns (UTF-8, header required):
  pair_id          unique text id, no personal data
  source           "real" or "synthetic"
  student_skills   skills separated by ";"
  job_skills       the posting's required skills separated by ";"
  rater_1 ... rater_N   each HR evaluator's 1-5 relevance rating (at least two raters, every rater on every pair)

Synthetic pairs are for pipeline testing only. The script refuses them unless --allow-synthetic is given, and then
marks every output file NOT FOR REPORTING, because the thesis excludes synthetic data from calibration and evaluation.

Usage (from the ai-service folder):
  .venv\\Scripts\\python.exe evaluate_matching.py --input path\\to\\pairs.csv
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Callable

import numpy as np

RELEVANT_MEAN = 4.0      # mean HR rating at or above this labels a pair relevant
RELEVANT_RATING = 4.0    # a single rater's rating at or above this counts as "relevant" for Fleiss' kappa
BASELINE_TAU = 0.60      # development baseline from Chapter 3; only a tie-breaker and a reference line here
TEST_FRACTION = 0.20
FOLDS = 5
PLANNED_PAIRS = 100      # Chapter 3 plans N = 100 benchmark pairs


@dataclass(frozen=True)
class Pair:
    pair_id: str
    source: str
    student_skills: list[str]
    job_skills: list[str]
    ratings: list[float]
    mean: float
    relevant: bool


def _skills(text: str) -> list[str]:
    return [item.strip() for item in str(text).split(';') if item.strip()]


def load_pairs(path: str | Path) -> list[Pair]:
    """Read and validate the rated pairs. Raises ValueError naming the CSV line of the first problem."""
    with open(path, encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        fields = reader.fieldnames or []
        missing = [name for name in ('pair_id', 'source', 'student_skills', 'job_skills') if name not in fields]
        if missing:
            raise ValueError('Missing column(s): ' + ', '.join(missing))
        raters = [name for name in fields if name.startswith('rater_')]
        if len(raters) < 2:
            raise ValueError('Provide at least two rater columns named rater_1, rater_2, ...')
        pairs: list[Pair] = []
        seen: set[str] = set()
        for line, row in enumerate(reader, start=2):
            pair_id = (row.get('pair_id') or '').strip()
            if not pair_id:
                raise ValueError(f'Line {line}: pair_id is empty.')
            if pair_id in seen:
                raise ValueError(f'Line {line}: duplicate pair_id {pair_id!r}.')
            seen.add(pair_id)
            source = (row.get('source') or '').strip().lower()
            if source not in ('real', 'synthetic'):
                raise ValueError(f'Line {line}: source must be "real" or "synthetic", got {source!r}.')
            student, job = _skills(row.get('student_skills', '')), _skills(row.get('job_skills', ''))
            if not student or not job:
                raise ValueError(f'Line {line}: student_skills and job_skills must each list at least one skill.')
            ratings = []
            for name in raters:
                text = (row.get(name) or '').strip()
                try:
                    value = float(text)
                except ValueError:
                    raise ValueError(f'Line {line}: {name} is missing or not a number ({text!r}).') from None
                if not 1.0 <= value <= 5.0 or value != value:
                    raise ValueError(f'Line {line}: {name} must be between 1 and 5, got {text!r}.')
                ratings.append(value)
            mean = float(np.mean(ratings))
            pairs.append(Pair(pair_id, source, student, job, ratings, mean, round(mean, 9) >= RELEVANT_MEAN))
    if not pairs:
        raise ValueError('The CSV has no rated pairs.')
    return pairs


def split_stratified(labels, test_fraction: float = TEST_FRACTION, seed: int = 42):
    """Return (calibration_indices, held_out_indices), stratified by label and reproducible from the seed."""
    labels = np.asarray(labels, dtype=bool)
    rng = np.random.default_rng(seed)
    held: list[int] = []
    for value, name in ((True, 'relevant'), (False, 'not relevant')):
        indices = np.flatnonzero(labels == value)
        if len(indices) < 2:
            raise ValueError(f'Need at least 2 {name} pairs to split; found {len(indices)}.')
        indices = rng.permutation(indices)
        count = min(len(indices) - 1, max(1, round(test_fraction * len(indices))))
        held.extend(int(i) for i in indices[:count])
    held_out = np.array(sorted(held))
    calibration = np.setdiff1d(np.arange(len(labels)), held_out)
    return calibration, held_out


def stratified_folds(labels, k: int = FOLDS, seed: int = 42):
    """k validation-index arrays that partition the given labels, each class spread evenly across folds."""
    labels = np.asarray(labels, dtype=bool)
    rng = np.random.default_rng(seed)
    folds: list[list[int]] = [[] for _ in range(k)]
    for value, name in ((True, 'relevant'), (False, 'not relevant')):
        indices = np.flatnonzero(labels == value)
        if len(indices) < k:
            raise ValueError(
                f'Stratified {k}-fold validation needs at least {k} {name} pairs in the calibration set; '
                f'found {len(indices)}. Add more rated pairs.')
        for position, index in enumerate(rng.permutation(indices)):
            folds[position % k].append(int(index))
    return [np.array(sorted(fold)) for fold in folds]


def prf(y_true, y_pred) -> dict:
    """Precision, recall and F1 for the "relevant" class. An undefined ratio (no positives) counts as 0.0."""
    y_true, y_pred = np.asarray(y_true, dtype=bool), np.asarray(y_pred, dtype=bool)
    tp = int(np.sum(y_true & y_pred))
    fp = int(np.sum(~y_true & y_pred))
    fn = int(np.sum(y_true & ~y_pred))
    tn = int(np.sum(~y_true & ~y_pred))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {'precision': precision, 'recall': recall, 'f1': f1, 'tp': tp, 'fp': fp, 'fn': fn, 'tn': tn}


def select_threshold(scores, labels, folds, grid=None, baseline: float = BASELINE_TAU) -> dict:
    """Pick tau from calibration data. `folds` are validation-index arrays into `scores` / `labels`.

    Each candidate tau is scored by its mean F1 over the validation folds. Ties go to the candidate closest to the
    baseline, then to the lower tau. Only calibration data may be passed in.
    """
    scores, labels = np.asarray(scores, dtype=float), np.asarray(labels, dtype=bool)
    grid = np.round(np.arange(0.0, 1.0000001, 0.01), 4) if grid is None else np.asarray(grid, dtype=float)
    curve = []
    for tau in grid:
        fold_f1 = [prf(labels[fold], scores[fold] >= tau)['f1'] for fold in folds]
        curve.append({
            'threshold': float(tau),
            'mean_f1': float(np.mean(fold_f1)),
            'sd_f1': float(np.std(fold_f1, ddof=1)) if len(fold_f1) > 1 else 0.0,
            'fold_f1': [float(value) for value in fold_f1],
        })
    best = max(curve, key=lambda item: (round(item['mean_f1'], 12), -abs(item['threshold'] - baseline), -item['threshold']))
    return {**best, 'curve': curve}


def bootstrap_prf_ci(y_true, y_pred, resamples: int = 2000, seed: int = 42, level: float = 0.95) -> dict:
    """Percentile bootstrap interval for precision, recall and F1 (pairs resampled with replacement)."""
    y_true, y_pred = np.asarray(y_true, dtype=bool), np.asarray(y_pred, dtype=bool)
    rng = np.random.default_rng(seed)
    count = len(y_true)
    draws = {'precision': [], 'recall': [], 'f1': []}
    for _ in range(resamples):
        sample = rng.integers(0, count, count)
        result = prf(y_true[sample], y_pred[sample])
        for key in draws:
            draws[key].append(result[key])
    low = (1 - level) / 2 * 100
    return {key: [float(np.percentile(values, low)), float(np.percentile(values, 100 - low))] for key, values in draws.items()}


def pearson(x, y):
    """Pearson r, or None when it is undefined (fewer than 3 points or no variation)."""
    x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
    if len(x) < 3 or np.std(x) == 0 or np.std(y) == 0:
        return None
    return float(np.corrcoef(x, y)[0, 1])


def bootstrap_pearson_ci(x, y, resamples: int = 2000, seed: int = 42, level: float = 0.95):
    x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
    rng = np.random.default_rng(seed)
    values = []
    for _ in range(resamples):
        sample = rng.integers(0, len(x), len(x))
        r = pearson(x[sample], y[sample])
        if r is not None:
            values.append(r)
    if len(values) < resamples * 0.9:
        return None  # too many degenerate resamples to give an honest interval
    low = (1 - level) / 2 * 100
    return [float(np.percentile(values, low)), float(np.percentile(values, 100 - low))]


def interpret_r(r) -> str:
    """Chapter 3 Table 6 wording for the strength of r."""
    if r is None:
        return 'undefined'
    size = round(abs(r), 2)
    strength = ('very strong' if size >= 0.81 else 'strong' if size >= 0.61 else 'moderate' if size >= 0.41
                else 'weak' if size >= 0.21 else 'very weak or no')
    return f"{strength} {'negative' if r < 0 else 'positive'} correlation"


def fleiss_kappa(judgements):
    """Fleiss' kappa for a pairs x raters matrix of binary judgements; None when chance agreement is total."""
    matrix = np.asarray(judgements, dtype=bool)
    pairs, raters = matrix.shape
    if raters < 2:
        raise ValueError('Fleiss kappa needs at least two raters.')
    positives = matrix.sum(axis=1)
    negatives = raters - positives
    agreement = (positives ** 2 + negatives ** 2 - raters) / (raters * (raters - 1))
    observed = float(np.mean(agreement))
    p_positive = float(positives.sum() / (pairs * raters))
    expected = p_positive ** 2 + (1 - p_positive) ** 2
    if expected == 1.0:
        return None
    return float((observed - expected) / (1 - expected))


def evaluate(pairs: list[Pair], scorer: Callable[[list[str], list[str]], float], *, seed: int = 42,
             resamples: int = 2000, grid_step: float = 0.01, allow_synthetic: bool = False,
             model_name: str = 'unknown') -> dict:
    synthetic = [pair.pair_id for pair in pairs if pair.source == 'synthetic']
    if synthetic and not allow_synthetic:
        raise ValueError(
            f'{len(synthetic)} synthetic pair(s) found. Synthetic data is excluded from calibration and evaluation '
            '(thesis Chapter 3). Use real, human-rated pairs, or pass --allow-synthetic to test the pipeline only.')
    status = 'NOT FOR REPORTING: includes synthetic pairs' if synthetic else 'Eligible for reporting (real pairs only)'
    warnings: list[str] = []
    if len(pairs) != PLANNED_PAIRS:
        warnings.append(f'Chapter 3 plans N = {PLANNED_PAIRS} benchmark pairs; this run has N = {len(pairs)}.')

    scores = np.array([scorer(pair.student_skills, pair.job_skills) for pair in pairs], dtype=float)
    labels = np.array([pair.relevant for pair in pairs], dtype=bool)
    means = np.array([pair.mean for pair in pairs], dtype=float)

    calibration, held_out = split_stratified(labels, seed=seed)
    folds = stratified_folds(labels[calibration], seed=seed + 1)
    grid = np.round(np.arange(0.0, 1.0 + grid_step / 2, grid_step), 6)
    selection = select_threshold(scores[calibration], labels[calibration], folds, grid)
    tau = selection['threshold']

    held_pred = scores[held_out] >= tau
    held_metrics = prf(labels[held_out], held_pred)
    held_ci = bootstrap_prf_ci(labels[held_out], held_pred, resamples, seed + 2)
    baseline_metrics = prf(labels[held_out], scores[held_out] >= BASELINE_TAU)
    if len(held_out) < 30:
        warnings.append(f'The held-out set has only {len(held_out)} pairs, so the confidence intervals are wide.')
    if int(labels[held_out].sum()) == 0:
        warnings.append('The held-out set has no relevant pairs; recall is undefined and reported as 0.')

    judgements = np.array([[rating >= RELEVANT_RATING for rating in pair.ratings] for pair in pairs])
    r_all, r_held = pearson(means, scores), pearson(means[held_out], scores[held_out])
    split_of = {int(i): 'calibration' for i in calibration} | {int(i): 'held-out' for i in held_out}
    return {
        'reporting_status': status,
        'warnings': warnings,
        'run': {
            'date': date.today().isoformat(), 'model': model_name, 'pairs': len(pairs),
            'relevant_pairs': int(labels.sum()), 'raters': len(pairs[0].ratings), 'seed': seed,
            'relevant_rule': f'mean HR rating >= {RELEVANT_MEAN}', 'test_fraction': TEST_FRACTION,
            'folds': FOLDS, 'grid_step': grid_step, 'bootstrap_resamples': resamples,
            'baseline_tau': BASELINE_TAU, 'synthetic_pairs': len(synthetic),
        },
        'split': {
            'calibration': len(calibration), 'held_out': len(held_out),
            'calibration_relevant': int(labels[calibration].sum()), 'held_out_relevant': int(labels[held_out].sum()),
            'calibration_pair_ids': [pairs[i].pair_id for i in calibration],
            'held_out_pair_ids': [pairs[i].pair_id for i in held_out],
        },
        'threshold_selection': {
            'tau': tau, 'mean_validation_f1': selection['mean_f1'], 'sd_validation_f1': selection['sd_f1'],
            'fold_f1': selection['fold_f1'], 'curve': selection['curve'],
            'rule': 'highest mean validation-fold F1; ties go to the tau closest to the baseline, then the lower tau',
        },
        'held_out_metrics': {**held_metrics, 'ci95': held_ci, 'tau': tau},
        'baseline_reference': {**baseline_metrics, 'tau': BASELINE_TAU,
                               'note': 'Reference only. tau was not chosen on the held-out set.'},
        'correlation': {
            'pearson_r_all_pairs': r_all, 'interpretation': interpret_r(r_all),
            'ci95_all_pairs': bootstrap_pearson_ci(means, scores, resamples, seed + 3),
            'pearson_r_held_out': r_held,
        },
        'agreement': {
            'fleiss_kappa': fleiss_kappa(judgements),
            'judgement_rule': f'each rater rating >= {RELEVANT_RATING} counts as relevant',
        },
        'pairs': [
            {'pair_id': pair.pair_id, 'source': pair.source, 'mean_rating': round(pair.mean, 4),
             'relevant': pair.relevant, 'similarity': float(scores[i]), 'split': split_of[i]}
            for i, pair in enumerate(pairs)
        ],
    }


def _fmt(value, digits: int = 3) -> str:
    return 'undefined' if value is None else f'{value:.{digits}f}'


def _interval(interval) -> str:
    return 'n/a' if interval is None else f'[{interval[0]:.3f}, {interval[1]:.3f}]'


def render_markdown(results: dict) -> str:
    run, split, tau = results['run'], results['split'], results['threshold_selection']
    held, base = results['held_out_metrics'], results['baseline_reference']
    corr, agree = results['correlation'], results['agreement']
    lines = [
        '# Matching engine evaluation', '',
        f"**Status: {results['reporting_status']}**", '',
        f"Run on {run['date']} with `{run['model']}`. Pairs: {run['pairs']} ({run['relevant_pairs']} relevant), "
        f"{run['raters']} raters, seed {run['seed']}.", '',
    ]
    if results['warnings']:
        lines += ['## Warnings', ''] + [f'- {warning}' for warning in results['warnings']] + ['']
    lines += [
        '## Split', '',
        f"- Calibration set: {split['calibration']} pairs ({split['calibration_relevant']} relevant)",
        f"- Held-out set: {split['held_out']} pairs ({split['held_out_relevant']} relevant), "
        'not used for threshold selection or any other tuning', '',
        '## Threshold selection (calibration set, stratified 5-fold)', '',
        f"- Selected τ = **{tau['tau']:.2f}**",
        f"- Mean validation F1 = {_fmt(tau['mean_validation_f1'])} (SD {_fmt(tau['sd_validation_f1'])} across folds)",
        f"- Rule: {tau['rule']}", '',
        '## Held-out performance at the selected τ', '',
        '| Metric | Value | 95% bootstrap CI |', '|---|---|---|',
        f"| Precision | {_fmt(held['precision'])} | {_interval(held['ci95']['precision'])} |",
        f"| Recall | {_fmt(held['recall'])} | {_interval(held['ci95']['recall'])} |",
        f"| F1 | {_fmt(held['f1'])} | {_interval(held['ci95']['f1'])} |", '',
        f"Counts: TP {held['tp']}, FP {held['fp']}, FN {held['fn']}, TN {held['tn']}. "
        f"Reference at the baseline τ = {base['tau']:.2f} (not chosen on this set): precision {_fmt(base['precision'])}, "
        f"recall {_fmt(base['recall'])}, F1 {_fmt(base['f1'])}.", '',
        '## Human-AI alignment', '',
        f"- Pearson r, mean HR rating vs similarity, all pairs: **{_fmt(corr['pearson_r_all_pairs'])}** "
        f"({corr['interpretation']}), 95% bootstrap CI {_interval(corr['ci95_all_pairs'])}",
        f"- Pearson r on the held-out set only: {_fmt(corr['pearson_r_held_out'])}",
        f"- Fleiss' κ among raters: **{_fmt(agree['fleiss_kappa'])}** ({agree['judgement_rule']})", '',
        '## Notes', '',
        '- Similarity scores are cosine similarities, not probabilities.',
        '- Precision, recall and F1 are for the "relevant" class; an undefined ratio counts as 0.',
        '- The per-pair scores and the full τ curve are in the JSON file.', '',
    ]
    return '\n'.join(lines)


def _model_scorer():
    import main  # the service module: same model, O*NET normalisation and cosine as /api/match/score

    def score(student_skills: list[str], job_skills: list[str]) -> float:
        request = main.MatchRequest(student_skills=student_skills, required_skills=job_skills)
        return float(main.score_match(request)['similarity'])

    return score, main.MODEL_NAME


def main(argv=None, scorer=None, model_name: str = 'injected scorer') -> int:
    parser = argparse.ArgumentParser(description='Evaluate the semantic matching engine on human-rated pairs.')
    parser.add_argument('--input', required=True, help='CSV of rated pairs (see the module docstring)')
    parser.add_argument('--out', default='evaluation_results', help='folder for the JSON and Markdown reports')
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--resamples', type=int, default=2000, help='bootstrap resamples')
    parser.add_argument('--grid-step', type=float, default=0.01, help='spacing of candidate thresholds')
    parser.add_argument('--allow-synthetic', action='store_true', help='pipeline test only; output is marked NOT FOR REPORTING')
    args = parser.parse_args(argv)
    try:
        pairs = load_pairs(args.input)
        if scorer is None:
            scorer, model_name = _model_scorer()
        results = evaluate(pairs, scorer, seed=args.seed, resamples=args.resamples, grid_step=args.grid_step,
                           allow_synthetic=args.allow_synthetic, model_name=model_name)
    except ValueError as error:
        print(f'error: {error}', file=sys.stderr)
        return 2
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    prefix = '' if results['run']['synthetic_pairs'] == 0 else 'NOT_FOR_REPORTING_'
    json_path, md_path = out / f'{prefix}matching_evaluation.json', out / f'{prefix}matching_evaluation.md'
    json_path.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding='utf-8')
    md_path.write_text(render_markdown(results), encoding='utf-8')
    held = results['held_out_metrics']
    print(results['reporting_status'])
    print(f"tau={results['threshold_selection']['tau']:.2f}  held-out precision={held['precision']:.3f} "
          f"recall={held['recall']:.3f} f1={held['f1']:.3f}  "
          f"pearson_r={_fmt(results['correlation']['pearson_r_all_pairs'])}  "
          f"fleiss_kappa={_fmt(results['agreement']['fleiss_kappa'])}")
    print(f'wrote {json_path} and {md_path}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
