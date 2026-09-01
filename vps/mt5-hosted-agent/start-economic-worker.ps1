$ErrorActionPreference = "Stop"
$AgentDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $AgentDirectory
python .\edgevault_economic_worker.py
