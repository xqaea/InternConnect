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
