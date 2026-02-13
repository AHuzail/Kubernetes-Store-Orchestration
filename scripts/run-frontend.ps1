# Check if npm is installed
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "Error: 'npm' is not installed." -ForegroundColor Red
    exit 1
}

cd src/frontend
npm install
npm run dev
