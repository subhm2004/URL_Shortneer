# Self-host Trunc with one command. Auto-creates .env and JWT_SECRET on first run.
# Usage: .\up.ps1

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example"
}

$envContent = Get-Content ".env" -Raw
$needsSecret = $true
if ($envContent -match "(?m)^JWT_SECRET=(.+)$") {
    if ($Matches[1].Trim().Length -gt 0) { $needsSecret = $false }
}

if ($needsSecret) {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::Create()
    $rng.GetBytes($bytes)
    $secret = -join ($bytes | ForEach-Object { $_.ToString("x2") })
    $rng.Dispose()

    if ($envContent -match "(?m)^JWT_SECRET=.*$") {
        $envContent = [regex]::Replace($envContent, "(?m)^JWT_SECRET=.*$", "JWT_SECRET=$secret")
    } else {
        if (-not $envContent.EndsWith([Environment]::NewLine)) { $envContent += [Environment]::NewLine }
        $envContent += "JWT_SECRET=$secret" + [Environment]::NewLine
    }
    [System.IO.File]::WriteAllText((Resolve-Path ".env"), $envContent)
    Write-Host "Generated JWT_SECRET in .env"
}

docker compose up -d --build
if ($LASTEXITCODE -eq 0) {
    $publicUrl = (Select-String -Path ".env" -Pattern "^PUBLIC_BASE_URL=(.+)$").Matches[0].Groups[1].Value.Trim()
    $uiPort = (Select-String -Path ".env" -Pattern "^UI_PORT=(.+)$").Matches[0].Groups[1].Value.Trim()
    if ([string]::IsNullOrEmpty($publicUrl)) { $publicUrl = "http://localhost" }
    if ([string]::IsNullOrEmpty($uiPort)) { $uiPort = "80" }
    Write-Host ""
    Write-Host "Trunc is starting. UI will be at $publicUrl (host port $uiPort)."
    Write-Host "Follow logs with: docker compose logs -f"
}
