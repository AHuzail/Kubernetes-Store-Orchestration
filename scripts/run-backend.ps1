# Check if python is installed
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Error: 'python' is not installed." -ForegroundColor Red
    exit 1
}

# Create venv if not exists
if (-not (Test-Path "venv")) {
    python -m venv venv
}

# Activate venv
.\venv\Scripts\Activate.ps1

# Install requirements
pip install -r src/backend/requirements.txt

# Run backend with admin credentials enabled
$env:ALLOW_ADMIN_CREDS = "true"
$env:HELM_TIMEOUT = "15m"
uvicorn src.backend.main:app --reload --host 0.0.0.0 --port 8000
