param(
    [Parameter(Mandatory = $true)]
    [string]$Namespace,

    [Parameter(Mandatory = $true)]
    [string]$Release,

    [Parameter(Mandatory = $true)]
    [string]$StoreHost
)

function Decode-SecretValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Base64Value
    )

    return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Base64Value))
}

Write-Host "Fetching admin credentials for release '$Release' in namespace '$Namespace'..." -ForegroundColor Cyan

$secretNames = kubectl get secret -n $Namespace -l "app.kubernetes.io/instance=$Release" -o jsonpath='{.items[*].metadata.name}'
$secretName = $secretNames.Split(' ') | Where-Object { $_ -like '*-secret' } | Select-Object -First 1

if (-not $secretName) {
    Write-Host "No matching secret found for release '$Release'." -ForegroundColor Red
    exit 1
}

$adminUserB64 = kubectl get secret -n $Namespace $secretName -o jsonpath='{.data.wp-admin-user}'
$adminPassB64 = kubectl get secret -n $Namespace $secretName -o jsonpath='{.data.wp-admin-password}'

$adminUser = Decode-SecretValue -Base64Value $adminUserB64
$adminPass = Decode-SecretValue -Base64Value $adminPassB64

$storeUrl = "http://$StoreHost"
$adminUrl = "http://$StoreHost/wp-admin"

Write-Host "Storefront: $storeUrl" -ForegroundColor Green
Write-Host "Admin:      $adminUrl" -ForegroundColor Green
Write-Host "Admin user: $adminUser" -ForegroundColor Yellow
Write-Host "Admin pass: $adminPass" -ForegroundColor Yellow

Write-Host "\nBasic HTTP checks..." -ForegroundColor Cyan
try {
    $storeResponse = Invoke-WebRequest -Uri $storeUrl -UseBasicParsing -TimeoutSec 15
    Write-Host "Storefront status: $($storeResponse.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Storefront check failed: $($_.Exception.Message)" -ForegroundColor Red
}

try {
    $adminResponse = Invoke-WebRequest -Uri $adminUrl -UseBasicParsing -TimeoutSec 15
    Write-Host "Admin status:      $($adminResponse.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Admin check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "\nManual DoD verification:" -ForegroundColor Cyan
Write-Host "1) Open the storefront URL." -ForegroundColor White
Write-Host "2) Add the sample product to cart." -ForegroundColor White
Write-Host "3) Go to checkout and select Cash on Delivery." -ForegroundColor White
Write-Host "4) Place the order and confirm success." -ForegroundColor White
Write-Host "5) Open the admin URL, log in, and verify the order in WooCommerce > Orders." -ForegroundColor White
