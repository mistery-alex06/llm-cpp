# banana_launcher.ps1 - avvia il server, apre Banana in una finestra dedicata (Edge o Chrome)
# e, alla chiusura della finestra, spegne il server. Equivalente di Banana.app per Windows.
$Dir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Url = 'http://127.0.0.1:8080'
$Log = Join-Path $env:TEMP 'banana.log'
$Started = $false

function Test-Server { try { Invoke-WebRequest "$Url/health" -UseBasicParsing -TimeoutSec 2 | Out-Null; $true } catch { $false } }

function Stop-Server {
    if ($script:Started) {
        Get-CimInstance Win32_Process | Where-Object { $_.Name -in 'llama-server.exe', 'python.exe', 'py.exe' -and ($_.CommandLine -match 'llama-server|search_server|store_server|actions_server') } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'run_qwen_server\.ps1' } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    }
}

if (-not (Test-Server)) {
    Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$Dir\run_qwen_server.ps1`"" `
        -RedirectStandardOutput $Log -RedirectStandardError "$Log.err" | Out-Null
    $Started = $true
    1..90 | ForEach-Object { if (-not (Test-Server)) { Start-Sleep 1 } }
}
if (-not (Test-Server)) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show("Il server non e' partito. Controlla $Log", 'Banana') | Out-Null
    Stop-Server; exit 1
}

# Browser: Edge (sempre presente) oppure Chrome; modalita' app = finestra senza barra
$Browsers = @(
    @{ n = 'msedge'; p = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" },
    @{ n = 'chrome'; p = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" },
    @{ n = 'chrome'; p = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" }
) | Where-Object { Test-Path $_.p }
$B = $Browsers | Select-Object -First 1
if (-not $B) { Start-Process $Url; Write-Host 'Nessun Edge/Chrome trovato: aperto il browser predefinito. Premi Invio per spegnere il server.'; Read-Host | Out-Null; Stop-Server; exit 0 }

Start-Process $B.p -ArgumentList "--app=$Url"

# Finestra di Banana = finestra del browser con "Banana" nel titolo
function Count-Windows { @(Get-Process $B.n -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match 'Banana|127\.0\.0\.1:8080|llama' }).Count }

$seen = $false
1..30 | ForEach-Object { if (-not $seen) { if ((Count-Windows) -gt 0) { $seen = $true } else { Start-Sleep 1 } } }
if (-not $seen) {
    # Titolo non riconosciuto: attesa manuale
    Write-Host 'Premi Invio per spegnere il server.'; Read-Host | Out-Null
} else {
    while ((Count-Windows) -gt 0) { Start-Sleep 3 }
}
Stop-Server
