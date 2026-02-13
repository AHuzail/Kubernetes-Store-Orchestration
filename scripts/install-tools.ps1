$ErrorActionPreference = "Stop"

# Force TLS 1.2+
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

$binDir = Join-Path $PSScriptRoot "bin"
if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir | Out-Null
}

Write-Host "Installing tools to $binDir..."

function Download-File-Robust {
    param([string]$Url, [string]$Output)
    
    Write-Host "Downloading $Url..."
    try {
        # Use HttpClient which handles redirects and headers better than WebClient
        $assembly = [System.Reflection.Assembly]::LoadWithPartialName("System.Net.Http")
        $client = New-Object System.Net.Http.HttpClient
        $client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        
        $task = $client.GetByteArrayAsync($Url)
        $task.Wait()
        $bytes = $task.Result
        
        [System.IO.File]::WriteAllBytes($Output, $bytes)
        Write-Host "  -> Saved to $Output"
    } catch {
        Write-Error "Failed to download. Error: $_"
        exit 1
    }
}

# 1. Install Kind (Direct link to latest binary)
$kindUrl = "https://github.com/kubernetes-sigs/kind/releases/download/v0.22.0/kind-windows-amd64.exe"
$kindPath = Join-Path $binDir "kind.exe"
if (-not (Test-Path $kindPath)) {
    Download-File-Robust -Url $kindUrl -Output $kindPath
}

# 2. Install Kubectl (Standard K8s DL)
$kubectlUrl = "https://dl.k8s.io/release/v1.29.2/bin/windows/amd64/kubectl.exe"
$kubectlPath = Join-Path $binDir "kubectl.exe"
if (-not (Test-Path $kubectlPath)) {
    Download-File-Robust -Url $kubectlUrl -Output $kubectlPath
}

# 3. Install Helm (Official Get Helm)
$helmUrl = "https://get.helm.sh/helm-v3.14.2-windows-amd64.zip"
$helmZipPath = Join-Path $binDir "helm.zip"
$helmExePath = Join-Path $binDir "helm.exe"

if (-not (Test-Path $helmExePath)) {
    Download-File-Robust -Url $helmUrl -Output $helmZipPath
    
    Write-Host "Extracting Helm..."
    Expand-Archive -Path $helmZipPath -DestinationPath $binDir -Force
    
    $extractedHelm = Join-Path $binDir "windows-amd64\helm.exe"
    if (Test-Path $extractedHelm) {
        Move-Item -Path $extractedHelm -Destination $helmExePath -Force
    }
    
    # Clean up
    if (Test-Path $helmZipPath) { Remove-Item $helmZipPath }
    if (Test-Path (Join-Path $binDir "windows-amd64")) { Remove-Item (Join-Path $binDir "windows-amd64") -Recurse -Force }
}

# Verification
$env:PATH = "$binDir;$env:PATH"
Write-Host "`n--- Verification ---"
try {
    & "$binDir\kind.exe" --version
    & "$binDir\kubectl.exe" version --client
    & "$binDir\helm.exe" version --short
} catch {
    Write-Warning "Could not verify tools. Check the bin directory."
}

Write-Host "`nSUCCESS! Copy and run this command:" -ForegroundColor Green
Write-Host '$env:PATH = "' + $binDir + ';$env:PATH"' -ForegroundColor Cyan
