"""Build the human-rating benchmark for the matching engine (thesis Chapter 3, Data Collection Procedure).

Step 1, `export`: read consenting students' saved resume skills and research-approved postings from the app database,
pseudonymise them, build student-profile / job-posting pairs, and write one scoring sheet per HR evaluator.
Step 2: the HR evaluators rate every pair from 1 to 5 in their own sheet (see hr_rubric_DRAFT.md).
Step 3, `merge`: check the completed sheets and write the single CSV that `evaluate_matching.py` reads.

Privacy rules this tool enforces (thesis Chapter 3, Data Privacy and Security):
  * Only students listed in a consent file are read, and only postings listed in an approved-postings file.
  * Only skill names and the program code leave the database. No names, emails, student numbers, company names or
    free-text resume fields. Skills that look like identifiers (emails, web addresses, long digit runs) are dropped.
  * Raters see pseudonymous pair ids only. The file that maps aliases back to people (benchmark_key_PRIVATE.csv)
    stays with the researchers. Everything is written under ai-service/evaluation_data/, which Git ignores.

Pairs are chosen by program, never by the model's similarity score, so the system under test cannot influence which
pairs it is evaluated on: for each program, most pairs use a posting for the same course and the rest a posting for a
different course (--cross-share). Whether a pair is actually relevant is decided only by the raters.

Usage (from the ai-service folder, with IC_DB_USER / IC_DB_PASSWORD / IC_DB_NAME set as for the app API):
  .venv\\Scripts\\python.exe benchmark.py export --consent-list consent.txt --approved-postings postings.txt
  .venv\\Scripts\\python.exe benchmark.py merge --sheets evaluation_data\\benchmark --out evaluation_data\\pairs.csv
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import re
import sys
from collections import Counter
from pathlib import Path

APP_SERVICE = Path(__file__).resolve().parent.parent / 'app-service'
PROGRAMS = ('BSCS', 'BSHM', 'BSBA')
PROGRAM_CODES = {'BS Computer Science': 'BSCS', 'BS Hospitality Management': 'BSHM',
                 'BS Business Administration': 'BSBA'}
MIN_SKILLS = 2           # a profile or posting with fewer clean skills cannot be rated meaningfully
MAX_SKILL_LENGTH = 60
MAX_TITLE_LENGTH = 120
SHEET_COLUMNS = ['pair_id', 'student_program', 'student_skills', 'posting_title', 'job_skills', 'rating', 'comment']
MASTER_COLUMNS = ['pair_id', 'student_program', 'student_skills', 'posting_title', 'job_skills']
KEY_COLUMNS = ['pair_id', 'student_ref', 'student_alias', 'posting_ref', 'posting_alias', 'kind']

RUBRIC_DRAFT = """# HR rating rubric (DRAFT, replace with Appendix I once the adviser approves it)

You will see pairs of a student profile (program and skills) and a job or internship posting (title and required
skills). For each pair, rate how relevant the posting is for that student, using only what is shown.

| Rating | Meaning |
|---|---|
| 5 | Highly relevant. The student's skills cover essentially all of the posting's required skills. |
| 4 | Relevant. The student covers most key requirements; the gaps are minor or easy to train. |
| 3 | Partly relevant. Some requirements are covered but important ones are missing. |
| 2 | Slightly relevant. Little overlap; only general or transferable skills. |
| 1 | Not relevant. No meaningful overlap. |

Instructions

- Rate every row in your sheet with a whole number from 1 to 5 in the `rating` column. A comment is optional.
- Judge only the listed skills, program and posting. You do not know who the student is, and you should not try to find out.
- Do not discuss ratings with other evaluators. Rows are in a different order for each evaluator on purpose.
- Do not edit any other column. Save the file as CSV UTF-8 (comma delimited) under the same name and return it.
- Pairs rated 4 or higher on average are treated as relevant in the study.
"""

_URL = re.compile(r'https?://|www\.|\.com\b|\.ph\b|\.org\b|\.net\b', re.I)


def clean_skill(text) -> str | None:
    """A skill name safe to show raters, or None if it is too short or long or looks like an identifier."""
    skill = re.sub(r'\s+', ' ', str(text or '').replace(';', ',')).strip()
    if not 2 <= len(skill) <= MAX_SKILL_LENGTH:
        return None
    if '@' in skill or _URL.search(skill):
        return None
    if len(re.sub(r'\D', '', skill)) >= 7:  # phone or ID-like digit runs; "ISO 27001" and "Office 365" are fine
        return None
    return skill


def clean_skills(items) -> tuple[list[str], int]:
    """Cleaned, de-duplicated skills (first spelling wins) and the number of items dropped."""
    seen: set[str] = set()
    kept: list[str] = []
    dropped = 0
    for item in items or []:
        skill = clean_skill(item)
        if skill is None:
            dropped += 1
        elif skill.casefold() not in seen:
            seen.add(skill.casefold())
            kept.append(skill)
    return kept, dropped


def clean_title(text) -> str:
    title = re.sub(r'\s+', ' ', str(text or '')).strip()[:MAX_TITLE_LENGTH]
    return 'Untitled posting' if not title or '@' in title or _URL.search(title) else title


def read_list(path: str | Path) -> set[str]:
    """One entry per line; blank lines and lines starting with # are ignored. Entries are lower-cased."""
    entries = set()
    for line in Path(path).read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if line and not line.startswith('#'):
            entries.add(line.lower())
    return entries


def prepare(students_raw, postings_raw, seed: int):
    """Clean and pseudonymise raw rows. Returns (students, postings, notes)."""
    rng = random.Random(seed)
    notes = {'skills_dropped': 0, 'students_excluded': 0, 'postings_excluded': 0}
    students, postings = [], []
    for row in students_raw:
        skills, dropped = clean_skills(row['skills_raw'])
        notes['skills_dropped'] += dropped
        if row.get('program') not in PROGRAMS or len(skills) < MIN_SKILLS:
            notes['students_excluded'] += 1
            continue
        students.append({'ref': row['key'], 'program': row['program'], 'skills': skills})
    for row in postings_raw:
        skills, dropped = clean_skills(row['skills_raw'])
        notes['skills_dropped'] += dropped
        if row.get('course') not in PROGRAMS or len(skills) < MIN_SKILLS:
            notes['postings_excluded'] += 1
            continue
        postings.append({'ref': row['key'], 'course': row['course'], 'title': clean_title(row.get('title')),
                         'skills': skills})
    rng.shuffle(students)
    rng.shuffle(postings)
    for number, student in enumerate(students, start=1):
        student['sid'] = f'S{number:03d}'
    for number, posting in enumerate(postings, start=1):
        posting['pid'] = f'J{number:03d}'
    return students, postings, notes


def build_pairs(students, postings, n: int, cross_share: float, seed: int):
    """Choose up to n pairs, balanced across programs, never looking at model scores. Returns (pairs, warnings)."""
    rng = random.Random(seed)
    warnings: list[str] = []
    programs = [program for program in PROGRAMS if any(s['program'] == program for s in students)]
    for program in PROGRAMS:
        if program not in programs:
            warnings.append(f'No eligible students in {program}; it gets no pairs.')
    if not programs:
        return [], warnings
    base, extra = divmod(n, len(programs))
    student_uses: Counter = Counter()
    posting_uses: Counter = Counter()
    chosen = []
    for index, program in enumerate(programs):
        target = base + (1 if index < extra else 0)
        mine = [s for s in students if s['program'] == program]
        want_cross = round(cross_share * target)
        pools = (('same-course', [p for p in postings if p['course'] == program], target - want_cross),
                 ('cross-course', [p for p in postings if p['course'] != program], want_cross))
        for kind, pool, quota in pools:
            combos = [(s, p) for s in mine for p in pool]
            rng.shuffle(combos)
            picked = 0
            while picked < quota and combos:
                best = min(range(len(combos)),
                           key=lambda i: (student_uses[combos[i][0]['sid']], posting_uses[combos[i][1]['pid']], i))
                student, posting = combos.pop(best)
                student_uses[student['sid']] += 1
                posting_uses[posting['pid']] += 1
                chosen.append({'student': student, 'posting': posting, 'kind': kind})
                picked += 1
            if picked < quota:
                warnings.append(f'{program}: only {picked} of {quota} {kind} pairs are possible with the available '
                                'students and postings.')
    if len(chosen) < n:
        warnings.append(f'Built {len(chosen)} of the {n} requested pairs. Add consenting students or approved '
                        'postings, or lower --pairs.')
    rng.shuffle(chosen)
    for number, pair in enumerate(chosen, start=1):
        pair['pair_id'] = f'P{number:03d}'
    return chosen, warnings


def _write_csv(path: Path, columns: list[str], rows: list[dict]) -> None:
    with open(path, 'w', encoding='utf-8-sig', newline='') as handle:  # BOM so Excel reads UTF-8 correctly
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def _read_csv(path: Path) -> tuple[list[str], list[dict]]:
    with open(path, encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def export(students_raw, postings_raw, out_dir: str | Path, *, n: int = 100, cross_share: float = 0.4,
           raters: int = 10, seed: int = 42, force: bool = False, fetch_notes: dict | None = None) -> dict:
    if not 0.0 <= cross_share <= 1.0:
        raise ValueError('--cross-share must be between 0 and 1.')
    if not 2 <= raters <= 99:
        raise ValueError('--raters must be between 2 and 99 (Fleiss kappa needs at least two).')
    out = Path(out_dir)
    targets = [out / 'benchmark_pairs_master.csv', out / 'benchmark_key_PRIVATE.csv', out / 'export_summary.json',
               out / 'hr_rubric_DRAFT.md'] + [out / f'hr_sheet_R{i:02d}.csv' for i in range(1, raters + 1)]
    existing = [path.name for path in targets if path.exists()]
    if existing and not force:
        raise ValueError('Refusing to overwrite existing files (completed sheets could be lost): '
                         + ', '.join(existing[:4]) + ('...' if len(existing) > 4 else '') + '. Use --force to replace them.')
    students, postings, notes = prepare(students_raw, postings_raw, seed)
    pairs, warnings = build_pairs(students, postings, n, cross_share, seed)
    if not pairs:
        raise ValueError('No pairs could be built. ' + ' '.join(warnings))
    out.mkdir(parents=True, exist_ok=True)

    master = [{'pair_id': p['pair_id'], 'student_program': p['student']['program'],
               'student_skills': '; '.join(p['student']['skills']), 'posting_title': p['posting']['title'],
               'job_skills': '; '.join(p['posting']['skills'])} for p in sorted(pairs, key=lambda p: p['pair_id'])]
    _write_csv(targets[0], MASTER_COLUMNS, master)
    _write_csv(targets[1], KEY_COLUMNS, [
        {'pair_id': p['pair_id'], 'student_ref': p['student']['ref'], 'student_alias': p['student']['sid'],
         'posting_ref': p['posting']['ref'], 'posting_alias': p['posting']['pid'], 'kind': p['kind']}
        for p in sorted(pairs, key=lambda p: p['pair_id'])])
    for number in range(1, raters + 1):
        rows = [{**row, 'rating': '', 'comment': ''} for row in master]
        random.Random(seed * 1000 + number).shuffle(rows)  # a different order for every evaluator
        _write_csv(out / f'hr_sheet_R{number:02d}.csv', SHEET_COLUMNS, rows)
    targets[3].write_text(RUBRIC_DRAFT, encoding='utf-8')

    composition = Counter((p['student']['program'], p['kind']) for p in pairs)
    summary = {
        'pairs': len(pairs), 'requested_pairs': n, 'raters': raters, 'seed': seed, 'cross_share': cross_share,
        'students_used': len({p['student']['sid'] for p in pairs}), 'postings_used': len({p['posting']['pid'] for p in pairs}),
        'composition': {f'{program} {kind}': count for (program, kind), count in sorted(composition.items())},
        'skills_dropped_as_identifier_like_or_malformed': notes['skills_dropped'],
        'students_excluded': notes['students_excluded'], 'postings_excluded': notes['postings_excluded'],
        'source': fetch_notes or {}, 'warnings': warnings,
        'selection_rule': 'by program and course only; model similarity scores are never used to choose pairs',
    }
    targets[2].write_text(json.dumps(summary, indent=2), encoding='utf-8')
    return summary


def merge_sheets(master_path: str | Path, sheets_dir: str | Path, out_path: str | Path) -> dict:
    """Validate the completed rater sheets and write the CSV that evaluate_matching.py reads."""
    master_columns, master_rows = _read_csv(Path(master_path))
    if any(column not in master_columns for column in MASTER_COLUMNS):
        raise ValueError(f'The master file needs the columns: {", ".join(MASTER_COLUMNS)}.')
    master = {row['pair_id']: row for row in master_rows}
    sheets = sorted(Path(sheets_dir).glob('hr_sheet_R*.csv'))
    if len(sheets) < 2:
        raise ValueError(f'Found {len(sheets)} completed sheet(s) named hr_sheet_R*.csv in {sheets_dir}; need at least two.')
    ratings: dict[str, dict[str, float]] = {}
    problems: list[str] = []
    for sheet in sheets:
        label = sheet.stem.replace('hr_sheet_', '')
        columns, rows = _read_csv(sheet)
        missing = [c for c in ('pair_id', 'student_skills', 'job_skills', 'rating') if c not in columns]
        if missing:
            problems.append(f'{label}: missing column(s) {", ".join(missing)}. Save as CSV UTF-8 (comma delimited).')
            continue
        seen: set[str] = set()
        ratings[label] = {}
        for line, row in enumerate(rows, start=2):
            pair_id = (row['pair_id'] or '').strip()
            if pair_id in seen:
                problems.append(f'{label} line {line}: {pair_id} appears twice.')
                continue
            seen.add(pair_id)
            if pair_id not in master:
                problems.append(f'{label} line {line}: unknown pair {pair_id!r}.')
                continue
            if (row['student_skills'], row['job_skills']) != (master[pair_id]['student_skills'], master[pair_id]['job_skills']):
                problems.append(f'{label} {pair_id}: the skills text was edited. Only the rating and comment may change.')
                continue
            text = (row['rating'] or '').strip()
            try:
                value = float(text)
            except ValueError:
                problems.append(f'{label} {pair_id}: rating is {"missing" if not text else repr(text)}.')
                continue
            if not 1.0 <= value <= 5.0:
                problems.append(f'{label} {pair_id}: rating {text!r} is outside 1 to 5.')
                continue
            ratings[label][pair_id] = value
        for pair_id in master:
            if pair_id not in seen:
                problems.append(f'{label}: pair {pair_id} is not in the sheet.')
    if problems:
        shown = problems[:12]
        more = f' (and {len(problems) - 12} more)' if len(problems) > 12 else ''
        raise ValueError('The sheets are not ready to merge:\n  - ' + '\n  - '.join(shown) + more)
    labels = sorted(ratings)
    rater_columns = [f'rater_{i}' for i in range(1, len(labels) + 1)]
    rows = [{'pair_id': pair_id, 'source': 'real', 'student_skills': row['student_skills'],
             'job_skills': row['job_skills'], **{col: ratings[label][pair_id] for col, label in zip(rater_columns, labels)}}
            for pair_id, row in sorted(master.items())]
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    _write_csv(out, ['pair_id', 'source', 'student_skills', 'job_skills'] + rater_columns, rows)
    return {'pairs': len(rows), 'raters': len(labels), 'rater_sheets': [f'{label}' for label in labels], 'out': str(out)}


def fetch_from_db(consented: set[str], approved_postings: set[str], database=None):
    """Read consenting students' resume skills and approved postings. Returns (students_raw, postings_raw, notes)."""
    if database is None:
        sys.path.insert(0, str(APP_SERVICE))
        from db import database  # the app's own connection helper (IC_DB_* environment variables)
    students, postings = [], []
    with database() as connection:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT a.email, b.program, r.payload FROM student_accounts a "
                       "JOIN student_resumes r ON r.account_id = a.id "
                       "JOIN student_batches b ON b.code = a.class_code WHERE a.status = 'active'")
        for row in cursor.fetchall():
            email = str(row['email']).strip().lower()
            if email not in consented:
                continue
            payload = json.loads(row['payload']) if isinstance(row['payload'], str) else (row['payload'] or {})
            students.append({'key': email, 'program': PROGRAM_CODES.get(row['program']),
                             'skills_raw': list(payload.get('soft') or []) + list(payload.get('hard') or [])})
        cursor.execute('SELECT id, payload FROM job_postings')
        for row in cursor.fetchall():
            if str(row['id']).strip().lower() not in approved_postings:
                continue
            payload = json.loads(row['payload']) if isinstance(row['payload'], str) else (row['payload'] or {})
            postings.append({'key': row['id'], 'course': payload.get('course'), 'title': payload.get('title'),
                             'skills_raw': [skill[0] if isinstance(skill, list) and skill else skill
                                            for skill in payload.get('skills') or []]})
    notes = {'consent_list_entries': len(consented), 'consenting_students_with_a_saved_resume': len(students),
             'approved_posting_entries': len(approved_postings), 'approved_postings_found': len(postings)}
    return students, postings, notes


def main(argv=None, fetch=None) -> int:
    parser = argparse.ArgumentParser(description='Build and merge the human-rating benchmark for the matching engine.')
    commands = parser.add_subparsers(dest='command', required=True)
    exp = commands.add_parser('export', help='create pairs and one scoring sheet per HR evaluator')
    exp.add_argument('--consent-list', required=True, help='text file: one consenting student email per line')
    exp.add_argument('--approved-postings', required=True, help='text file: one research-approved posting id per line')
    exp.add_argument('--pairs', type=int, default=100)
    exp.add_argument('--cross-share', type=float, default=0.4, help='share of pairs using a posting for a different course')
    exp.add_argument('--raters', type=int, default=10)
    exp.add_argument('--seed', type=int, default=42)
    exp.add_argument('--out', default='evaluation_data/benchmark')
    exp.add_argument('--force', action='store_true', help='overwrite existing export files')
    mrg = commands.add_parser('merge', help='check completed sheets and write the evaluation CSV')
    mrg.add_argument('--sheets', default='evaluation_data/benchmark', help='folder with the completed hr_sheet_R*.csv')
    mrg.add_argument('--master', help='benchmark_pairs_master.csv (default: inside --sheets)')
    mrg.add_argument('--out', default='evaluation_data/pairs.csv')
    args = parser.parse_args(argv)
    try:
        if args.command == 'export':
            consented, approved = read_list(args.consent_list), read_list(args.approved_postings)
            if not consented or not approved:
                raise ValueError('The consent list and the approved-postings list must each have at least one entry.')
            students, postings, notes = (fetch or fetch_from_db)(consented, approved)
            summary = export(students, postings, args.out, n=args.pairs, cross_share=args.cross_share,
                             raters=args.raters, seed=args.seed, force=args.force, fetch_notes=notes)
            print(f"Built {summary['pairs']} pairs for {summary['raters']} evaluators in {args.out}")
            for key, count in summary['composition'].items():
                print(f'  {key}: {count}')
            for warning in summary['warnings']:
                print(f'warning: {warning}')
            print('Send each evaluator only their own hr_sheet_R##.csv and hr_rubric_DRAFT.md. '
                  'Keep benchmark_key_PRIVATE.csv and the master file with the researchers.')
        else:
            master = args.master or str(Path(args.sheets) / 'benchmark_pairs_master.csv')
            result = merge_sheets(master, args.sheets, args.out)
            print(f"Merged {result['pairs']} pairs from {result['raters']} evaluators into {result['out']}")
            print('Next: evaluate_matching.py --input ' + result['out'])
    except (ValueError, OSError, RuntimeError) as error:
        print(f'error: {error}', file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
