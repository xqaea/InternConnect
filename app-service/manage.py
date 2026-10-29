"""Server-side administration establishes company ownership."""
import argparse
from getpass import getpass
from pathlib import Path
import mysql.connector
from db import database, settings
from security import hash_password


def main():
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('init')
    batch = commands.add_parser('add-batch')
    for field in ('code', 'program', 'school'):
        batch.add_argument('--' + field, required=True)
    batch.add_argument('--theme', choices=['sky', 'emerald', 'rose'], default='sky')
    approve = commands.add_parser('approve-student')
    approve.add_argument('--email', required=True)
    assign = commands.add_parser('assign-batch')
    assign.add_argument('--email', required=True)
    assign.add_argument('--code', required=True)
    partner = commands.add_parser('add-partner')
    for field in ('email', 'name', 'company', 'batch'):
        partner.add_argument('--' + field, required=True)
    args = parser.parse_args()
    if args.command == 'init':
        config = settings()
        name = config.pop('database')
        with mysql.connector.connect(**config) as connection:
            connection.cursor().execute(f'CREATE DATABASE IF NOT EXISTS {name} CHARACTER SET utf8mb4')
        with database() as connection:
            cursor = connection.cursor()
            for statement in Path(__file__).with_name('schema.sql').read_text().split(';'):
                if statement.strip():
                    cursor.execute(statement)
        print('Database schema initialized successfully. Existing records preserved.')
        return
    if args.command == 'assign-batch':
        with database() as connection:
            cursor = connection.cursor(dictionary=True)
            cursor.execute('SELECT id,program FROM coordinator_accounts WHERE email=%s', (args.email.strip().lower(),))
            account = cursor.fetchone()
            cursor.execute('SELECT program FROM student_batches WHERE code=%s FOR UPDATE', (args.code.strip(),))
            batch = cursor.fetchone()
            if not account or not batch or account['program'] != batch['program']:
                raise SystemExit('Coordinator and batch must exist and have the same program.')
            cursor.execute('SELECT coordinator_id FROM coordinator_batches WHERE class_code=%s', (args.code.strip(),))
            owner = cursor.fetchone()
            if owner and owner['coordinator_id'] != account['id']:
                raise SystemExit('This batch already belongs to another coordinator. No changes made.')
            cursor.execute('INSERT INTO coordinator_batches (class_code,coordinator_id,created_at) VALUES (%s,%s,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE class_code=VALUES(class_code)', (args.code.strip(), account['id']))
        print('Batch assigned. Refresh the coordinator portal.')
        return
    if args.command == 'add-batch':
        if not all(value.strip() for value in (args.code, args.program, args.school)):
            raise SystemExit('Batch fields must not be empty.')
        with database() as connection:
            connection.cursor().execute('INSERT INTO student_batches (code,program,school,theme) VALUES (%s,%s,%s,%s) ON DUPLICATE KEY UPDATE code=VALUES(code)',
                                        (args.code.strip(), args.program.strip(), args.school.strip(), args.theme))
        print('Batch is registered. Existing batch settings are preserved.')
        return
    if args.command == 'approve-student':
        with database() as connection:
            cursor = connection.cursor()
            cursor.execute('SELECT status FROM student_accounts WHERE email=%s FOR UPDATE', (args.email.strip().lower(),))
            found = cursor.fetchone()
            if not found or found[0] not in ('pending', 'active'):
                raise SystemExit('No pending or active student found for this email.')
            cursor.execute("UPDATE student_accounts SET status='active' WHERE email=%s AND status='pending'", (args.email.strip().lower(),))
        print('Student approved. They can now sign in.')
        return
    password = getpass('Partner password (at least 12 characters): ')
    if len(password) < 12 or password != getpass('Confirm password: '):
        raise SystemExit('Passwords must match and contain at least 12 characters.')
    with database() as connection:
        cursor = connection.cursor()
        cursor.execute('INSERT INTO companies (name,class_code) VALUES (%s,%s) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)', (args.company.strip(), args.batch.strip()))
        company_id = cursor.lastrowid
        cursor.execute('INSERT INTO partner_accounts (email,name,password_hash,company_id) VALUES (%s,%s,%s,%s)', (args.email.strip().lower(), args.name.strip(), hash_password(password), company_id))
    print('Partner account created. Sign in through the existing Industry Partner login.')


if __name__ == '__main__':
    main()
