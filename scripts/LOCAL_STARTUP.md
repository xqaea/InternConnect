# Local startup on Windows

Stop any servers already running on ports 5500, 8000 and 8001. Keep the MySQL
Windows service running. From the repository root, run:

```powershell
.\start-local.cmd
```

The first run prompts for the MySQL username and password. Credentials are saved
in `.local/mysql-credential.xml` using Windows DPAPI encryption, tied to this
Windows user and computer. `.local/` is excluded from Git. Do not share the file.
To replace the credentials, run `start-local.cmd -ResetCredentials`.

The launcher starts the website (5500), account API (8001) and AI API (8000).
Keep its window open; Ctrl+C stops them together. It refuses occupied ports and
does not stop services started elsewhere. If one child exits, the others stop.
This launcher serves localhost only; it is for development on this computer.

Open http://127.0.0.1:5500/pages/auth/login.html after the services report ready.
The local model and O*NET files must already be installed for AI features.

For initial setup or a new schema update, use:

```powershell
.\start-local.cmd -InitDatabase
```

This initializes the schema before starting the services, using the saved
credentials. Daily startup does not initialize the database. A database error
stops startup. Initialization requires a user allowed to create the database and
tables; runtime accounts can use narrower permissions.

This does not configure automatic startup after Windows sign-in or production
hosting. It replaces the separate manual development commands with one launcher.
