# Multi-Tenant Store Provisioning Platform

A Kubernetes-native platform for provisioning isolated WooCommerce and Medusa storefronts on-demand with integrated guardrails and resource management.

## Quick Start

### Prerequisites

- **Windows 11/10** with PowerShell 7+
- **Docker Desktop** (with WSL 2 backend)
- **Kind** (Kubernetes in Docker) - Install: `go install sigs.k8s.io/kind@latest`
- **kubectl** - Install: `choco install kubernetes-cli`
- **Helm 3** - Install: `choco install kubernetes-helm`
- **Node.js 18+** - For frontend development
- **Python 3.11+** - For backend development
- **Git** - For version control

### Installation Steps

1. **Clone and navigate to workspace:**
   ```powershell
   cd Kubernetes-Store-Orchestration
   ```

2. **Install development dependencies:**
   ```powershell
   # Install backend dependencies
   cd src/backend
   pip install -r requirements.txt
   cd ../..
   
   # Install frontend dependencies
   cd src/frontend
   npm install
   cd ../..
   ```

3. **Set up local Kubernetes cluster:**
   ```powershell
   .\scripts\setup-local.ps1
   ```
   Wait for the script to complete (typically 2-3 minutes). This will:
   - Create a Kind cluster named `kind-1`
   - Install Nginx Ingress Controller
   - Wait for all components to be ready

4. **Verify cluster is ready:**
   ```powershell
   kubectl get nodes
   kubectl get pods -n ingress-nginx
   ```

5. **Start backend service:**
   ```powershell
   .\scripts\run-backend.ps1
   ```
   Backend will run on http://localhost:8000
   - API docs available at http://localhost:8000/docs
   - Health check: `curl http://localhost:8000/health`

6. **Start frontend service** (in a new PowerShell terminal):
   ```powershell
   .\scripts\run-frontend.ps1
   ```
   Frontend will run on http://localhost:5173

7. **Open dashboard:**
   Navigate to http://localhost:5173 in your browser

## Platform Architecture

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Backend** | FastAPI (Python 3.11) | REST API, Kubernetes orchestration, store lifecycle management |
| **Frontend** | React + Vite + TailwindCSS | Dashboard UI, real-time store status, admin interface |
| **Orchestration** | Kubernetes (Kind locally) | Container orchestration, namespace isolation |
| **Helm** | Helm 3 | Application deployment and configuration management |
| **WooCommerce** | WordPress + MariaDB 10.11 | E-commerce storefront and admin |
| **Medusa** | Medusa Backend + Storefront | Headless commerce platform (optional) |
| **Ingress** | Nginx | HTTP routing with per-store ingress rules |
| **Networking** | NetworkPolicy | Namespace isolation and egress control |
| **State** | SQLite | Backend store metadata persistence |

### Architecture Diagram

```
User Browser (http://localhost:5173)
    |
    | HTTP/WebSocket
    v
Frontend Dashboard (React + Vite)
    |
    | REST API (http://localhost:8000)
    v
Backend API (FastAPI)
    |
    +-----> Store Repository (SQLite)
    |
    +-----> Kubernetes API Client
            |
            +-----> Kind Cluster
                    |
                    +---- Nginx Ingress Controller
                    |
                    +---- Store Namespaces (one per store)
                         |
                         +---- WooCommerce Pods (WordPress + MariaDB)
                         |
                         +---- Medusa Pods (Backend + Storefront + Postgres + Redis)
                         |
                         +---- Guardrails (ResourceQuota, LimitRange)
                         |
                         +---- NetworkPolicy (isolation)
```

## Usage Guide

### Creating a Store

1. **Via Dashboard:**
   - Open http://localhost:5173
   - Enter store name (lowercase alphanumeric + hyphens only, e.g., `my-store`, `store-1`)
   - Select platform: **WooCommerce** or **Medusa**
   - Click "Create Store"
   - Status will update from PROVISIONING → READY (~8-10 minutes for WooCommerce)

2. **Via API:**
   ```powershell
   $body = @{
       name = "my-store"
       platform = "woocommerce"
   } | ConvertTo-Json
   
   Invoke-RestMethod -Method Post `
     -Uri "http://localhost:8000/api/v1/stores" `
     -ContentType "application/json" `
     -Body $body
   ```

### Accessing a Store

Once READY status is confirmed:

1. **WooCommerce Storefront:**
   - Dashboard shows ingress URL (e.g., `http://store-my-store-abc123.127.0.0.1.nip.io`)
   - Browse products (pre-loaded: Sample Hoodie, Mug, Sticker Pack)
   - Add to cart and checkout

2. **WooCommerce Admin Panel:**
   - URL: `http://store-my-store-abc123.127.0.0.1.nip.io/wp-admin`
   - Get credentials via API:
     ```powershell
     Invoke-RestMethod -Uri "http://localhost:8000/api/v1/stores/<store-id>/admin-credentials"
     ```
   - Or via dashboard click on store → "View Admin Credentials"

3. **Medusa Storefront** (if platform=medusa):
   - URL: `http://store-my-store-abc123.127.0.0.1.nip.io`
   - Note: Requires GHCR authentication credentials (see Production Deployment)

### Placing an Order (WooCommerce)

1. Open the store URL from the dashboard.
2. Add any sample product to the cart.
3. Proceed to checkout and submit the order (Cash on Delivery works for the demo).
4. Optional verification: log in to `/wp-admin` and confirm the order appears in **WooCommerce > Orders**.
5. For the full verification checklist, see **Manual Day-of-Demo** below.

### Deleting a Store

1. **Via Dashboard:**
   - Click store row → "Delete Store" button
   - Confirm deletion
   - All pods and namespace will be cleaned up

2. **Via API:**
   ```powershell
   Invoke-RestMethod -Method Delete `
     -Uri "http://localhost:8000/api/v1/stores/<store-id>"
   ```

### Monitoring Stores

**Check all stores:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/stores" | ConvertTo-Json
```

**Check specific store:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/stores/<store-id>"
```

**Watch Kubernetes namespace:**
```powershell
kubectl get all -n store-my-store-abc123 --watch
```

**View pod logs:**
```powershell
# WordPress pod logs
kubectl logs -n store-my-store-abc123 -l app=wordpress

# MariaDB pod logs
kubectl logs -n store-my-store-abc123 -l app=mysql

# Medusa backend logs (if applicable)
kubectl logs -n store-my-store-abc123 -l app=medusa-backend
```

### WooCommerce Full Checkout Flow

1. **Create a store** and wait for READY status
2. **Open storefront** (click ingress URL in dashboard)
3. **Add product to cart:**
   - Click on any product (e.g., "Sample Hoodie")
   - Select quantity and click "Add to cart"
   - Proceed to checkout
4. **Complete order:**
   - Enter customer details (name, email, address)
   - Accept default payment method (WooCommerce demo gateway)
   - Click "Place Order"
5. **Verify order in admin:**
   - Go to `/wp-admin`
   - Login with admin credentials (from dashboard or API)
   - Navigate to **Shop Orders**
   - Confirm new order appears with correct products and status
6. **Verify customer email received:**
   - Check the email address provided in checkout
   - Confirm order confirmation email arrived



## Troubleshooting

### Backend won't start

```powershell
# Check if port 8000 is in use
netstat -ano | findstr :8000

# Kill process if needed
Stop-Process -Id <PID> -Force

# Verify Python installation
python --version

# Check if dependencies installed
pip list | findstr fastapi
```

### Frontend won't start

```powershell
# Check if port 5173 is in use
netstat -ano | findstr :5173

# Verify Node.js installation
node --version

# Clear npm cache and reinstall
cd src/frontend
rm -r node_modules
npm install
npm run dev
```

### Kubernetes cluster issues

```powershell
# Check Kind cluster status
kind get clusters
docker ps | findstr kind

# Get cluster info
kubectl cluster-info

# Check nodes
kubectl get nodes

# Check all namespaces
kubectl get ns

# Delete and recreate cluster
kind delete cluster
.\scripts\setup-local.ps1
```

### Store stays in PROVISIONING status

```powershell
# Check backend logs for Helm timeout
# Terminal running backend

# Check pod status in namespace
kubectl get pods -n store-<store-name-hash>
kubectl describe pod -n store-<store-name-hash>

# Increase Helm timeout
$env:HELM_TIMEOUT = "20m"
.\scripts\run-backend.ps1
```

### WooCommerce sample products not showing

```powershell
# Check WordPress pod logs
kubectl logs -n store-<store-name-hash> -l app=wordpress

# If products failed to create, manually add via wp-cli:
kubectl exec -n store-<store-name-hash> <wordpress-pod> -- \
  wp product create --name="Sample Product" --type=simple --price=29.99
```

### Medusa image pull fails (GHCR authentication)

If Medusa pods show `ImagePullBackOff`:

1. **Create GitHub token with packages:read permission**
2. **Create Kubernetes secret in store namespace:**
   ```powershell
   kubectl create secret docker-registry ghcr-secret \
     -n store-<store-name-hash> \
     --docker-server=ghcr.io \
     --docker-username=<github-username> \
     --docker-password=<github-token> \
     --docker-email=<email>
   ```
3. **Update Medusa values to use secret** (modify `charts/medusa/values.yaml`)
4. **Redeploy store**

### Network connectivity issues

```powershell
# Test from local machine
curl -v http://store-my-store-abc123.127.0.0.1.nip.io

# Test from within pod
kubectl exec -n store-<store-name-hash> <pod> -- curl http://wordpress:80

# Check NetworkPolicy
kubectl get networkpolicy -n store-<store-name-hash>

# Describe policy
kubectl describe networkpolicy -n store-<store-name-hash>
```

## File Structure

```
Kubernetes-Store-Orchestration/
├── README.md                           # This file
├── charts/
│   ├── woocommerce/                   # WooCommerce Helm chart
│   │   ├── Chart.yaml
│   │   ├── values.yaml
│   │   └── templates/
│   │       ├── _helpers.tpl
│   │       ├── deployment.yaml
│   │       ├── mysql-deployment.yaml
│   │       ├── mysql-service.yaml
│   │       ├── mysql-pvc.yaml
│   │       ├── wordpress-deployment.yaml
│   │       ├── wordpress-service.yaml
│   │       ├── wordpress-pvc.yaml
│   │       ├── ingress.yaml
│   │       ├── networkpolicy.yaml
│   │       ├── secret.yaml
│   │       └── guardrails.yaml
│   └── medusa/                        # Medusa Helm chart
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/                 # Backend, storefront, DB, cache, etc.
├── src/
│   ├── backend/                       # FastAPI backend
│   │   ├── main.py                    # Entry point
│   │   ├── requirements.txt
│   │   └── app/
│   │       ├── adapters/
│   │       │   ├── helm_adapter.py    # Helm CLI wrapper
│   │       │   ├── k8s_adapter.py     # Kubernetes API client
│   │       │   └── store_repository.py # SQLite persistence
│   │       ├── api/
│   │       │   └── endpoints.py       # REST endpoints
│   │       ├── domain/
│   │       │   ├── models.py          # Pydantic models
│   │       │   └── ports.py           # Interface definitions
│   │       └── service/
│   │           └── store_service.py   # Business logic
│   └── frontend/                      # React + Vite
│       ├── index.html
│       ├── package.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── Dashboard.tsx          # Main UI component
│           ├── api.ts                 # API client
│           └── index.css
├── config/
│   ├── values-local.yaml              # Local Kind cluster values
│   └── values-prod.yaml               # Production k3s values
├── scripts/
│   ├── setup-local.ps1                # Initialize Kind cluster
│   ├── run-backend.ps1                # Start backend service
│   ├── run-frontend.ps1               # Start frontend service
│   ├── woocommerce-smoke-test.ps1     # Verify WooCommerce setup
│   ├── kind-config.yaml               # Kind cluster configuration
│   └── install-tools.ps1              # Install dependencies (optional)
└── docs/
    ├── TECHNICAL_OVERVIEW.md          # Architecture & design decisions
    ├── DEMO_VIDEO_SCRIPT.md           # Day-of-demo guide
    └── demo-evidence/                 # Screenshots/video evidence
        ├── 01-dashboard-store-creation.png
        ├── 02-woocommerce-storefront.png
        ├── 03-checkout-flow.png
        ├── 04-admin-panel-orders.png
        ├── 05-order-email.png
        └── demo-video.mp4
```

## Configuration

### Local Environment (`config/values-local.yaml`)

```yaml
# Used for Kind cluster deployments
ingress:
  className: nginx
  hostSuffix: ".127.0.0.1.nip.io"

guardrails:
  enabled: true

networkPolicy:
  enabled: true
  allowExternalEgress: true  # Allow external connections for initial setup
```

### Production Environment (`config/values-prod.yaml`)

```yaml
# Used for k3s VPS deployments
ingress:
  className: traefik
  hostSuffix: ".example.com"
  
storageClass: local-path
```

### WooCommerce Sample Products

Edit `charts/woocommerce/values.yaml`:

```yaml
wordpress:
  sampleProducts:
    - name: "Sample Hoodie"
      description: "Comfortable cotton hoodie"
      price: 49.99
      stock: 100
    - name: "Sample Mug"
      description: "11oz ceramic mug"
      price: 9.99
      stock: 500
    - name: "Sample Sticker Pack"
      description: "5-pack vinyl stickers"
      price: 4.99
      stock: 1000
```

### Helm Timeout Adjustment

For slower systems, increase Helm timeout:

```powershell
# Increase to 20 minutes
$env:HELM_TIMEOUT = "20m"
.\scripts\run-backend.ps1
```

## Cleanup & Reset

### Stop Services (Keep cluster)

```powershell
# Backend and Frontend will stop when you Ctrl+C the terminals
# To manually stop:
Stop-Process -Name python -ErrorAction SilentlyContinue
Stop-Process -Name node -ErrorAction SilentlyContinue
```

### Delete All Stores

```powershell
# Via API - delete each store
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/stores" | 
  ForEach-Object { 
    Invoke-RestMethod -Method Delete -Uri "http://localhost:8000/api/v1/stores/$($_.id)"
  }

# Or via kubectl - delete all store namespaces
kubectl delete ns -l app=store
```

### Reset Kubernetes Cluster (Clean Slate)

```powershell
# Delete entire cluster
kind delete cluster

# Recreate cluster
.\scripts\setup-local.ps1
```

### Full Reset (Everything)

```powershell
# Stop services
Stop-Process -Name python -ErrorAction SilentlyContinue
Stop-Process -Name node -ErrorAction SilentlyContinue

# Delete cluster
kind delete cluster

# Reset database
If (Test-Path "src/backend/stores.db") { Remove-Item "src/backend/stores.db" }

# Clear npm/python cache (optional)
cd src/frontend && rm -r node_modules && npm install && cd ../..
cd src/backend && pip install -r requirements.txt && cd ../..

# Recreate everything
.\scripts\setup-local.ps1
cd src/backend && .\scripts\run-backend.ps1
# In new terminal:
cd src/frontend && .\scripts\run-frontend.ps1
```

## Production Deployment

### Deploy to k3s VPS

1. **SSH into VPS and install k3s:**
   ```bash
   curl -sfL https://get.k3s.io | sh -
   ```

2. **Copy project to VPS:**
   ```bash
   scp -r . user@vps:/home/user/deep-lagoon
   ```

3. **Adjust domain in values:**
   Edit `config/values-prod.yaml`:
   ```yaml
   ingress:
     hostSuffix: ".yourdomain.com"
   ```

    Recommended production overrides:
    ```yaml
    ingress:
       className: traefik
       hostSuffix: ".yourdomain.com"
    persistence:
       storageClass: local-path
    guardrails:
       enabled: true
    networkPolicy:
       enabled: true
       allowExternalEgress: false
    ```

4. **Set provisioning environment:**
   ```bash
   export PROVISION_ENV=prod
   ```

5. **Deploy backend container:**
   ```bash
   # Build Docker image
   docker build -t deep-lagoon-backend:latest src/backend/
   
   # Push to registry or use local
   k3s ctr images pull <your-image>
   
   # Run as deployment
   kubectl apply -f- <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: deep-lagoon-backend
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: backend
     template:
       metadata:
         labels:
           app: backend
       spec:
         containers:
         - name: backend
           image: deep-lagoon-backend:latest
           ports:
           - containerPort: 8000
   EOF
   ```

6. **Configure DNS** for `*.yourdomain.com` → VPS IP

7. **Setup HTTPS** (e.g., with cert-manager):
   ```bash
   helm repo add jetstack https://charts.jetstack.io
   helm install cert-manager jetstack/cert-manager \
     --namespace cert-manager --create-namespace
   ```

8. **Serve the dashboard:**
   - Production: `npm run build` and serve `src/frontend/dist` with Nginx or a simple static server.
   - For demos: keep `npm run dev` and access the dashboard over SSH tunnel.

### Secrets Strategy (Production)

- Demo setup relies on Helm-generated Kubernetes secrets.
- Production should use sealed secrets, external secrets manager, or cluster-native secret encryption.

### Upgrade / Rollback (Helm)

- Each store is a Helm release in its own namespace. Updates are applied via `helm upgrade --install`.
- To roll back a specific store: `helm rollback <release> -n <namespace> <revision>`.
- For global changes, update `charts/*` or `config/values-prod.yaml` and re-run provisioning or upgrade per store.

## API Documentation

Backend REST API is self-documented via OpenAPI/Swagger:

- **Interactive Docs:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/stores` | Create new store (WooCommerce or Medusa) |
| GET | `/api/v1/stores` | List all stores |
| GET | `/api/v1/stores/{id}` | Get store details and status |
| GET | `/api/v1/stores/{id}/admin-credentials` | Get WooCommerce admin credentials |
| DELETE | `/api/v1/stores/{id}` | Delete store and all resources |
| GET | `/api/v1/audit-events` | List all provisioning events |

## Support & Documentation

- **Technical Architecture:** [docs/TECHNICAL_OVERVIEW.md](docs/TECHNICAL_OVERVIEW.md)
- **System Design & Tradeoffs:** [docs/SYSTEM_DESIGN_TRADEOFFS.md](docs/SYSTEM_DESIGN_TRADEOFFS.md)
- **Demo Script:** [docs/DEMO_VIDEO_SCRIPT.md](docs/DEMO_VIDEO_SCRIPT.md)
- **Kubernetes Docs:** https://kubernetes.io/docs/
- **Helm Docs:** https://helm.sh/docs/
- **WooCommerce API:** https://woocommerce.github.io/woocommerce-rest-api-docs/
- **Medusa Docs:** https://medusajs.com/development/

