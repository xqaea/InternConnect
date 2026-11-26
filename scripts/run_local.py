"""Keep local website and APIs in one terminal; stop children together on exit."""
from pathlib import Path
import socket
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
SERVICES = (
    ('Website', 5500, ['-m', 'http.server', '5500', '--bind', '127.0.0.1']),
    ('Account API', 8001, ['-m', 'uvicorn', 'main:app', '--app-dir', 'app-service', '--host', '127.0.0.1', '--port', '8001']),
    ('AI API', 8000, ['-m', 'uvicorn', 'main:app', '--app-dir', 'ai-service', '--host', '127.0.0.1', '--port', '8000']),
)


def main():
    # Refuse occupied ports instead of killing an existing service or starting half a stack.
    for name, port, _ in SERVICES:
        try:
            with socket.socket() as probe:
                probe.bind(('127.0.0.1', port))
        except OSError:
            print(f'{name} port {port} is already in use. Stop the existing server before starting this launcher.', flush=True)
            return 1
    processes = []
    try:
        for name, _, args in SERVICES:
            processes.append((name, subprocess.Popen([sys.executable, '-B', *args], cwd=ROOT)))
        print('Starting InternConnect. Open http://127.0.0.1:5500/pages/auth/login.html after the APIs report ready.\nKeep this window open. Press Ctrl+C to stop all three services.', flush=True)
        while True:
            for name, process in processes:
                if process.poll() is not None:
                    print(f'{name} stopped (exit {process.returncode}). Stopping the other services.', flush=True)
                    return 1
            time.sleep(0.5)
    except KeyboardInterrupt:
        return 0
    finally:
        for _, process in processes:
            if process.poll() is None:
                process.terminate()
        for _, process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == '__main__':
    raise SystemExit(main())
