"""Exercise HTTP auth/validation/outage contracts without touching a database."""
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


def main():
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    env = dict(os.environ)
    env.pop('IC_DB_USER', None)
    process = subprocess.Popen(
        [sys.executable, '-B', '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', str(port)],
        cwd=Path(__file__).resolve().parent, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    base = f'http://127.0.0.1:{port}'

    def call(path, method='GET', headers=None):
        try:
            with urlopen(Request(base + path, method=method, headers=headers or {}), timeout=2) as response:
                return response.status, response.headers, response.read()
        except HTTPError as error:
            return error.code, error.headers, error.read()

    try:
        for _ in range(100):
            try:
                call('/health')
                break
            except URLError:
                time.sleep(0.2)
        else:
            raise RuntimeError('Test API failed to start.')
        for method, path, expected in [
            ('GET', '/api/partner/postings', 401), ('POST', '/api/partner/postings', 401),
            ('GET', '/api/postings', 422), ('GET', '/health', 503),
            ('GET', '/api/auth/student/me', 401), ('PUT', '/api/student/resume', 401),
            ('PUT', '/api/student/profile/photo', 401),
            ('GET', '/api/student/applications', 401), ('POST', '/api/student/applications', 401),
            ('GET', '/api/partner/applications', 401), ('GET', '/api/coordinator/applications', 401),
            ('PUT', '/api/partner/applications/1', 401),
            ('GET', '/api/student/placements', 401), ('GET', '/api/partner/placements', 401),
            ('GET', '/api/coordinator/placements', 401),
            ('POST', '/api/coordinator/applications/1/deployment', 401),
            ('GET', '/api/student/attendance', 401), ('POST', '/api/student/attendance/clock', 401),
            ('GET', '/api/coordinator/attendance', 401), ('GET', '/api/partner/attendance', 401),
            ('PUT', '/api/coordinator/attendance/review', 401), ('PUT', '/api/student/attendance/explanation', 401),
            ('GET', '/api/student/tasks', 401), ('GET', '/api/coordinator/tasks', 401),
            ('POST', '/api/coordinator/tasks', 401), ('PUT', '/api/coordinator/tasks/test', 401),
            ('DELETE', '/api/coordinator/tasks/test', 401),
            ('GET', '/api/student/reports', 401), ('GET', '/api/coordinator/reports', 401),
            ('POST', '/api/student/tasks/test/report', 401), ('PUT', '/api/coordinator/tasks/test/report', 401),
        ]:
            status, _, body = call(path, method)
            assert status == expected, (path, status, body)
            print(method, path, status)
        status, headers, _ = call('/api/partner/postings', 'OPTIONS', {
            'Origin': 'http://127.0.0.1:5500', 'Access-Control-Request-Method': 'PUT',
            'Access-Control-Request-Headers': 'authorization,content-type'})
        assert status == 200 and headers['access-control-allow-origin'] == 'http://127.0.0.1:5500'
        print('Browser CORS preflight passed.')
    finally:
        process.terminate()
        process.wait(timeout=10)


if __name__ == '__main__':
    main()
