"""Interactive Windows MySQL80 recovery. Run locally as Administrator.

Passwords are prompted, never supplied in arguments, printed, or committed.
The init file and console log live in a temporary directory with restricted ACLs.
"""
import csv
import ctypes
import getpass
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import mysql.connector


MYSQLD = Path(r'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe')
CONFIG = Path(r'C:\ProgramData\MySQL\MySQL Server 8.0\my.ini')
SERVICE = 'MySQL80'


def run(*args):
    return subprocess.run(args, capture_output=True, text=True, check=True)


def service_state():
    output = run('sc.exe', 'query', SERVICE).stdout
    match = re.search(r'STATE\s*:\s*(\d+)', output)
    if not match:
        raise RuntimeError('Cannot determine MySQL80 service state.')
    return int(match.group(1))


def wait_service(state):
    for _ in range(60):
        if service_state() == state:
            return
        time.sleep(1)
    raise RuntimeError('MySQL80 did not reach the expected service state.')


def connect(password):
    return mysql.connector.connect(host='127.0.0.1', port=3306, user='root',
                                   password=password, connection_timeout=3)


def identity(connection):
    cursor = connection.cursor()
    cursor.execute('SELECT @@server_uuid, @@datadir')
    result = cursor.fetchone()
    cursor.close()
    return result


def main():
    if not ctypes.windll.shell32.IsUserAnAdmin():
        raise RuntimeError('Open PowerShell as Administrator, then run this script again.')
    if not MYSQLD.is_file() or not CONFIG.is_file():
        raise RuntimeError('The expected MySQL executable or configuration is missing.')
    config = run('sc.exe', 'qc', SERVICE).stdout
    if str(CONFIG).lower() not in config.lower() or str(MYSQLD).lower() not in config.lower():
        raise RuntimeError('MySQL80 uses a different configuration. No changes made.')
    if service_state() != 4:
        raise RuntimeError('MySQL80 must be running before recovery begins.')

    print('This changes root@localhost on your local MySQL80 server and briefly restarts it.')
    password = getpass.getpass('New MySQL root password: ')
    confirmation = getpass.getpass('Enter the SAME new password again: ')
    if password != confirmation:
        raise RuntimeError('Passwords differ. No changes made; run the script again.')
    if (len(password) < 12 or not all(32 <= ord(c) <= 126 for c in password)
            or not all(re.search(p, password) for p in (r'[A-Z]', r'[a-z]', r'[0-9]', r'[^A-Za-z0-9]'))):
        raise RuntimeError('Use 12+ printable ASCII characters with uppercase, lowercase, a number and a symbol. No changes made.')

    folder = Path(tempfile.mkdtemp(prefix='internconnect-mysql-'))
    process = None
    stopped = False
    server_identity = None
    try:
        sid = next(csv.reader(run('whoami.exe', '/user', '/fo', 'csv', '/nh').stdout.splitlines()))[1]
        run('icacls.exe', str(folder), '/inheritance:r', '/grant:r',
            f'*{sid}:(OI)(CI)F', '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F')
        init_file = folder / 'reset.sql'
        escaped = password.replace('\\', '\\\\').replace("'", "''")
        init_file.write_text("SET SESSION sql_mode = '';\n"
                             f"ALTER USER 'root'@'localhost' IDENTIFIED BY '{escaped}';\n", encoding='ascii')
        print('Stopping MySQL80...')
        run('sc.exe', 'stop', SERVICE)
        stopped = True
        wait_service(1)
        with (folder / 'startup.log').open('w', encoding='utf-8') as log:
            process = subprocess.Popen([str(MYSQLD), f'--defaults-file={CONFIG}',
                                        f'--init-file={init_file.as_posix()}', '--console'],
                                       stdout=log, stderr=subprocess.STDOUT,
                                       creationflags=subprocess.CREATE_NO_WINDOW)
            print('Applying the reset and checking the exact captured password...')
            last_error = None
            for _ in range(45):
                if process.poll() is not None:
                    raise RuntimeError('Temporary MySQL server exited before login could be verified.')
                try:
                    connection = connect(password)
                except mysql.connector.Error as error:
                    last_error = error.errno
                    time.sleep(1)
                    continue
                try:
                    server_identity = identity(connection)
                    print('Temporary server: login verified.')
                    cursor = connection.cursor()
                    cursor.execute('SHUTDOWN')
                    cursor.close()
                finally:
                    connection.close()
                process.wait(timeout=60)
                break
            else:
                raise RuntimeError(f'Reset login was not verified. MySQL error code: {last_error}.')
    finally:
        # Only terminate the process tree started by this helper, if still alive.
        if process is not None and process.poll() is None:
            run('taskkill.exe', '/PID', str(process.pid), '/T', '/F')
            process.wait(timeout=30)
        # Remove the temporary plaintext password before restarting the service.
        shutil.rmtree(folder)
        if stopped:
            wait_service(1)
            print('Restoring MySQL80...')
            run('sc.exe', 'start', SERVICE)
            wait_service(4)

    connection = connect(password)
    try:
        if identity(connection) != server_identity:
            raise RuntimeError('Service is using a different database instance from the recovery server.')
    finally:
        connection.close()
    print('SUCCESS: the new password works on the normal MySQL80 service. Temporary files removed.')


if __name__ == '__main__':
    try:
        main()
    except mysql.connector.Error as error:
        print(f'MySQL login failed (code {error.errno}). Recovery is NOT confirmed.')
        raise SystemExit(1)
    except (RuntimeError, OSError, subprocess.SubprocessError) as error:
        print(f'Recovery stopped: {error}')
        raise SystemExit(1)
