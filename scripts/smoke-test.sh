#!/usr/bin/env bash
# ==============================================================================
# BINUS INVENTORY - AUTOMATED SMOKE TEST SUITE (BASH / CURL)
# ==============================================================================

BASE_URL="${1:-http://localhost:8080}"
PASSED=0
FAILED=0

green() { echo -e "\033[32m [PASS] $1\033[0m"; ((PASSED++)); }
red() { echo -e "\033[31m [FAIL] $1 (Details: $2)\033[0m"; ((FAILED++)); }

echo "================================================================="
echo " MEMULAI AUTOMATED SMOKE TEST: $BASE_URL"
echo "================================================================="

# 1. Gateway Health (/health)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [ "$STATUS" -eq 200 ]; then green "1. Nginx Reverse Proxy Gateway (/health)"; else red "1. Nginx Gateway" "HTTP $STATUS"; fi

# 2. Frontend HTML Route (/)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$STATUS" -eq 200 ]; then green "2. Frontend UI Availability (/)"; else red "2. Frontend UI" "HTTP $STATUS"; fi

# 3. Backend & PostgreSQL Health (/api/health)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
if [ "$STATUS" -eq 200 ]; then green "3. Backend API & PostgreSQL Health (/api/health)"; else red "3. Backend API Health" "HTTP $STATUS"; fi

# 4. GET /api/items
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/items")
if [ "$STATUS" -eq 200 ]; then green "4. GET /api/items (Daftar inventaris)"; else red "4. GET /api/items" "HTTP $STATUS"; fi

# 5. Strict Input Validation (Expect 400 Bad Request)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/items" \
  -H "Content-Type: application/json" \
  -d '{"name":"X","code":"invalid code","category":"WrongCat","location":"","quantity":-5,"status":"none"}')
if [ "$STATUS" -eq 400 ]; then green "5. Strict Input Validation (Tolak data invalid dengan HTTP 400)"; else red "5. Strict Input Validation" "Expected 400 but got $STATUS"; fi

echo "================================================================="
echo " HASIL SMOKE TEST: Sukses: $PASSED | Gagal: $FAILED"
echo "================================================================="

if [ "$FAILED" -gt 0 ]; then exit 1; else exit 0; fi
