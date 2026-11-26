# Testing every feature by role

This guide shows how to check that each role's features work with their use cases: one command that walks the real workflows, a short manual walkthrough for each role, and a list of what is not covered. It was first run on 2026-11-25 against a throwaway MySQL with the real API, the AI service and the real pages (results at the end).

## 1. Prepare a database

Use a database you can fill with test data. A separate one is safest, because the checks create interns, tasks, holidays and audit entries and leave them behind:

```powershell
$env:IC_DB_HOST = '127.0.0.1'; $env:IC_DB_PORT = '3306'; $env:IC_DB_NAME = 'internconnect_test'
$env:IC_DB_USER = 'your_database_user'; $env:IC_DB_PASSWORD = Read-Host 'Database password'
ai-service\.venv\Scripts\python.exe app-service\manage.py init
ai-service\.venv\Scripts\python.exe app-service\manage.py dev-accounts
```

`init` is safe to repeat. `dev-accounts` creates a coordinator, an approved student with a resume, a pending student and a partner with one sample internship, and writes their random passwords to `.local/dev-accounts.txt` (Git ignores it; open it to sign in). It refuses any database that is not on this computer.

Then start the three services against that database. `start-local.cmd` uses the saved MySQL credentials and the default database name, so for a separate test database start the app API yourself with the variables above:

```powershell
ai-service\.venv\Scripts\python.exe -m uvicorn main:app --app-dir app-service --port 8001
ai-service\.venv\Scripts\python.exe -m uvicorn main:app --app-dir ai-service --port 8000
ai-service\.venv\Scripts\python.exe -m http.server 5500
```

(run each in its own window; the last one from the project root). Open http://127.0.0.1:5500/pages/auth/login.html.

## 2. The automated use-case check

With the app API (and, for the matching checks, the AI service) running and the `IC_DB_*` variables set in the same window:

```powershell
ai-service\.venv\Scripts\python.exe app-service\e2e_check.py
```

It prints PASS, FAIL or SKIP for each use case and exits with 1 if anything failed. Without `IC_DB_*` the checks that need the database (moving a deployment date back, reading the attempts log) are skipped; without the AI service the matching checks are skipped. It creates fresh `e2e.*@example.com` interns each time and lists their passwords in `.local/dev-accounts.txt`, so you can sign in as an intern who is deployed, has flagged days, absences, a graded report and a placement letter.

What it covers, by role:

| Role | Use cases checked |
|---|---|
| Everyone | API and every table healthy; wrong password refused; unapproved student cannot sign in; each role is refused on the other roles' endpoints; signed-out requests refused |
| Partner | Publish, close, reopen a posting (closed postings are not listed and cannot be applied to); see and accept applicants; upload and replace a signed letter |
| Student | Sign up (pending), saved resume, apply once per posting, see tasks, submit and revise a report, see a grade, clock in and out, explain a flagged day or an absence, read own letter only, notifications |
| Coordinator | Approve a sign-up; confirm deployment (needs signed scans, only once); classwork task; review reports (revision needs feedback, stale versions refused, grade capped at the maximum); accept, reject, undo a flagged clock-in; add and remove holidays (no duplicates, valid kinds); excuse, keep or undo an absence; shared vault rules; notifications; audit trail |
| Attendance rules | Inside the geofence is Present; outside, low GPS accuracy and no photo are each Flagged with the right reason and earn no hours; duplicate time in or out refused; every attempt logged with outcome, distance and accuracy; scheduled days without a clock-in become absences, never on holidays, never duplicated |
| Isolation | A second coordinator cannot see, review, add holidays to or read the audit of the first coordinator's batch |
| AI service | The related posting ranks first with a threshold and `meets_threshold`; the O*NET fallback returns occupations; an empty skill list is refused |

## 3. Manual walkthrough by role

Sign in with the accounts in `.local/dev-accounts.txt`. The expected results below are what the pages showed on 2026-11-25.

**Coordinator** (`dev.coordinator@example.com`)
1. Requests lists the pending student with Approve and Reject. Approve them if you want to test sign-in as that student.
2. Placements lists the deployed interns as Deployed and the unplaced dev student as "Not placed, student can apply through Job Matching".
3. Attendance & Progress lists the deployed interns with "flagged" badges where a day awaits review. Open an intern's log: a low-accuracy day shows "low GPS accuracy (±450 m)" with Accept and Reject; Undo clears it.
4. On an intern with absences: Excuse, Keep absent and Undo change the row and the summary ("Absent 3, 1 excused").
5. Holidays & no-work days: add a holiday on a day the intern was absent. That day becomes a Holiday row and the working-day count drops; removing it brings the absence back.
6. Classwork lists the tasks with turn-in counts. Audit Trail shows every action above (accepted, excused, holiday added).

**Student** (`dev.student@example.com`, or an `e2e.*` intern)
1. Job Matching lists the open internships with similarity scores from the AI service; an already-applied posting shows "Applied". Stop the AI service and reload: every score reads "Score unavailable" and no fallback appears.
2. With a saved resume whose skills match no posting, the fallback panel appears: key skills, closest O*NET occupations, and links to LinkedIn and JobStreet.
3. An intern with a flagged day opens Attendance Details: the message says why ("the GPS accuracy was too low (±450 m)"), and the explanation form saves and shows "Update explanation". After the coordinator reviews the day, the page shows their decision.
4. Time In needs a real camera and GPS (see "Not covered").

**Partner** (`dev.partner@example.com`)
1. Job Postings lists the company's postings with applicant counts. "View applicants" ranks applicants by similarity score (or says "Score unavailable" with the AI service down).
2. The Vault shows the signed letters the coordinator and partner share for each applicant.

## 4. Not covered

- **Camera and GPS in a real browser** (including the on-photo capture code). The check sends the same requests the page sends, but a person must try Time In on a phone over HTTPS (browsers only allow the camera and location on HTTPS or localhost).
- **Not built yet** (so nothing to test): the NLP and language-model resume pipeline, tamper-evident content hashes, alumni conversion and alumni job postings, the supervisor-evaluation gate and MOA expiry alerts, retention and encryption at rest, Word export, real email verification (the sign-up code is the testing stub `123456`).
- **Exports** (PDF reports) and the **mobile layout** were not exercised.
- The evaluation of the matching engine needs real human-rated data (`ai-service/evaluate_matching.py`, `benchmark.py`).

## 5. Results of the first run (2026-11-25)

On a throwaway MySQL 8.0 with the real app API, AI service and static site: `e2e_check.py` 113 passed, 0 failed, 0 skipped. In the browser, as the coordinator, the partner and a student, signing in through the real login page: every screen above behaved as described, including the Excuse, Keep absent, Undo, Accept and Reject buttons, the holiday dialog, the explanation form, the job-matching scores, the fallback panel and the "Score unavailable" state. The unit suites passed: app-service 178, AI service 89, Node 18.
