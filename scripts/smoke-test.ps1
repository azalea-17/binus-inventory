# ==============================================================================
# BINUS INVENTORY - AUTOMATED SMOKE TEST SUITE (POWERSHELL)
# Skenario Pengujian Otomatis Live Demo UTS Cloud Services
# ==============================================================================

param (
    [string]$BaseUrl = "http://127.0.0.1:8080"
)

$passed = 0
$failed = 0

function Assert-Test {
    param (
        [string]$TestName,
        [bool]$Condition,
        [string]$Details = ""
    )
    if ($Condition) {
        Write-Host " [PASS] $TestName" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host " [FAIL] $TestName" -ForegroundColor Red
        if ($Details) {
            Write-Host "        Details: $Details" -ForegroundColor Yellow
        }
        $script:failed++
    }
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " MEMULAI AUTOMATED SMOKE TEST: $BaseUrl" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Gateway Healthcheck (/health)
try {
    $res = Invoke-WebRequest -Uri "$BaseUrl/health" -Method Get -TimeoutSec 5 -UseBasicParsing
    Assert-Test -TestName "1. Nginx Reverse Proxy Gateway (/health)" -Condition ($res.StatusCode -eq 200 -and $res.Content -match "ok")
} catch {
    Assert-Test -TestName "1. Nginx Reverse Proxy Gateway (/health)" -Condition $false -Details $_.Exception.Message
}

# 2. Frontend HTML Route (/)
try {
    $res = Invoke-WebRequest -Uri "$BaseUrl/" -Method Get -TimeoutSec 5 -UseBasicParsing
    Assert-Test -TestName "2. Frontend UI Availability (/)" -Condition ($res.StatusCode -eq 200 -and $res.Content -like "*BINUS Inventory*")
} catch {
    Assert-Test -TestName "2. Frontend UI Availability (/)" -Condition $false -Details $_.Exception.Message
}

# 3. Backend & PostgreSQL Health (/api/health)
try {
    $res = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get -TimeoutSec 5
    Assert-Test -TestName "3. Backend API & PostgreSQL Health (/api/health)" -Condition ($res.status -eq "ok" -and $res.database -eq "connected")
} catch {
    Assert-Test -TestName "3. Backend API & PostgreSQL Health (/api/health)" -Condition $false -Details $_.Exception.Message
}

# 4. Fetch All Items (GET /api/items)
try {
    $res = Invoke-RestMethod -Uri "$BaseUrl/api/items" -Method Get -TimeoutSec 5
    Assert-Test -TestName "4. GET /api/items (Daftar inventaris)" -Condition ($res -is [System.Array])
} catch {
    Assert-Test -TestName "4. GET /api/items (Daftar inventaris)" -Condition $false -Details $_.Exception.Message
}

# 5. Strict Input Validation (Tolak payload tidak valid dengan HTTP 400)
try {
    $invalidBody = @{
        name = "X"
        code = "invalid code with spaces!"
        category = "KategoriPalsu"
        location = ""
        quantity = -10
        status = "unknown_status"
    } | ConvertTo-Json

    $res = Invoke-RestMethod -Uri "$BaseUrl/api/items" -Method Post -Body $invalidBody -ContentType "application/json" -TimeoutSec 5
    Assert-Test -TestName "5. Strict Input Validation (Menolak data invalid)" -Condition $false -Details "Server menerima payload tidak valid"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Assert-Test -TestName "5. Strict Input Validation (Berhasil tolak data invalid dengan HTTP 400)" -Condition ($statusCode -eq 400) -Details "Status code: $statusCode"
}

# 6. Valid CRUD Flow: Tambah Barang Baru (POST /api/items)
$createdId = $null
$randomCode = "TEST-" + (Get-Random -Minimum 1000 -Maximum 9999)
try {
    $validBody = @{
        name = "Multimeter Uji Smoke Test"
        code = $randomCode
        category = "Laboratorium"
        location = "Lab IoT Rak 3"
        quantity = 5
        status = "available"
    } | ConvertTo-Json

    $res = Invoke-RestMethod -Uri "$BaseUrl/api/items" -Method Post -Body $validBody -ContentType "application/json" -TimeoutSec 5
    $createdId = $res.id
    Assert-Test -TestName "6. POST /api/items (Tambah barang baru valid - HTTP 201)" -Condition ($createdId -ne $null -and $res.code -eq $randomCode)
} catch {
    Assert-Test -TestName "6. POST /api/items (Tambah barang baru valid - HTTP 201)" -Condition $false -Details $_.Exception.Message
}

# 7. Valid CRUD Flow: Update Barang (PUT /api/items/:id)
if ($createdId) {
    try {
        $updateBody = @{
            name = "Multimeter Uji Smoke Test (Updated)"
            code = $randomCode
            category = "Laboratorium"
            location = "Lab IoT Rak 3 (Pindah Meja)"
            quantity = 8
            status = "borrowed"
        } | ConvertTo-Json

        $res = Invoke-RestMethod -Uri "$BaseUrl/api/items/$createdId" -Method Put -Body $updateBody -ContentType "application/json" -TimeoutSec 5
        Assert-Test -TestName "7. PUT /api/items/$createdId (Perbarui barang - HTTP 200)" -Condition ($res.quantity -eq 8 -and $res.status -eq "borrowed")
    } catch {
        Assert-Test -TestName "7. PUT /api/items/$createdId (Perbarui barang - HTTP 200)" -Condition $false -Details $_.Exception.Message
    }

    # 8. Valid CRUD Flow: Hapus Barang (DELETE /api/items/:id)
    try {
        $res = Invoke-WebRequest -Uri "$BaseUrl/api/items/$createdId" -Method Delete -TimeoutSec 5 -UseBasicParsing
        Assert-Test -TestName "8. DELETE /api/items/$createdId (Hapus barang - HTTP 204)" -Condition ($res.StatusCode -eq 204)
    } catch {
        Assert-Test -TestName "8. DELETE /api/items/$createdId (Hapus barang - HTTP 204)" -Condition $false -Details $_.Exception.Message
    }
}

Write-Host "=================================================================" -ForegroundColor Cyan
$summaryColor = if ($failed -eq 0) { "Green" } else { "Red" }
Write-Host " HASIL SMOKE TEST: Sukses: $passed | Gagal: $failed" -ForegroundColor $summaryColor
Write-Host "=================================================================" -ForegroundColor Cyan

if ($failed -gt 0) { exit 1 } else { exit 0 }
