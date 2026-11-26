# InternConnect AI service

The matching service runs the locally stored `all-MiniLM-L6-v2` model. It can also normalize exact skill-name matches using local O*NET 31.0 vocabulary files. Unknown skill names remain unchanged; semantic similarity is still calculated by the sentence model.

The student Job Matching page sends the saved resume skills and current posting skill lists to the local `/api/match/rank` endpoint. The service's raw cosine similarities determine the ranking; the score badge displays that value as a rounded percent. If the service cannot be reached, the page shows "Score unavailable" and keeps the posted order; no other formula substitutes for the service. Skill-gap chips are unchanged.

The response also carries the similarity cutoff `threshold` (τ) and a `meets_threshold` flag per match. τ defaults to 0.60, the development baseline in the thesis, and can be set with the `IC_MATCH_THRESHOLD` environment variable (a number from 0 to 1; anything else falls back to 0.60). It is not yet calibrated on human-rated pairs. The Job Matching page shows an automatic fallback (key skills, closest O*NET occupations, links to LinkedIn and JobStreet) when no eligible posting reaches τ. Distance is used only as an optional radius filter and a tie-breaker, never as part of the score.

For local browser development, the API allows requests from `localhost` and `127.0.0.1` origins. Set `IC_AI_API_BASE` in the page before `assets/js/core/ai-matching.js` if the service uses a different URL. To allow a deployed frontend, set `IC_AI_ALLOWED_ORIGINS` on the API server to a comma-separated list of its exact origins.

Place the full **O*NET 31.0 CSV ZIP** at `ai-service/onet_data/onet_database.zip`, then run this from the repository root:

```powershell
ai-service\.venv\Scripts\python.exe ai-service\download_onet_data.py
```

The setup script imports eight tables from the local archive: Essential Skills, Transferable Skills, Software Skills, Occupation Data, Job Titles, Sample of Reported Titles, Knowledge, and Task Statements. It validates the versioned paths, column headers and nonempty rows before replacing local files. It records row counts and an archive SHA-256 in `manifest.json`. Other ZIP members are left in the archive. When no ZIP is present, the script retains its original three-file vocabulary download behavior.

Restart the API after importing. Data and the ZIP remain in `ai-service/onet_data/`, excluded from Git. Matching can run without the archive; occupation endpoints return 503 until the full import is available.

The following endpoints are available in `/docs`:

- `POST /api/match/careers`: ranks local occupation profiles against saved resume
  skills and narrative context. Returns five suggestions by default, raw cosine
  similarity expressed as an alignment percentage, direct listed-skill overlaps,
  and skills to explore. These percentages are not calibrated hiring probabilities
  or qualification assessments. Missing listed skills do not prove missing ability.
  The first request builds an in-memory occupation embedding index; restart after
  changing model or catalog files. No external AI calls or database migrations are
  required. The Resume Builder's Explore Careers dialog uses this endpoint.

- `GET /api/onet/status`: import readiness, missing tables and loaded vocabulary counts.
- `GET /api/onet/occupations?query=software%20developer`: occupation candidates from official and reported titles. Exact aliases appear first. Results are candidates to review; no occupation is assigned automatically.
- `GET /api/onet/occupations/15-1252.00`: occupation description, skills and knowledge sorted by O*NET importance, software examples, and task statements. Suppressed or not-relevant skill/knowledge ratings are excluded. Importance uses the original O*NET IM scale; it is not a student score.

Rank requests may optionally include `onet_soc_code` on a posting. A valid code adds the occupation's code and title to that match's response. Unknown codes are rejected. Saved postings with this field pass it through from the student page. The posting editor does not yet provide an occupation selector; the lookup endpoints make the data available for that later integration.

Occupation profiles provide context for defining and reviewing requirements. They do not prove a student has those skills or that every employer requires them, so they are not appended automatically to embedding inputs. Current matching still compares the supplied student and posting skill lists. More imported data alone does not establish improved accuracy: local job/student examples and human relevance judgments are still needed to measure ranking accuracy and calibrate thresholds. Displayed percentages are scaled cosine similarities, not probabilities of suitability.

O*NET data source and attribution details are in [ONET_DATA_NOTICE.md](ONET_DATA_NOTICE.md).

## Evaluating the matching engine

`evaluate_matching.py` reproduces the evaluation in thesis Chapter 3 on human-rated student-profile / job-posting pairs. From the `ai-service` folder:

```powershell
.venv\Scripts\python.exe evaluate_matching.py --input evaluation_data\pairs.csv
```

Put real rated pairs in `ai-service/evaluation_data/` (ignored by Git). The CSV needs the columns `pair_id`, `source` (`real` or `synthetic`), `student_skills`, `job_skills` (skills separated by `;`) and two or more `rater_1`, `rater_2`, ... columns with each HR evaluator's 1-5 rating of every pair. Use anonymized text only; `pair_id` must not identify anyone.

What it does: labels a pair relevant when its mean rating is 4.0 or higher; splits the pairs 80/20, stratified, with a fixed seed (`--seed`, default 42); chooses τ by stratified 5-fold cross-validation on the 80% calibration set only (highest mean validation F1, ties to the τ closest to 0.60); then reports precision, recall and F1 at that τ on the 20% held-out set with bootstrap 95% confidence intervals, Pearson r between the mean rating and the similarity score, and Fleiss' κ (a rater's rating of 4 or higher counts as relevant). Similarities come from the same code as `/api/match/score`, so the evaluation uses the same model and O*NET skill normalisation as the page. Nothing is retrained. Reports are written as JSON and Markdown to `evaluation_results/` (`--out` to change).

Synthetic pairs are refused unless `--allow-synthetic` is given, and then every output file is named `NOT_FOR_REPORTING_*`, because the thesis excludes synthetic data from calibration and evaluation. `evaluation_sample/pairs_SYNTHETIC_not_for_reporting.csv` is an invented 40-pair file for checking that the pipeline runs; its numbers mean nothing. Chapter 3 plans N = 100 pairs, which gives only 20 held-out pairs, so the confidence intervals will be wide and the percentile bootstrap understates the uncertainty when a classifier is perfect or nearly so. Set the service's cutoff to the selected τ with `IC_MATCH_THRESHOLD` only after the final run, and rerun the evaluation if anything that affects scoring changes.

Tests: `.venv\Scripts\python.exe -B -m unittest discover -s tests -p "test_evaluate_matching.py"`.

## Building the human-rating benchmark

`benchmark.py` prepares the rated pairs that `evaluate_matching.py` needs, in three steps. Everything it writes goes under `ai-service/evaluation_data/`, which Git ignores.

1. **Export.** Create two text files: `consent.txt` (one consenting student email per line) and `postings.txt` (one research-approved posting id per line; `#` starts a comment). With `IC_DB_USER`, `IC_DB_PASSWORD` and `IC_DB_NAME` set as for the app API, run:

   ```powershell
   .venv\Scripts\python.exe benchmark.py export --consent-list consent.txt --approved-postings postings.txt
   ```

   Only listed students and postings are read, and only skill names and the program code are exported: no names, emails, student numbers, company names or free-text resume fields, and skills that look like identifiers (emails, web addresses, long digit runs) are dropped. Pairs are chosen by program and course, never by the model's score: for each program, most pairs use a posting for the same course and the rest one for a different course (`--cross-share`, default 0.4). `--pairs` (default 100) and `--raters` (default 10) set the size. Students and postings are reused across pairs, so a small cohort still reaches 100 pairs; the summary reports what could be built. The export writes `hr_sheet_R01.csv`, `hr_sheet_R02.csv`, ... (one per evaluator, rows in a different order for each), `hr_rubric_DRAFT.md`, `benchmark_pairs_master.csv`, `export_summary.json`, and `benchmark_key_PRIVATE.csv`, which maps aliases back to emails and posting ids and must stay with the researchers. It will not overwrite existing files unless you pass `--force`.
2. **Rating.** Send each evaluator only their own sheet and the rubric. They fill the `rating` column (1 to 5) and return the file under the same name. The rubric is a draft written for this tool; replace it with the adviser-approved Appendix I.
3. **Merge.** Put the returned sheets in one folder and run:

   ```powershell
   .venv\Scripts\python.exe benchmark.py merge --sheets evaluation_data\benchmark --out evaluation_data\pairs.csv
   ```

   Merge refuses to continue if any rating is missing, not a number or outside 1 to 5, if a skills column was edited, or if a pair is missing, duplicated or unknown, and lists the problems. Its output is the CSV that `evaluate_matching.py --input evaluation_data\pairs.csv` reads (`source` is `real`).

Tests: `.venv\Scripts\python.exe -B -m unittest discover -s tests -p "test_benchmark.py"`. They use fake data only and include an export, rate, merge, evaluate round trip.
