# Shared postings API

This MySQL service is separate from the AI service on port 8000. It stores accounts, batch ownership and approvals, login limits, shared postings with GPS coordinates, resumes, application snapshots, confirmed placements, attendance, classwork tasks, narrative reports, reviews and grades. Database accounts read these records across browsers. Signed endorsement and acceptance letters in student folders are shared through MySQL between the owning coordinator, company and student, including before deployment. Other document-vault types, broader audit coverage, alumni transitions and some other OJT controls still use prototype storage; see `docs/implementation-progress.md` for acceptance status and remaining work.

## Setup

Install and start MySQL Server. The app does not install or start MySQL for you. Initialize the schema with an account allowed to create the database and its tables. The runtime account only needs SELECT, INSERT, UPDATE and DELETE on this database.

From the repository root:

```powershell
ai-service\.venv\Scripts\python.exe -m pip install -r app-service\requirements.txt
$env:IC_DB_HOST = '127.0.0.1'
$env:IC_DB_PORT = '3306'
$env:IC_DB_NAME = 'internconnect'
$env:IC_DB_USER = 'your_database_user'
$env:IC_DB_PASSWORD = Read-Host 'Database password'
ai-service\.venv\Scripts\python.exe app-service\manage.py init
```

Provision an approved partner account from the server terminal. This asks for a password without echoing it. Use the student's exact class/batch code so postings appear in that batch:

```powershell
ai-service\.venv\Scripts\python.exe app-service\manage.py add-partner --email hr@example.com --name 'HR Representative' --company 'Example Company' --batch PHINMA-CS-2026
```

Partner browser registration creates a pending database account using an active coordinator-owned class code. Its coordinator approves or rejects it in Requests. The administration command above remains available for provisioning approved accounts. Browser-supplied company names and role flags cannot authorize shared writes. Passwords use salted PBKDF2 hashes; eight-hour session tokens are stored as hashes on the server. Incorrect credentials are rejected; a service outage shows an error without consuming an attempt.

After five failed passwords, that role/email is locked for five minutes. Partner limits are persisted in the MySQL `login_attempts` table and serialized with a row lock. Re-run `manage.py init` on existing installations to create this additional table, then restart the API. Browser login shows remaining attempts and a countdown. Correct credentials clear failures; expired locks start a new attempt cycle.

Student, coordinator and partner authentication and login limits are enforced by the server. There is no built-in demo login: an earlier version of this file documented one, but nothing in the code accepts it any more, and unknown email/password combinations never open a session. To try each role locally, create the development accounts described under "Development accounts" below.

## Coordinator accounts and batch ownership

Run `manage.py init` again to add coordinator tables, then restart the API. Register using the existing Coordinator pages and a NEW class code (the Generate button supplies one). Signup atomically creates the coordinator, initial batch and ownership link; duplicate email/code conflicts roll back the whole signup. Program, school and theme come from that account when it creates additional batches. Coordinator registration follows the existing self-registration behavior; the email confirmation code is still a testing stub and does not establish school employment.

Sign in as Coordinator. Batch create/rename/archive/restore/delete and Close Batch now update MySQL. Each page validates the session and loads owned batches and student profiles before initializing the page. Students sign up using these class codes, and appear in Requests. Approve permits server login; Reject removes the pending signup so it can register again. The API denies changes to another coordinator's batches/students and prevents deleting populated or last remaining batches. Other OJT operations, partner-link approval, alumni approval and audit entries remain local prototype data.

Existing browser-only coordinators must register again; old local records are retained, but server login never trusts their local passwords. Only server-owned batches appear for a database coordinator. An existing batch previously added by the admin can be linked explicitly by an administrator using:

```powershell
ai-service\.venv\Scripts\python.exe app-service\manage.py assign-batch --email coordinator@example.com --code PHINMA-CS-2026
```

This accepts only an unowned batch or its current owner, and requires the coordinator's program to match. Public signup cannot claim an existing batch. Refresh the portal after assigning it. Restoring the preceding frontend/API version provides rollback while keeping all added tables and local records intact.

## Student accounts

Re-run `manage.py init` to add the student tables without deleting existing data. Register each batch in the server before students use its code. For the existing demo program:

```powershell
ai-service\.venv\Scripts\python.exe app-service\manage.py add-batch --code PHINMA-CS-2026 --program 'BS Computer Science' --school 'PHINMA - St. Jude College Dasmariñas Cavite'
```

Restart the API, then use the existing Student registration pages. Signup stores the identity and hashed password in MySQL and redirects to login with a pending-approval message. The class must exist on the server, be active and match the student's program. Repeated emails return a conflict. The UI email confirmation code remains the existing `123456` testing stub; this is not production email verification.

Use the coordinator's Requests page to approve students. The trusted server terminal also retains the administration command:

```powershell
ai-service\.venv\Scripts\python.exe app-service\manage.py approve-student --email student@example.com
```

Approved students can sign in from another browser using the same email/password. Passwords are never returned to the browser. Login creates an eight-hour session, page startup checks `/api/auth/student/me`, and logout revokes the session. Invalid/expired/pending sessions cannot hydrate the student portal. The browser caches profile data for existing OJT screens, without a password; those screens' records remain local. Only server approval updates permit a pending student's login.

Existing browser-only students must register through the website again to create a MySQL account. Their local data is retained; after a successful database login, a matching cached account has its old plaintext password removed. No automatic password import occurs. For rollback, preserve the database and local records and restore the preceding frontend/API version; none of the new tables replace or drop the prototype records.

Check student and partner auth behavior without touching live data:

```powershell
ai-service\.venv\Scripts\python.exe -B -m unittest discover -s app-service -p 'test_*.py'
```

Run focused auth regression checks with `ai-service\.venv\Scripts\python.exe -B -m unittest discover -s app-service -p test_login_lockout.py`.

Start the app API in the same terminal as the database environment variables:

```powershell
ai-service\.venv\Scripts\python.exe -m uvicorn main:app --app-dir app-service --host 0.0.0.0 --port 8001
```

The AI service stays in its own terminal on port 8000. Visit /health on port 8001: it must return status: ok and database: mysql. Health now checks all implemented account, session, batch, login-limit and posting tables without reading user records. Missing tables return a database-unavailable error; run `manage.py init` with the database setup credentials, then restart the API. This checks table availability, not a complete registration/approval flow. API documentation is at /docs. Restarting the API does not erase postings.

## Browser flow

Serve the site with `py -m http.server 5500`. Sign in as the provisioned Industry Partner through the normal login screen. Create a posting, enter a place name, capture GPS at the internship site, and save. Edit/close/reopen now writes to MySQL. Existing local postings are preserved and are not automatically uploaded.

In another browser, use a student account with the same class code, then open Job Matching. It loads open postings for that batch from the server, including companies absent from that student's local storage. Distance uses posting GPS first. Student coordinates remain in page memory and are not sent to either server.

On HTTP development pages the app API defaults to the website hostname on port 8001. For another device, open the website using the server computer's LAN address rather than localhost, and set IC_APP_ALLOWED_ORIGINS on the server to that website's exact origin, for example http://192.168.1.10:5500. Allow the needed ports through the firewall. GPS generally requires HTTPS on a LAN address; localhost works for local development.

For HTTPS deployment use a same-origin reverse proxy at /app-api, or set window.IC_APP_API_BASE before loading postings-api.js. Serve both site and API through HTTPS. Set IC_APP_ALLOWED_ORIGINS to exact permitted frontend origins when they differ. Keep MySQL accessible only to the API server.

If a student posting read fails, the app explicitly reports local browser fallback. Failed saves by a server-authenticated partner remain errors and are never silently saved locally. Public posting reads expose only posting/company information, not accounts or credentials.

## Development accounts

To try every portal on your own computer, create one account per role in a local database (run `manage.py init` first):

```powershell
$env:IC_DB_HOST = '127.0.0.1'; $env:IC_DB_USER = 'your_database_user'; $env:IC_DB_PASSWORD = Read-Host 'Database password'
ai-service\.venv\Scripts\python.exe app-service\manage.py dev-accounts
```

It creates a coordinator who owns the batch `DEV-CS-2026`, an approved student with a saved resume, a second student waiting for the coordinator's approval, and an approved partner whose company has one open sample internship. Emails are `dev.coordinator@example.com`, `dev.student@example.com`, `dev.student.pending@example.com` and `dev.partner@example.com` (`example.com` is reserved and never reaches a real person). Passwords are random, are never printed, and are written to `.local/dev-accounts.txt`, which Git ignores; delete that file and the accounts when you are done. Existing accounts keep their password; add `--reset-passwords` to replace them. The command refuses any database host other than this computer. Alumni accounts cannot be created this way: alumni conversion is still a browser-only prototype.

Things to try: sign in as the coordinator and approve the pending student under Requests; sign in as the student and apply to the sample internship in Job Matching; sign in as the partner to review the applicant; then have the coordinator upload the signed scans and deploy the student to start attendance.

To check every role's use cases automatically, run `app-service/e2e_check.py` against the running API; `docs/testing-guide.md` explains it, lists a manual walkthrough per role and says what is not covered.

## Attendance rules

Re-run `manage.py init` (or `start-local.cmd -InitDatabase`) to add three tables without touching existing data: `attendance_holidays`, `attendance_absences` and `attendance_attempts`. Then restart the API.

- **Verification.** A time-in or time-out is saved as a flagged record, with the reasons stored, when the measured distance is beyond the site radius ("out of radius"), the reported GPS accuracy is worse than the limit ("low GPS accuracy"), or a time-in has no live photo ("missing photo"). Remote days skip the radius and accuracy checks. Flagged days earn no hours until the coordinator accepts them. A time-in on a holiday or an unscheduled day is saved as "Outside schedule" for the same review.
- **Defaults.** The geofence radius defaults to 150 m (thesis Chapter 3) and is set per site. The accuracy limit defaults to 100 m and can be changed with the `IC_GPS_ACCURACY_LIMIT_M` environment variable (a positive number of metres); this default is a development choice, not a thesis value.
- **Attempts log.** Every clock attempt that reaches the handler is written to `attendance_attempts` with its outcome (`accepted`, `flagged` or `rejected`), reasons, measured distance, reported accuracy and radius. Refused attempts (no deployment, already timed in, no open time-in, worksite not configured) are logged too, in their own transaction. Requests rejected by schema validation (for example impossible coordinates) are not logged. See "Camera-only photos" below.
- **Camera-only photos.** The page has no file picker, gallery, drop target or `capture` input; the photo is a frame drawn from the live `getUserMedia` stream. The server backs this up as far as a browser allows: `POST /api/student/attendance/challenge` issues a signed capture code (180 s, bound to the student, HMAC key per process, or `IC_CAPTURE_SECRET` when several workers run); the page prints the code and time onto the picture; a time-in photo without a valid, unexpired code of the same student is refused (400 "photo not live", logged); the photo must be a JPEG no larger than 480 x 960 (else 422); a JPEG carrying Exif camera metadata is saved but flagged "photo has camera metadata". The code is stored as `captureCode`. This is not proof of a camera: a script or a virtual camera can still produce a valid frame, which only a native app or hardware attestation could stop.
- **Holidays.** Coordinators manage holidays and no-work days per batch (`GET/POST /api/coordinator/holidays`, `DELETE /api/coordinator/holidays/{class_code}/{date}`). Holidays are never absences; adding one removes unreviewed absences recorded for that day.
- **Absences.** A scheduled workday after deployment (starting the day after) and before today, with no clock-in and no holiday, is recorded in `attendance_absences` the first time attendance is read. Nothing is recorded for today, and no new absences are recorded once the required 486 hours are credited. The student can explain an absence; the coordinator excuses it or keeps it absent, and can undo that.
- **Audit.** Clock events, flagged outcomes, reviews, excuses, explanations and holiday changes are written to the audit log in the same transaction as the change.

## Acceptance checks

1. Provision two partners for different companies and sign in separately.
2. Partner A creates a posting with GPS. A student in the same batch sees its title and coordinates.
3. Refresh/restart the API: the posting remains.
4. Close it and refresh the student listing: it disappears. Reopen it: it returns.
5. Partner B cannot edit A's posting; the API returns 404.
6. Missing/expired authorization cannot write; wrong passwords are rejected.
7. Saving without GPS stores null coordinates, never an invented 0,0 location.

This migration covers account authentication, coordinator batches/student join approvals, and shared postings. Application submissions, alumni workflows, audits, and resume/attendance synchronization remain subsequent database work.
