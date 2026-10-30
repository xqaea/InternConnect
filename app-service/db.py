from contextlib import contextmanager
import os
import re
import mysql.connector


def settings():
    user = os.getenv('IC_DB_USER')
    if not user:
        raise RuntimeError('Set IC_DB_USER and IC_DB_PASSWORD before starting the app API.')
    name = os.getenv('IC_DB_NAME', 'internconnect')
    if not re.fullmatch(r'[a-zA-Z0-9_]+', name):
        raise RuntimeError('IC_DB_NAME must contain only letters, digits and underscores.')
    return dict(host=os.getenv('IC_DB_HOST', '127.0.0.1'), port=int(os.getenv('IC_DB_PORT', '3306')),
                user=user, password=os.getenv('IC_DB_PASSWORD', ''), database=name, connection_timeout=5)


@contextmanager
def database():
    connection = mysql.connector.connect(**settings())
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
