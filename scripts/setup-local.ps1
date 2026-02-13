# Check if kind is installed
if (-not (Get-Command kind -ErrorAction SilentlyContinue)) {
    Write-Host "Error: 'kind' is not installed. Please install Kind." -ForegroundColor Red
    exit 1
}

# Check if docker is installed
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Error: 'docker' is not installed. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# Ensure Docker is running Linux containers (required for Kind)
try {
    $dockerOsType = docker info --format '{{.OSType}}' 2>$null
} catch {
    Write-Host "Error: Unable to query Docker. Is Docker Desktop running?" -ForegroundColor Red
    exit 1
}

if ($dockerOsType -ne "linux") {
    Write-Host "Error: Docker is running in Windows containers mode. Switch to Linux containers and re-run." -ForegroundColor Red
    exit 1
}

# Check if kubectl is installed
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    Write-Host "Error: 'kubectl' is not installed. Please install kubectl." -ForegroundColor Red
    exit 1
}

# Create Cluster
Write-Host "Creating Kind cluster 'store-orch'..."
kind create cluster --name store-orch --config ./scripts/kind-config.yaml

# Install Nginx Ingress
Write-Host "Installing Nginx Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Wait for Ingress to be ready
Write-Host "Waiting for Ingress Controller to be ready..."
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=90s

Write-Host "Cluster setup complete! Ingress is ready at localhost (80/443)." -ForegroundColor Green
