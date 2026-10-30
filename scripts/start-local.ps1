param([switch]$InitDatabase, [switch]$ResetCredentials)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $projectRoot 'ai-service\.venv\Scripts\python.exe'
$credentialDirectory = Join-Path $projectRoot '.local'
$credentialPath = Join-Path $credentialDirectory 'mysql-credential.xml'
try {
    if (!(Test-Path -LiteralPath $pythonPath)) { throw 'The Python environment is missing. Set up ai-service/.venv first.' }
    Set-Location -LiteralPath $projectRoot
    if ($ResetCredentials -or !(Test-Path -LiteralPath $credentialPath)) {
        $databaseUser = Read-Host 'MySQL username (Enter for root)'
        if (!$databaseUser) { $databaseUser = 'root' }
        $databaseSecret = Read-Host 'MySQL password' -AsSecureString
        $credential = New-Object System.Management.Automation.PSCredential($databaseUser, $databaseSecret)
        New-Item -ItemType Directory -Path $credentialDirectory -Force | Out-Null
        # Export-Clixml uses Windows DPAPI: only this user on this PC can decrypt it.
        $credential | Export-Clixml -LiteralPath $credentialPath
    }
    $credential = Import-Clixml -LiteralPath $credentialPath
    $env:IC_DB_USER = $credential.UserName
    $env:IC_DB_PASSWORD = $credential.GetNetworkCredential().Password
    if ($InitDatabase) {
        & $pythonPath -B app-service/manage.py init
        if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed. Check the MySQL service and saved credentials.' }
    }
    & $pythonPath -B scripts/run_local.py
    if ($LASTEXITCODE -ne 0) { throw 'Local startup failed. See the service output above.' }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host 'To replace saved credentials: start-local.cmd -ResetCredentials'
    exit 1
} finally {
    Remove-Item Env:IC_DB_PASSWORD -ErrorAction SilentlyContinue
    $credential = $null
    $databaseSecret = $null
}
