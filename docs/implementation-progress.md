# PHINMA SJCDC completion plan

Scope: PHINMA - St. Jude College Dasmarinas Cavite for the initial release.
Work proceeds one task at a time, preserving the existing UI. Existing development
records remain until an explicitly approved release reset. Multi-school implementation
is deferred. Deployment follows the initial features.

## Ordered tasks

1. Review student/coordinator registration, login, approval and permissions.
2. Complete database-backed partner signup and coordinator approval.
3. Persist student profiles and resumes across browsers.
4. Persist internship applications and status changes, including submitted resume snapshots.
5. Confirm official placements with coordinator oversight.
6. Persist attendance, tasks, reports and review decisions.
7. Add a resume career-matching popup with ranked occupation titles, alignment percentages,
   reasons and skill gaps using the local model and occupation catalog.
8. Connect notifications and exports to authoritative records.
9. Deploy and verify complete workflows; prepare thesis evidence and limitations.

Career scores represent resume alignment. They must not be presented as hiring
probabilities. Evaluate the scoring behavior before accepting percentage labels.
Ordinary resume edits do not need coordinator approval.

## Task 1 evidence (2026-10-29)

- Existing 19 offline account/ownership/lockout tests passed during this review.
- The running API returned `{"status":"ok","database":"mysql"}`.
- Found and corrected an incomplete health probe: it previously checked only postings,
  allowing missing account tables to remain undetected.
- Added regression coverage for account-table readiness and missing-table failure.
- All 21 offline tests passed after the change; `git diff --check` passed.
- The running API rejected invalid student, coordinator and partner session tokens
  with HTTP 401, exercising their live database-backed session lookups.
- No live account records were created or deleted during this review.
- Live signup, approval and second-browser login still require acceptance verification;
  passing isolated tests and health checks alone do not prove that complete flow.

Next acceptance sequence: coordinator registers a new batch; student registers with
that code; pending student cannot log in; owning coordinator approves; student logs
in from another browser; logout invalidates the token. An unrelated coordinator must
not see or approve that batch's requests.

The current UI email code `123456` remains a development stub. Real email verification
is required before public release. Coordinator signup currently self-activates, so
staff authorization also needs a release decision.

## Task 2 implementation (2026-10-29)

- Partner signup now writes a hashed password and pending profile to MySQL through
  `/api/auth/partner/register`; it no longer saves plaintext partner credentials locally.
- Registration requires an active batch owned by a coordinator. Industry categories
  remain broad and are not compared against a single school program.
- Coordinator Requests loads partners belonging to that coordinator's batches and
  sends approval/rejection decisions to the API. Approved accounts populate the existing directory.
- Pending accounts cannot log in or use posting endpoints. Decisions are restricted
  to the owning coordinator and pending requests; closed batches cannot approve accounts.
- Added the `partner_profiles` table. Running `manage.py init` adds it without replacing
  existing tables or records. Previously admin-provisioned partners remain active.
- Batch deletion now also protects batches containing partner companies.
- All 29 offline tests passed, including eight new partner regression tests. The four
  changed JavaScript files passed Node syntax checks.
- Database initialization, API restart and live partner signup/approval/login still
  need acceptance verification. No live database records were changed in this step.

Next: run `ai-service\.venv\Scripts\python.exe app-service\manage.py init` in the
PowerShell terminal with the working database environment, restart the application
API, register a partner using a coordinator batch code, approve it in Requests, and
sign in as that partner from another browser. Then proceed to profile/resume persistence.

## Task 3 implementation (2026-10-29)

- Added student-owned resume storage in `student_resumes`, including editable fields,
  skill lists, optional sections, photo preference and the optional PDF attachment.
- Student account verification loads the saved resume before feature modules initialize,
  so resume preview and matching read the database version on another browser.
- Existing local drafts remain available when no database resume exists; an explicit
  save uploads the draft. Verified experience and official account identity are not
  editable through the resume endpoint.
- Profile photos now update the authenticated student's account in MySQL.
- Resume operations are serialized, and success messages wait for the server save.
  Failed saves leave the previous local saved record intact and show an error.
- Server validation bounds resume content and checks PDF/image data and sizes.
- All 34 offline tests and the three changed JavaScript syntax checks passed.
- Run `manage.py init` and restart the API before testing. Live second-browser
  verification remains pending; this step did not change live database records.

Task 3 acceptance: sign in as an approved student, save skills/resume and a photo,
sign in from another browser, and check fields, preview, matching skills, photo
preference and PDF download. Confirm an interrupted save shows an error.
Next feature: database-backed internship applications and submitted resume snapshots.

## Task 4 implementation (2026-10-29)

- Added `internship_applications` with student/posting uniqueness, company ownership,
  status and an immutable JSON copy of the saved resume at submission.
- Database students apply through the API. It verifies batch membership, open posting,
  deadline, saved resume and one active internship application per student, including
  concurrent requests. Prototype postings cannot receive database applications.
- Student application status reloads from the server. Partner applicant lists use
  company-owned database records and display/download the submitted resume snapshot.
  Ranking uses that snapshot's skills. Later resume edits do not replace it.
- Partners can accept or decline pending applications. Final decisions cannot be
  reopened through this endpoint. A company cannot view or change another's records.
- Coordinator hydration reads only applications belonging to owned batches; partner
  hiring decisions are read-only on coordinator screens. Official placement linkage
  and coordinator deployment confirmation are the next task, not part of this step.
- All 41 offline tests, six JavaScript syntax checks and diff checks passed.
- Live workflow testing requires `manage.py init` and API restart. No live records
  were created or changed by this implementation.

Acceptance: student saves resume A and applies; edits/saves resume B; partner in a
second browser sees resume A and records a decision; student refreshes and sees it.
An unrelated partner must not receive that applicant. Then implement Task 5.

## Task 5 implementation (2026-10-29)

- Accepted internship applications now appear in the coordinator's existing Placements
  table. Pending applications wait for a company decision; database records no longer
  advance by local-only placement edits.
- Confirm deployment retains signed endorsement/acceptance scans, the validated work
  schedule, coordinator identity and confirmation time in `official_placements`.
- The API requires batch ownership, an active batch/student, an accepted internship,
  valid signed-file uploads and one official placement per student. A locked student
  row and unique constraints prevent duplicate confirmations.
- On-site/hybrid schedules retain a worksite: explicit branch coordinates or the
  posting GPS coordinates (default 100 m radius). Missing coordinates require the
  coordinator to supply a branch location before confirmation.
- Student, coordinator and partner pages load their permitted placement records from
  the server. Application status reflects deployment. Reads do not return signed files.
- Schedule confirmation waits for the save and stays open on failure.
- Passed 49 offline tests, eight JavaScript syntax checks, authentication/CORS smoke
  checks and a placement-list check for students sharing a name.
- `manage.py init` and API restart are required. No live records were changed;
  full signup/application/deployment testing remains pending.

Acceptance: student applies; partner accepts; owning coordinator uploads the signed
letters using Files, selects Confirm deployment and saves the schedule. In another
browser, the student/partner sees Deployed. A second confirmation or unrelated
coordinator must fail. The evidence copies are retained on the server; the broader
shared document vault is still part of the remaining persistence work.

Next: Task 6, database-backed attendance, tasks, reports and review decisions.

## Task 6A implementation (2026-10-29)

- Added `student_attendance` for database-backed daily time-in/out, photos, GPS points,
  explanations and coordinator reviews. GPS is captured at those events only.
- Uses database UTC time with Philippine work dates; clients cannot supply timestamps
  or credited hours. Deployed students have one clock-in and one clock-out per day,
  serialized by the official placement lock.
- Geofence checks use the confirmed schedule/worksite. Remote work skips the geofence.
  Credited hours are limited to the scheduled interval and retain the existing break rule.
- Flagged/outside-schedule hours stay uncredited until reviewed; rejected records earn
  zero hours. Review ownership and record scope are enforced by the API.
- Student, coordinator and partner pages read scoped server records. Database accounts
  no longer get generated example attendance. Placement progress uses credited records.
- Passed 57 offline tests, nine JavaScript syntax checks and API authentication/CORS
  checks. Real camera/GPS attendance testing remains pending.
- Initialization was attempted but did NOT run: the agent shell lacks IC_DB_USER and
  IC_DB_PASSWORD. Run `manage.py init` in the user's configured terminal, then restart
  the API. Success now prints `Database schema initialized successfully. Existing records preserved.`
- No live records were changed. Task 6 is not complete: tasks, narrative reports,
  report reviews and the remaining document persistence are the next slices. Scheduled
  absence generation, holidays and cross-midnight shifts also remain unimplemented
  for database attendance; only actual daily clock events are stored in this slice.

## Task 6B implementation (2026-10-29)

- Added `classwork_tasks` with batch-owned task create/edit/duplicate/close/reopen/
  archive/restore/delete endpoints. Students read their own batch's non-archived tasks.
- Task templates and supporting file contents are retained in the payload so students
  in another browser can download them. Each file is capped at 750 KB, 2 MB combined.
- Coordinator classwork waits for server saves and shows errors on failure. Database
  accounts read server tasks without example-task fallback; old local tasks are retained.
- Task IDs are server-generated. Ownership checks prevent task edits or moves across
  batches. Referenced tasks cannot be deleted; the API returns an archive instruction.
- Passed 64 offline tests and five JavaScript syntax checks. Live classwork acceptance
  still requires schema initialization and API restart.
- Database initialization remains unverified. The agent terminal does not have the
  database environment; no live records were changed in this slice.
- Narrative submissions, verified resume entries and grading still use the prototype
  path and are the next slice. Repeat settings are stored, but automatic recurring
  task generation has not been implemented.

Acceptance: coordinator creates a task with files; student in a second browser sees
  and downloads them; coordinator closes/archives it; student refresh reflects that
  state. An unrelated coordinator must not edit or delete it.

## Initialization status (2026-10-29)

The user reported successful schema initialization after Task 6B. Initialization is
recorded as completed by the user. The subsequent read-only API verification received
connection refused on port 8001: the application API needs to be started in the
configured PowerShell session before database health and browser flows can be verified.

After the user restarted the API, `/health` returned HTTP 200 with
`{"status":"ok","database":"mysql"}`. The readiness probe checked all currently
implemented tables, including classwork and attendance. The running OpenAPI schema
also includes the latest resume, partner registration, application, placement,
attendance and classwork endpoints. Schema initialization and API readiness are now
verified. Full browser workflow acceptance remains pending.

## Task 6C implementation (2026-10-29)

- The user verified task creation, student viewing/submission and approval before this
  slice. Those report/grade operations still used browser prototype records at that time.
- Added `narrative_reports` for authenticated student submissions, versioned revision
  requests, coordinator decisions, feedback and grades. Server ownership and task
  status checks apply; pending/verified/rejected reports cannot be overwritten.
- Students may resubmit only after Needs Revision. Resubmission resets the prior grade
  and decision, increments the version, and requires a new review. Old-version review
  requests are rejected. Prior revision text is not retained as a separate history.
- The server derives the existing first-line resume bullet; this is deterministic
  formatting, not an AI generation feature. Only coordinator-verified reports appear
  in the student's verified experience. Approved archived-task entries remain visible.
- Student/coordinator pages hydrate reports and grades from MySQL, with grade identity
  based on email. Counts and coordinator submission notifications use server reports.
- Grades cannot exceed task points; task maximum points cannot drop below existing
  grades. Tasks with report references cannot be deleted; archive preserves records.
- Passed 72 offline tests, seven JavaScript syntax checks and HTTP authentication/CORS
  smoke checks. Full browser verification of this database report path remains pending.
- This slice adds a NEW table after the previously verified initialization. Run
  `manage.py init` again and restart the API before signing in. The prior successful
  initialization does not confirm that `narrative_reports` exists yet.

Acceptance: student submits in browser A; coordinator sees it in browser B, returns it
  with feedback; student revises; coordinator approves and grades; student refreshes
  and sees feedback, grade and verified experience. Confirm duplicate submissions,
  stale reviews, foreign-batch reviews and excessive grades are rejected.

## Task 7 implementation (2026-10-29)

- Added Explore Careers beside Export PDF in Resume Builder. The accessible modal
  uses the saved resume, technical/soft skills and coordinator-verified report
  summaries. Name, contact details, photos and PDF attachments are not sent.
- Uses the existing local MiniLM model and imported O*NET occupation catalog.
  Occupation embeddings are cached in memory. Skill and narrative embeddings are
  averaged and compared with occupation profiles using cosine similarity.
- Shows five ranked career titles, descriptions, semantic alignment percentages,
  direct skill overlaps and skills to explore. A score is raw similarity multiplied
  by 100 with display bounds; it is not a calibrated likelihood or qualification
  judgment. No direct skill overlap is explicitly identified in the explanation.
- Includes a saved-resume prerequisite, loading state, timeout/retry and unavailable
  service feedback. Results do not modify resumes or create applications.
- All 23 AI-service tests passed, including seven new career tests. JavaScript syntax
  and diff checks passed. Actual local-model spot checks produced Web Developers
  first for a web/software profile (50.4%), Bookkeeping/Accounting/Auditing Clerks
  first for an accounting profile (63.9%), and hotel desk clerks second for a hotel
  profile (65.7%; restaurant hosts ranked first at 72.3%). These are sanity checks,
  not an accuracy benchmark. Domain-specific relevance still needs human-labeled
  evaluation; the system must not claim validated predictive accuracy.
- Restart the AI service on port 8000. This feature does not add database tables.
  Full authenticated browser interaction and thesis evaluation remain pending.

Acceptance: save a resume, open Explore Careers, inspect suggestions; change and save
skills, reopen and check results. An unsaved/empty resume must not yield suggestions.
Stopping the AI service must show a retryable message rather than fabricated scores.

## Task 8A implementation (2026-10-29)

- Added server-derived notification feeds for students, coordinators and partners.
  Sources include actual tasks, report submissions/reviews/grades, applications,
  registration requests, deployment confirmations and student attendance alerts.
- Added `notification_receipts` keyed by server-authenticated role/account and stable
  notification ID. Opening the bell marks displayed entries read; View all marks the
  expanded feed. Visiting the relevant tab marks its entries read. Coordinator tab
  reads and request badges respect the active batch.
- All 21 dashboard pages use the shared client. Empty feeds have no unread dot;
  read state survives refresh/browser changes. Revised submissions get new IDs.
  A notification outage shows an unavailable state without blocking dashboard login.
- Student Recent Activity uses the same authoritative feed. The feed is a bounded
  view of current records (100 items), not a complete permanent event history.
- Removed the remaining Word export from coordinator report detail. Its PDF uses
  the server-loaded narrative, status, feedback and email-keyed grade. Attendance and
  classwork-based exports already consume the hydrated server data.
- Passed 78 backend tests, eight JavaScript syntax checks, API authentication/CORS
  checks and a client-state check for tab read persistence/outage handling.
- NEW schema step: run `manage.py init` again for `notification_receipts` and restart
  only the account API on port 8001. Keep the AI service on port 8000 running.
- Live notification/read-state verification remains pending. Server audit history,
  general document-vault authority and remaining export source gaps still need work;
  Task 8 as a whole is not complete.

Acceptance: create a real report/request/application, verify its scoped notification,
  open the destination tab or bell, refresh and sign in from another browser, and
  confirm the read state persists. A revised report should create a new unread entry.

## Task 8B first slice (2026-10-30)

- Added persistent, server-written `audit_events` for report submission, resubmission,
  review and grading. Entries use authenticated actor IDs, student IDs, task IDs and
  server UTC timestamps. Raw narratives, passwords and review text are not copied.
- Audit writes share the workflow transaction; a write failure rolls back the report
  change. There is no client endpoint to fabricate, edit or delete audit entries.
- Coordinator audit reads enforce current batch ownership and return the latest 500
  entries, displayed in Philippine time. History is retained beyond that display cap.
- Database accounts no longer display or export browser-only audit entries. Loading
  and failure states disable export; PDF uses the same server-loaded batch records.
  Earlier activity is not backfilled and other workflows are not yet audited.
- Added scope/timezone checks and report audit assertions; 80 backend tests passed.
- NEW schema step: run `manage.py init` for `audit_events` (also creates the previous
  notification receipts table if missing), then restart account API 8001. Leave AI
  8000 running. Live database/browser acceptance is still pending.
- Remaining Task 8 work: audit coverage for other mutations, general document vault,
  remaining export sources and live notification verification.

Acceptance: submit, revise, review and grade a report; check Audit Trail in another
browser on the owning coordinator account and refresh. Another coordinator must not
see these entries. New accounts must show an empty feed. Export must match the feed.

## Shared placement letters (2026-10-30)

- Added `vault_letters` for endorsement/acceptance uploads in the company vault. One record is visible to the owning coordinator, linked partner company and named student before deployment; student identity is checked by account ID and upload targets by email, not display name.
- Vault uploads, downloads, replacements and deletion use authenticated APIs for these two letter types. Replacements preserve prior payloads and enforce uploader ownership/version checks. Confirmed-placement letters cannot be deleted. Upload/update/delete audits share the database transaction. Other document types retain the existing prototype path.
- Students see these shared letters in Overview > My files. Existing deployment copies remain a fallback. Deployment confirmation reads the shared files; earlier browser-only uploads have a Share letter action to transfer them without selecting the file again.
- Nine new vault tests plus ten placement, two health and two audit tests passed (23 focused backend tests). Client checks cover a single upload appearing in the company cache, duplicate-name separation, and absence of file contents in cached metadata. Syntax and diff checks passed.
- Run `manage.py init` for the NEW `vault_letters` table, then restart account API 8001. Initialization and the live upload/company/student workflow have NOT been verified in this slice.


### Unified sign-in (2026-11-05)
- Removed login role pills; one Email/Password form calls `/api/auth/login`.
- Server verifies credentials across students, coordinators and partners, issues the matching session and returns its role. Navigation uses that returned role explicitly.
- Email-based five-attempt/five-minute lockout is shared with legacy login endpoints. Pending accounts remain blocked; ambiguous identical credentials require separate account emails.
- Create an Account reveals registration links for all three roles.
- Validation: 35 account/auth tests passed with isolated database storage and real password hashing in unified tests. Frontend simulation verified tokens, sessions and actual dashboard URLs for all roles; JavaScript syntax and diff checks passed.
- Restart the app API and refresh login. No database schema change required. Live database/browser sign-in was not performed.

## Score integrity, PLAN.md D13 (2026-11-22)

- Every compatibility score shown to users now comes from the Sentence-BERT service (`/api/match/rank`). The keyword formula (`jobMatch`: 40% course + 60% skill overlap) no longer produces any displayed score or ranking; it only supplies the matched/gap skill chips.
- Student Job Matching cards and the job modal show `…` while loading and "Score unavailable" when the service is down, the student has no skills, or the posting has no required skills. Unscored cards keep their posted order. Tooltip: "Semantic similarity from the Sentence-BERT model. Not a hiring probability."
- Partner Candidate ranking now scores each applicant against the posting through the same service (one request per applicant, started when a posting's applicants are opened) and sorts by similarity. If the service is down, applicants stay in application order with a notice; applicants with no skills show "No skills listed".
- Student Overview "Top Match Score" tile uses the service and shows `—` when it cannot score. Static placeholder numbers (94%, 81%, 73%) removed from `job-matching.html` and `overview.html`.
- `assets/js/core/ai-matching.js` gained `buildPostings`, `scoreOne`, `percentText`, `sortValue`, `badgeText` and the note text. `ai-matching.js` is now also loaded by `pages/student/overview.html` and `pages/partner/postings.html`.
- Files: `assets/js/core/ai-matching.js`, `assets/js/student/jobs.js`, `assets/js/student/internship-overview.js`, `assets/js/partner/portal.js`, `pages/student/job-matching.html`, `pages/student/overview.html`, `pages/partner/postings.html`, `tests/js/ai-matching.test.js` (new). No backend or schema change.
- Tests: new `node --test tests/js/ai-matching.test.js` passed 9 tests (payload building, formatting, neutral ordering, one-applicant scoring, failure instead of a substitute number). `app-service` 104 and `ai-service/tests` 23 still pass. Syntax checks passed on the four edited scripts.
- Browser check (2026-11-22, built-in browser pane; static site on 5500 and AI service on 8000 only, no account API or MySQL, so the browser-storage prototype path with seeded demo accounts): AI service up: Job Matching card and modal showed 54% from the service with the tooltip; Overview tile 54%; partner Candidate ranking reordered applicants from application order (Ben, Cy, Ana) to Ana 97%, Ben 13%, Cy "No skills listed". AI service stopped: card and modal "Score unavailable" with empty `data-score`, Overview tile `—`, partner table "Score unavailable" with no percentages, application order kept and the service-down notice shown. No JavaScript errors; the only console error was the expected refused connection to the stopped account API.
- NOT verified: database-backed student and partner accounts (account API 8001 and MySQL were not started), so the `databaseAccount` / `sharedPostings` code paths were not exercised in a browser; the live Docker/host deployment; mobile layout.
- Acceptance (repeat on real accounts): with the AI service running, open Job Matching (cards show similarity percentages, order by score), open a partner posting's applicants (percentages and order), and the student Overview tile. Stop the AI service (port 8000) and reload each: cards and the partner table must say "Score unavailable", keep application/posted order, and show no percentages. Hard-refresh first because script URLs are unchanged.

## Threshold, location filter and automatic fallback, PLAN.md Phase 2 (2026-11-22)

- AI service: `/api/match/rank` now returns `threshold` (τ) and a `meets_threshold` flag per match. τ comes from `IC_MATCH_THRESHOLD` (default 0.60, the Chapter 3 development baseline; invalid or out-of-range values fall back to 0.60). Ranking order and similarity values are unchanged. `matching.py` gained `DEFAULT_THRESHOLD`, `parse_threshold`, `meets_threshold`; `rank_embeddings` takes an optional `threshold`. Final τ still comes from the Phase 1 calibration.
- Job Matching: new optional "Any distance / Within 5, 10, 25, 50 km" control. Location is requested only when a radius (or the Distance sort) is chosen; if refused, the control resets. The radius removes only postings whose distance is known and beyond it; remote postings and postings without a saved site stay. Distance never changes a score: it only breaks ties between postings with the same displayed percentage.
- Automatic fallback: when the service answered and no eligible posting (right stage for the student, inside any radius) reaches τ, including when there are no postings, a panel shows the student's key skills, the top 3 O*NET occupations from `/api/match/careers` (skills only, no resume free text), and outbound LinkedIn / JobStreet links. It does not appear while scores load or when the service is down. The old hard-coded example text ("Junior Software QA ... Selenium, Jest") was removed from `job-matching.html`. Explore Careers is unchanged.
- Postings below τ are still listed, ranked by similarity. Whether to hide them is a method choice for the adviser.
- NOT done: coursework in matching (D14, adviser) and identifier filtering of embedded text (D15); both undecided. The Explore Careers dialog still sends free-text resume fields.
- Files: `ai-service/matching.py`, `ai-service/main.py`, `ai-service/tests/test_matching.py`, `ai-service/tests/test_onet_api.py`, `assets/js/core/ai-matching.js`, `assets/js/student/jobs.js`, `pages/student/job-matching.html`, `tests/js/ai-matching.test.js`, `.claude/launch.json` (new, preview servers). No app-service or schema change.
- Tests: `ai-service/tests` 29 passed (6 new); `node --test tests/js/ai-matching.test.js` 18 passed (9 new); `app-service` 104 passed. Syntax checks passed.
- Browser check (built-in browser, site 5500 + AI service 8000, seeded browser-storage demo accounts): design skills vs QA posting (12%): panel shown with skills, "Graphic Designers 26.5%", two other occupations and both links; matching skills (100%): panel hidden; radius 5 km with location stubbed 13,329 km away: the 100% posting was excluded and the fallback appeared; "Any distance" restored it; refused location reset the control with the toast; location 0.07 km away kept the posting; AI service stopped: "Score unavailable" and no panel.
- Observed limits: the first `/api/match/careers` request took about 26 s (occupation index build; later calls cached), longer than the 10 s target; lower-ranked occupations can be odd (a designer was offered "Brickmasons" at 26% alignment). Neither was changed. The distance tie-breaker was checked by unit test only, not in the browser.
- NOT verified: database-backed accounts (account API and MySQL not started), Explore Careers after these changes, mobile layout. Restart the AI API (port 8000) to pick up the new response fields; hard-refresh the page.
- Acceptance (real accounts): with a student whose skills fit no internship, open Job Matching and wait for the panel (the first run may take about 30 s); stop the AI API and confirm no panel and "Score unavailable"; set `IC_MATCH_THRESHOLD=0.9` before starting the AI API and confirm a 54% posting now triggers the panel text "90% similarity threshold".

## Matching evaluation pipeline, PLAN.md Phase 1 (2026-11-22)

- New `ai-service/evaluate_matching.py`: reads a CSV of human-rated pairs (`pair_id, source, student_skills, job_skills, rater_1..rater_N`), labels pairs relevant at mean rating >= 4.0, splits 80/20 stratified with a fixed seed, selects τ by stratified 5-fold cross-validation on the calibration set only, then reports held-out precision, recall and F1 with bootstrap 95% CIs, Pearson r (with CI and the Table 6 wording) and Fleiss' κ. Writes JSON and Markdown. Similarities come from `main.score_match`, the service's own path (same model and O*NET normalisation); nothing is retrained.
- Safeguards: synthetic pairs are refused unless `--allow-synthetic`, and then outputs are named `NOT_FOR_REPORTING_*` and the status line says so; N other than 100 and a small held-out set produce warnings; input errors name the CSV line; a test proves that changing only the held-out scores cannot change τ or the τ curve.
- Added `ai-service/evaluation_sample/pairs_SYNTHETIC_not_for_reporting.csv` (40 invented pairs, 3 raters) and a README section. `.gitignore` now ignores `ai-service/evaluation_data/` for real rated pairs.
- Tests: `ai-service/tests/test_evaluate_matching.py` added 31 tests (CSV validation, label boundary at 4.0, split and folds, P/R/F1, Pearson, κ, τ tie-breaks, bootstrap, synthetic gate, CLI exit codes, report files). `ai-service/tests` now 60 passed. No change to the running service or the pages.
- Smoke run with the real model on the synthetic sample (reports written to a scratch folder, not the repo): τ = 0.55, held-out F1 = 1.000 (8 pairs), Pearson r = 0.890, κ = 0.831. These numbers are for the invented sample only and must not be quoted.
- Finding: with 8 held-out pairs and a perfect classifier the percentile bootstrap interval has zero width. With N = 100 (20 held-out pairs) it will still understate uncertainty; exact intervals or a larger benchmark are an adviser decision (PLAN.md D11).
- NOT done: exporting benchmark pairs from real anonymized profiles and postings; the HR scoring sheet (Appendix I) and real ratings; a run on real data. The scoring path embeds skills only; if D14 (coursework) is approved, update the path first and rerun. The final τ is set only after a real run.

## Benchmark export and HR scoring sheets, PLAN.md Phase 1 (2026-11-25)

- New `ai-service/benchmark.py` with two commands. `export` reads the app database through the app's own `database()` helper (`IC_DB_*` environment variables; credential files are not touched) and builds the rated-pair benchmark; `merge` checks the completed sheets and writes the CSV that `evaluate_matching.py` reads.
- Consent and approval gates: only students listed in a consent file (one email per line) and postings listed in an approved-postings file (one id per line) are read. There is no consent or research-approval field in the schema, so the researchers' lists are the source of truth. An empty list is refused before the database is queried.
- Privacy: only skill names and the program code are exported (resume `soft` + `hard` skills; posting `skills` and `title`). Skills that look like identifiers (emails, web addresses, 7+ digit runs) and over-long or too-short items are dropped and counted; students or postings with fewer than 2 clean skills are excluded. Students and postings get random aliases (S001, J001); raters see pair ids only. `benchmark_key_PRIVATE.csv` maps aliases back to emails and posting ids. All outputs go to the git-ignored `ai-service/evaluation_data/benchmark/`.
- Pair selection never uses the model's score (the system under test must not choose its own test pairs): per program (BSCS, BSHM, BSBA, balanced, 34/33/33 at N = 100), `--cross-share` (default 0.4) of the pairs use a posting for a different course and the rest the same course, spread evenly over students and postings, seeded. Relevance is decided only by the raters. A shortage of students or postings is reported in the summary and as warnings, never padded silently.
- Rater sheets: `hr_sheet_R01.csv` ... one per evaluator (default 10), UTF-8 with BOM for Excel, the same pairs in a different order for each, blank `rating` and `comment` columns, and `hr_rubric_DRAFT.md` (1-5 anchors and instructions). The rubric is my draft because Appendix I does not exist yet; it needs the adviser's approval and replacement. Export will not overwrite existing files without `--force`, so completed sheets cannot be lost by a re-run.
- Merge validation: every sheet must contain every pair exactly once with an unedited skills text and a number from 1 to 5; problems are listed per evaluator and pair and nothing is written. Evaluators are numbered rater_1.. in sheet-file order. The output has `source = real`, so `evaluate_matching.py` treats it as reportable.
- Tests: `ai-service/tests/test_benchmark.py` adds 29 tests (cleaning, pseudonyms, balanced and reproducible selection, shortage warnings, no identifying text in any rater file, per-rater ordering, overwrite protection, merge errors, database read with a fake connection, CLI exit codes, and an export -> rate -> merge -> evaluate round trip). `ai-service/tests` now 89 passed. No change to the running service or the pages; app-service and Node suites not re-run (untouched).
- NOT verified: the export against the real database (needs the researchers' consent and approved-posting lists and live `IC_DB_*` settings); how the sheets look in Excel with different regional CSV settings (a semicolon-delimited save is detected and reported); the real rating workflow with HR evaluators.
- Limits: students are reused across pairs (the pilot has only 31 interns), so pairs are not independent and the same student profile is rated several times; the evaluators' ratings, not the pairing, define relevance. Real resumes exist only once students have saved them during the pilot.

## Attendance completeness, PLAN.md Phase 3 (2026-11-25)

- Schema (additive, `schema.sql`): `attendance_holidays` (per batch and date), `attendance_absences` (per student and date, with the coordinator's review and the student's note) and `attendance_attempts` (one row per clock attempt). Run `manage.py init` / `start-local.cmd -InitDatabase`, then restart the app API.
- Verification (`attendance.py`): a time-in or time-out is flagged, with reasons stored in the record, for "out of radius", "low GPS accuracy" (reported accuracy above `IC_GPS_ACCURACY_LIMIT_M`, default 100 m, a development default not from the thesis; skipped on remote days) and, at time-in, "missing photo". A missing photo used to be refused with a 422; it is now saved as a flagged record, as thesis Chapter 3 says, so `Clock` accepts an empty photo while a present photo must still be a real image. A time-in on a holiday is "Outside schedule" for coordinator review. The clock response now returns `{ok, status, flags}`.
- One geofence default: `placements.py` `DEFAULT_GEOFENCE_M = 150` (was 100 for deployments without an explicit site); the pages already used 150. D4 applied as 150 m, pending your confirmation.
- Attempts log: accepted, flagged and refused attempts are recorded with outcome, reasons, measured distance, reported accuracy and radius. Refusals (no deployment, already timed in, no open time-in, worksite not configured) are logged in a separate transaction so the rollback does not erase them, and a logging failure never hides the refusal. Schema-invalid requests (HTTP 422) are not logged.
- Holidays: new `attendance_holidays.py` (`GET/POST /api/coordinator/holidays`, `DELETE .../{class_code}/{date}`), batch-ownership checked, duplicates refused, validated kinds and dates. Adding one removes unreviewed absences on that day. The coordinator holiday modal calls it for database accounts (cache in `core/holidays.js`, loaded per batch in `coordinator/database.js`); prototype accounts keep `localStorage`.
- Absences: recorded on first read for each deployed student (scheduled workdays from the day after deployment up to yesterday, Manila time, never on holidays, none once 486 hours are credited, lookback capped at 400 days). Holiday rows are returned for scheduled holidays. Students can explain an absence; the coordinator excuses it or keeps it absent (`/api/coordinator/attendance/review` now accepts `excused` / `unexcused`; the intern page maps Excuse / Keep absent to them), with undo.
- Audit: clock events, flagged outcomes, reviews, excuses, explanations and holiday changes are written in the same transaction (`audit.py` `record_attendance`, `record_batch_event`; feed labels "Attendance <date>" and "Holiday <date>", and batch events show no student).
- UI: coordinators see the flag reasons (and the accuracy for low-accuracy flags) under the location; students see why a day was flagged and get a warning toast when their clock-in is flagged.
- Tests: `app-service` now 162 passed (was 104): `test_attendance.py` rewritten (the old mock-order tests were updated for the new flow; scripted inside, outside, boundary, low-accuracy, missing-photo, remote, holiday, off-schedule, time-out and refused attempts; absence generation, holidays, excuse, explanation, audit) plus new `test_attendance_holidays.py` and four audit tests. `ai-service` 89 and Node 18 unchanged and passing. JavaScript syntax checks passed on the seven edited scripts.
- Browser check (built-in browser, site only, seeded browser-storage accounts, account API stubbed in the page): the prototype holiday modal still adds and removes days through `localStorage`; the database branch sent `POST {classCode,date,name,type}` and `DELETE`, re-read holidays and attendance after each change, wrote nothing to `ic_holidays`, and an API error was shown as a toast with the list unchanged and the button usable again; the new flag text renders and escapes markup.
- NOT verified: anything against a real MySQL database or real accounts (the SQL, the lazy absence insert, the foreign keys, the audit rows), the student pages with the new toast and flag text, the Excuse / Keep absent clicks end to end, mobile layout. The 100 m accuracy limit and the 150 m default need your confirmation.
- Acceptance (real accounts, after `manage.py init`): deploy a student with a 7-day-old deployment date and a Mon-Fri schedule; open the coordinator attendance page and confirm one Absent row per missed scheduled workday and none for today; add a holiday on one of those days and confirm that row becomes a Holiday; clock in with a poor GPS fix (or set `IC_GPS_ACCURACY_LIMIT_M=5` and restart) and confirm the record is Flagged with "low GPS accuracy" and the student sees the warning; clock in outside the radius and with the camera blocked; have the student explain an absence and the coordinator excuse it; check the audit trail shows each step and `attendance_attempts` has one row per attempt including a refused double time-in.

## Development accounts (2026-11-25)

- Finding: the app README documented a prototype demo login for all roles, but no code accepts it (only the README text mentioned it), so no working account existed for any role. The README sentence was corrected.
- New `app-service/dev_accounts.py` and `manage.py dev-accounts [--reset-passwords]`: creates, in a local database only, a coordinator who owns batch `DEV-CS-2026`, an approved student with a saved resume (so Job Matching and applications work), a second student waiting for approval (to try the coordinator's Requests), and an approved partner whose company has one open sample internship. Emails use the reserved `example.com` domain and pass the registration email rule.
- Safety: it refuses any database host other than 127.0.0.1, localhost or ::1; it creates only what is missing and never changes an existing account's password unless `--reset-passwords` is given; it refuses to take a batch owned by another coordinator; passwords are random (16 characters, meeting the app's policy), hashed with the same PBKDF2 function as registration, never printed, and written to the git-ignored `.local/dev-accounts.txt`. It does not read the encrypted database credential file.
- Tests: `test_dev_accounts.py` adds 16 tests (local-only guard, password policy, each role's rows, active versus pending student, hashes verify, seeded posting and resume pass the app's own models, idempotence, reset, batch-ownership guard, passwords reach the file and never the screen, remote host writes nothing, the file sits in a git-ignored folder). `app-service` now 178 passed. `manage.py dev-accounts --help` parses.
- NOT done or verified: running it against a real MySQL database (it needs your `IC_DB_*` settings, which I cannot read), signing in with the created accounts, and alumni accounts (alumni conversion is still a browser-only prototype, so no alumni account can be created in the database).

## End-to-end verification on a real MySQL (2026-11-25)

- Until now everything had been checked with mocked cursors or a stubbed API. A second, throwaway MySQL 8.0 was run from the installed binaries (own data folder in the scratch directory, port 3307, empty root password, nothing shared with the existing MySQL80 service or the saved credentials) with the real app API, AI service and static site.
- `manage.py init` applied the whole schema including the three attendance tables, and was repeatable. `manage.py dev-accounts` created the four accounts and a second run changed nothing.
- New `app-service/e2e_check.py`: signs in as the dev coordinator and partner, creates fresh interns and walks sign-up and approval, postings (publish, close, reopen), applications, deployment with signed scans, scripted clock attempts (inside the geofence, outside, low GPS accuracy, no photo, duplicates), reviews and explanations, a five-day time shift to produce absences, holidays and excuses, reports (submit, revise, stale version, grade cap, grade), placement letters (ownership, replace, retained after placement), notifications, the audit trail, a second coordinator's isolation, role-to-role access refusals, and the AI service (ranking, `meets_threshold`, O*NET fallback, empty input). It reads the attempts log and shifts a deployment date with two direct SQL statements, and skips those checks without `IC_DB_*`.
- First run: 107 passed, 2 failed. Both failures were wrong expectations in the script (a still-open clock-in is shown as "Clocked in", and the company name was not URL-encoded); the app behaved correctly. After fixing the script: 113 passed, 0 failed, 0 skipped. This is the first time the attendance SQL, the lazy absence insert, the foreign keys and the audit rows ran on a real MySQL; nothing in the app needed changing.
- `/health` now also probes `attendance_holidays`, `attendance_absences` and `attendance_attempts`, so a missing `manage.py init` is reported instead of failing later.
- Browser check with real accounts (signing in through the real login page): coordinator (Overview, Attendance, intern log with Excuse, Keep absent, Undo, Accept and Reject through the buttons, the holiday dialog adding and removing a day with the intern's absence turning into a Holiday row and back, Audit Trail listing each click, Requests with the pending student, Placements, Classwork), partner (postings with applicant counts, applicant ranking with AI scores), student (attendance with the coordinator's decision, day-log explanation text and the explanation form, job matching scores, the fallback panel for skills that match nothing, "Score unavailable" with the AI service stopped). This closes the real-account checks left open by D13, Phase 2 and Phase 3.
- One wording fix to remember: in the partner view the interns' shared 84% reflects a soft skill ("Communication") in their resumes; it is not a bug.
- `docs/testing-guide.md` (new) gives the setup, the one-command check, a manual walkthrough per role with expected results, and what is not covered. `test_e2e_check.py` (8 tests) keeps the script's payloads valid against the app's own models. `app-service` now 186 passed.
- Not covered: camera and GPS in a real browser over HTTPS, PDF exports, mobile layout, and everything not built yet (resume NLP pipeline, tamper hashes, alumni, supervisor-evaluation gate, MOA alerts, retention, Word export, real email verification).

## Camera-only attendance photos (2026-11-25)

- Request: attendance must take the photo from the camera itself, never a gallery, for security and authenticity.
- Page: `assets/js/student/attendance.js` requests a capture code when the camera opens (and on retake), refuses a frame unless the video track is live, prints the code and time onto the picture and sends the code as `challenge`. `core/postings-api.js` gained `attendanceChallenge`. No file input exists on the attendance or day-log pages.
- Server: `attendance.py` adds `POST /api/student/attendance/challenge` (HMAC-signed, 180 s, bound to the student; `IC_CAPTURE_SECRET` for multiple workers), requires a valid code for any time-in photo (400, logged as "photo not live"), accepts only JPEG up to 480 x 960 (422), flags Exif metadata, stores `captureCode`.
- Tests: `test_attendance.py` (CameraEvidenceTests), new `test_attendance_camera_only.py` (static guard against file inputs, FileReader, drag-drop), `e2e_check.py` (valid JPEG, challenge before each time-in, PNG/oversize/missing/forged/other-student refusals) and `test_e2e_check.py`. app-service 199 passed, Node 18 passed, edited scripts pass `node --check`.
- Live check (same day, throwaway MySQL on port 3307, real app API and AI service): `e2e_check.py` 118 passed, 0 failed, 0 skipped. The first run had 1 failure, a wrong expectation in the script (the attempts log now also holds three refused "photo not live" attempts); the app was right. Servers stopped and the scratch passwords file deleted afterwards.
- NOT run: the page with a real or simulated camera. Acceptance test: on a phone over HTTPS, Time In shows the code on the captured photo; the coordinator sees it in the photo viewer; an old capture or another student's code is refused.
- Limit: a browser cannot prove a frame came from a camera. A script or virtual camera can still send a valid frame.
