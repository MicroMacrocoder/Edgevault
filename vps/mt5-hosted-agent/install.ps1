$ErrorActionPreference = "Stop"
$AgentDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$SlotRoot = "C:\EdgeVaultMT5"
$SlotNames = @("Slot01")

foreach ($SlotName in $SlotNames) {
    $SlotPath = Join-Path $SlotRoot $SlotName
    $TerminalPath = Join-Path $SlotPath "terminal64.exe"
    $MetaEditorPath = Join-Path $SlotPath "metaeditor64.exe"
    $ExpertsPath = Join-Path $SlotPath "MQL5\Experts"
    $BridgeSource = Join-Path $ExpertsPath "EdgeVaultBridge.mq5"
    $CompileLog = Join-Path $AgentDirectory "compile-$SlotName.log"
    if (-not (Test-Path $TerminalPath)) { throw "Missing MT5 terminal: $TerminalPath" }
    if (-not (Test-Path $MetaEditorPath)) { throw "Missing MetaEditor: $MetaEditorPath" }
    New-Item -ItemType Directory -Path $ExpertsPath -Force | Out-Null
    Copy-Item (Join-Path $AgentDirectory "EdgeVaultBridge.mq5") $BridgeSource -Force
    $CompiledBridge = Join-Path $ExpertsPath "EdgeVaultBridge.ex5"
    Remove-Item $CompiledBridge -Force -ErrorAction SilentlyContinue
    Start-Process -FilePath $MetaEditorPath -ArgumentList "/compile:$BridgeSource", "/log:$CompileLog" -Wait | Out-Null
    if (-not (Test-Path $CompiledBridge)) { throw "Bridge compilation failed. Read $CompileLog" }
}

python -m pip install -r (Join-Path $AgentDirectory "requirements.txt")
$EnvPath = Join-Path $AgentDirectory ".env"
if (-not (Test-Path $EnvPath)) {
    Copy-Item (Join-Path $AgentDirectory ".env.example") $EnvPath
    Write-Host "Created $EnvPath. Add the existing Vercel MT5 worker secret before starting the worker." -ForegroundColor Yellow
}
Write-Host "EdgeVault terminal bridge installed successfully." -ForegroundColor Green