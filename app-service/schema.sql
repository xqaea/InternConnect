CREATE TABLE IF NOT EXISTS companies (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(200) NOT NULL, class_code VARCHAR(100) NOT NULL,
 UNIQUE KEY company_batch (name, class_code)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS login_attempts (
 attempt_key CHAR(64) PRIMARY KEY, failures INT NOT NULL DEFAULT 0,
 blocked_until DATETIME NULL, updated_at DATETIME NOT NULL,
 INDEX attempt_cleanup (updated_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS partner_accounts (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(254) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
 password_hash VARCHAR(255) NOT NULL, company_id BIGINT NOT NULL,
 FOREIGN KEY (company_id) REFERENCES companies(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS posting_sessions (
 token_hash CHAR(64) PRIMARY KEY, account_id BIGINT NOT NULL, expires_at DATETIME NOT NULL,
 FOREIGN KEY (account_id) REFERENCES partner_accounts(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS partner_profiles (
 account_id BIGINT PRIMARY KEY, category VARCHAR(150) NOT NULL,
 avatar MEDIUMTEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending', created_at DATETIME NOT NULL,
 FOREIGN KEY (account_id) REFERENCES partner_accounts(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS job_postings (
 id VARCHAR(64) PRIMARY KEY, company_id BIGINT NOT NULL, payload JSON NOT NULL,
 latitude DOUBLE NULL, longitude DOUBLE NULL, status VARCHAR(10) NOT NULL, posted_at DATE NOT NULL,
 FOREIGN KEY (company_id) REFERENCES companies(id), INDEX company_status (company_id, status)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS student_batches (
 code VARCHAR(100) PRIMARY KEY, program VARCHAR(150) NOT NULL,
 school VARCHAR(200) NOT NULL, theme VARCHAR(20) NOT NULL DEFAULT 'sky',
 status VARCHAR(20) NOT NULL DEFAULT 'active'
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS student_accounts (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(254) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL, name VARCHAR(150) NOT NULL,
 student_number VARCHAR(100) NOT NULL, class_code VARCHAR(100) NOT NULL,
 school_email VARCHAR(254) NOT NULL DEFAULT '', personal_email VARCHAR(254) NOT NULL DEFAULT '',
 avatar MEDIUMTEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending',
 created_at DATETIME NOT NULL,
 FOREIGN KEY (class_code) REFERENCES student_batches(code)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS student_sessions (
 token_hash CHAR(64) PRIMARY KEY, account_id BIGINT NOT NULL, expires_at DATETIME NOT NULL,
 FOREIGN KEY (account_id) REFERENCES student_accounts(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS student_resumes (
 account_id BIGINT PRIMARY KEY, payload JSON NOT NULL, updated_at DATETIME NOT NULL,
 FOREIGN KEY (account_id) REFERENCES student_accounts(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS internship_applications (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, student_id BIGINT NOT NULL, posting_id VARCHAR(64) NOT NULL,
 company_id BIGINT NOT NULL, title VARCHAR(200) NOT NULL, internship BOOLEAN NOT NULL,
 resume_snapshot JSON NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'Pending',
 created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
 UNIQUE KEY student_posting (student_id,posting_id),
 FOREIGN KEY (student_id) REFERENCES student_accounts(id),
 FOREIGN KEY (posting_id) REFERENCES job_postings(id),
 FOREIGN KEY (company_id) REFERENCES companies(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS coordinator_accounts (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(254) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL, name VARCHAR(150) NOT NULL,
 program VARCHAR(150) NOT NULL, school VARCHAR(200) NOT NULL, theme VARCHAR(20) NOT NULL,
 school_email VARCHAR(254) NOT NULL DEFAULT '', personal_email VARCHAR(254) NOT NULL DEFAULT '',
 avatar MEDIUMTEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active', created_at DATETIME NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS coordinator_batches (
 class_code VARCHAR(100) PRIMARY KEY, coordinator_id BIGINT NOT NULL,
 term VARCHAR(150) NOT NULL DEFAULT 'Initial batch', created_at DATETIME NOT NULL,
 FOREIGN KEY (class_code) REFERENCES student_batches(code),
 FOREIGN KEY (coordinator_id) REFERENCES coordinator_accounts(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS coordinator_sessions (
 token_hash CHAR(64) PRIMARY KEY, account_id BIGINT NOT NULL, expires_at DATETIME NOT NULL,
 FOREIGN KEY (account_id) REFERENCES coordinator_accounts(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS official_placements (
 student_id BIGINT PRIMARY KEY, application_id BIGINT NOT NULL UNIQUE, coordinator_id BIGINT NOT NULL,
 schedule JSON NOT NULL, endorsement JSON NOT NULL, acceptance JSON NOT NULL, confirmed_at DATETIME NOT NULL,
 FOREIGN KEY (student_id) REFERENCES student_accounts(id),
 FOREIGN KEY (application_id) REFERENCES internship_applications(id),
 FOREIGN KEY (coordinator_id) REFERENCES coordinator_accounts(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS student_attendance (
 student_id BIGINT NOT NULL, work_date DATE NOT NULL, clock_in DATETIME(6) NOT NULL,
 clock_out DATETIME(6) NULL, payload JSON NOT NULL, review VARCHAR(20) NOT NULL DEFAULT '',
 reviewed_by BIGINT NULL, note JSON NULL, PRIMARY KEY(student_id,work_date),
 FOREIGN KEY(student_id) REFERENCES student_accounts(id),
 FOREIGN KEY(reviewed_by) REFERENCES coordinator_accounts(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS classwork_tasks (
 id VARCHAR(64) PRIMARY KEY, class_code VARCHAR(100) NOT NULL, payload JSON NOT NULL,
 created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
 FOREIGN KEY(class_code) REFERENCES student_batches(code)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS narrative_reports (
 task_id VARCHAR(64) NOT NULL, student_id BIGINT NOT NULL, raw MEDIUMTEXT NOT NULL,
 bullet TEXT NOT NULL, status VARCHAR(30) NOT NULL, submitted_at DATETIME NOT NULL,
 version INT NOT NULL, feedback TEXT NOT NULL DEFAULT ('') , score DOUBLE NULL,
 grade_feedback TEXT NOT NULL DEFAULT (''), reviewed_by BIGINT NULL, reviewed_at DATETIME NULL,
 PRIMARY KEY(task_id,student_id), FOREIGN KEY(task_id) REFERENCES classwork_tasks(id),
 FOREIGN KEY(student_id) REFERENCES student_accounts(id),
 FOREIGN KEY(reviewed_by) REFERENCES coordinator_accounts(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS notification_receipts (
 role VARCHAR(20) NOT NULL, account_id BIGINT NOT NULL, event_id CHAR(64) NOT NULL,
 read_at DATETIME NOT NULL, PRIMARY KEY(role,account_id,event_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS audit_events (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, class_code VARCHAR(100) NOT NULL,
 actor_role VARCHAR(20) NOT NULL, actor_id BIGINT NOT NULL, subject_id BIGINT NOT NULL,
 resource_id VARCHAR(64) NOT NULL, action VARCHAR(200) NOT NULL, status VARCHAR(30) NOT NULL,
 created_at DATETIME NOT NULL, INDEX audit_batch_id (class_code,id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS vault_letters (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, company_id BIGINT NOT NULL, student_id BIGINT NOT NULL,
 kind VARCHAR(20) NOT NULL, payload JSON NOT NULL, history JSON NOT NULL,
 owner_role VARCHAR(20) NOT NULL, owner_id BIGINT NOT NULL, version INT NOT NULL,
 updated_at DATETIME NOT NULL, UNIQUE KEY student_company_letter(company_id,student_id,kind),
 FOREIGN KEY(company_id) REFERENCES companies(id), FOREIGN KEY(student_id) REFERENCES student_accounts(id)
) ENGINE=InnoDB;
