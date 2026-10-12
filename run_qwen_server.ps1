# run_qwen_server.ps1 - equivalente Windows di run_qwen_server.sh
# Avvia ricerca web (8091), archivio locale (8092) e llama-server (8080).
# Uso: powershell -ExecutionPolicy Bypass -File run_qwen_server.ps1 [argomenti extra per llama-server]
$ErrorActionPreference = 'Stop'
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Cerca il binario nelle posizioni tipiche di CMake su Windows
$Bin = @(
    "$Dir\llama.cpp\build\bin\Release\llama-server.exe",
    "$Dir\llama.cpp\build\bin\llama-server.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Bin) { Write-Host "Errore: llama-server.exe non trovato. Compila llama.cpp (vedi README)."; exit 1 }
if (-not (Test-Path "$Dir\Qwen3-4B-Q4_K_M.gguf") -and -not (Test-Path "$Dir\Qwen3-1.7B-Q4_K_M.gguf")) {
    Write-Host "Errore: nessun modello .gguf trovato in $Dir"; exit 1
}

# Python (py launcher o python)
$Py = @('py', 'python') | Where-Object { Get-Command $_ -ErrorAction SilentlyContinue } | Select-Object -First 1

$Helpers = @()
if ($Py) {
    foreach ($s in 'search_server.py', 'store_server.py') {
        if (Test-Path "$Dir\$s") {
            $Helpers += Start-Process -FilePath $Py -ArgumentList "`"$Dir\$s`"" -WindowStyle Hidden -PassThru
        }
    }
} else {
    Write-Host "Python non trovato: ricerca web e archivio su file disattivati."
}

# -t: core fisici (metà dei logici, minimo 2)
$Threads = [Math]::Max(2, [int]((Get-CimInstance Win32_Processor | Measure-Object NumberOfCores -Sum).Sum))

Write-Host "Avvio server su http://127.0.0.1:8080 (Ctrl+C per fermare)"
try {
    & $Bin --models-dir $Dir --models-max 1 -ngl 0 -c 4096 -t $Threads --reasoning off --reasoning-budget 0 `
        --no-mmproj-offload -fa on --cache-type-k q8_0 --cache-type-v q8_0 --cache-ram 1024 `
        --sleep-idle-seconds 600 --host 127.0.0.1 --port 8080 @args
} finally {
    $Helpers | ForEach-Object { if ($_ -and -not $_.HasExited) { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } }
}
