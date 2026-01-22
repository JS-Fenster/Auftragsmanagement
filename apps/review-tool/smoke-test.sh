#!/bin/bash
# =============================================================================
# Smoke Test for Review Tool API
# Usage: ./smoke-test.sh <INTERNAL_API_KEY> [--with-backfill]
# Version: 1.1.0 - 2026-01-21 (added learning loop tests)
# =============================================================================

set -e

API_KEY="${1:-}"
WITH_BACKFILL="${2:-}"
BASE_URL="https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/admin-review"

if [ -z "$API_KEY" ]; then
  echo "Usage: ./smoke-test.sh <INTERNAL_API_KEY> [--with-backfill]"
  echo "  INTERNAL_API_KEY: Your API key (will not be logged)"
  echo "  --with-backfill:  Run backfill for existing corrections"
  exit 1
fi

echo "=========================================="
echo "Review Tool API Smoke Test v1.1.0"
echo "=========================================="
echo ""

# Test 1: Health Check (no auth)
echo "[1/9] Health Check..."
HEALTH=$(curl -s "${BASE_URL}?health=1")
if echo "$HEALTH" | grep -q '"status":"ready"'; then
  echo "  OK: Service is ready"
  echo "  Version: $(echo "$HEALTH" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)"
else
  echo "  FAIL: Health check failed"
  echo "  Response: $HEALTH"
  exit 1
fi

# Test 2: Categories Endpoint
echo ""
echo "[2/9] GET /categories..."
CATEGORIES=$(curl -s -H "x-api-key: $API_KEY" "${BASE_URL}/categories")
if echo "$CATEGORIES" | grep -q '"email_kategorien"'; then
  EMAIL_CAT_COUNT=$(echo "$CATEGORIES" | grep -o '"email_kategorien":\[[^]]*\]' | tr ',' '\n' | wc -l)
  DOK_CAT_COUNT=$(echo "$CATEGORIES" | grep -o '"dokument_kategorien":\[[^]]*\]' | tr ',' '\n' | wc -l)
  echo "  OK: ${EMAIL_CAT_COUNT} Email-Kategorien, ${DOK_CAT_COUNT} Dokument-Kategorien"
else
  echo "  FAIL: Could not fetch categories"
  echo "  Response: $CATEGORIES"
  exit 1
fi

# Test 3: Stats Endpoint
echo ""
echo "[3/9] GET /stats..."
STATS=$(curl -s -H "x-api-key: $API_KEY" "${BASE_URL}/stats")
if echo "$STATS" | grep -q '"pending_reviews"'; then
  PENDING=$(echo "$STATS" | grep -o '"pending_reviews":[0-9]*' | cut -d':' -f2)
  ERRORS=$(echo "$STATS" | grep -o '"errors_total":[0-9]*' | cut -d':' -f2)
  echo "  OK: ${PENDING} pending reviews, ${ERRORS} errors"
else
  echo "  FAIL: Could not fetch stats"
  echo "  Response: $STATS"
  exit 1
fi

# Test 4: Queue Endpoint
echo ""
echo "[4/9] GET / (queue)..."
QUEUE=$(curl -s -H "x-api-key: $API_KEY" "${BASE_URL}?limit=5&status=all")
if echo "$QUEUE" | grep -q '"items"'; then
  COUNT=$(echo "$QUEUE" | grep -o '"count":[0-9]*' | cut -d':' -f2)
  echo "  OK: Queue returned ${COUNT} items (limited to 5)"
else
  echo "  FAIL: Could not fetch queue"
  echo "  Response: $QUEUE"
  exit 1
fi

# Test 5: Rule Suggestions Endpoint
echo ""
echo "[5/9] GET /rule-suggestions..."
RULES=$(curl -s -H "x-api-key: $API_KEY" "${BASE_URL}/rule-suggestions")
if echo "$RULES" | grep -q '"suggestions"'; then
  RULE_COUNT=$(echo "$RULES" | grep -o '"count":[0-9]*' | cut -d':' -f2)
  echo "  OK: ${RULE_COUNT} rule suggestions (threshold: 5)"
else
  echo "  FAIL: Could not fetch rule suggestions"
  echo "  Response: $RULES"
  exit 1
fi

# Test 6: Clusters Endpoint (Learning Loop)
echo ""
echo "[6/9] GET /clusters (all status)..."
CLUSTERS=$(curl -s -H "x-api-key: $API_KEY" "${BASE_URL}/clusters?status=all")
if echo "$CLUSTERS" | grep -q '"clusters"'; then
  READY_COUNT=$(echo "$CLUSTERS" | grep -o '"ready":[0-9]*' | head -1 | cut -d':' -f2)
  COLLECTING_COUNT=$(echo "$CLUSTERS" | grep -o '"collecting":[0-9]*' | head -1 | cut -d':' -f2)
  PENDING_COUNT=$(echo "$CLUSTERS" | grep -o '"pending":[0-9]*' | head -1 | cut -d':' -f2)
  echo "  OK: ${READY_COUNT:-0} ready, ${PENDING_COUNT:-0} pending, ${COLLECTING_COUNT:-0} collecting"
else
  echo "  FAIL: Could not fetch clusters"
  echo "  Response: $CLUSTERS"
  exit 1
fi

# Test 7: Settings Endpoint
echo ""
echo "[7/9] GET /settings..."
SETTINGS=$(curl -s -H "x-api-key: $API_KEY" "${BASE_URL}/settings")
if echo "$SETTINGS" | grep -q '"activation_mode"'; then
  MODE=$(echo "$SETTINGS" | grep -o '"activation_mode":"[^"]*"' | cut -d'"' -f4)
  MIN_EV=$(echo "$SETTINGS" | grep -o '"min_evidence":[0-9]*' | cut -d':' -f2)
  echo "  OK: activation_mode=${MODE}, min_evidence=${MIN_EV}"
else
  echo "  FAIL: Could not fetch settings"
  echo "  Response: $SETTINGS"
  exit 1
fi

# Test 8: Auth Rejection (without key)
echo ""
echo "[8/9] Auth rejection test (no key)..."
NO_AUTH=$(curl -s "${BASE_URL}/stats")
if echo "$NO_AUTH" | grep -q '"error"'; then
  echo "  OK: Correctly rejected request without API key"
else
  echo "  WARN: Request without API key was not rejected!"
fi

# Test 9: Backfill (optional)
echo ""
echo "[9/9] Backfill test..."
if [ "$WITH_BACKFILL" = "--with-backfill" ]; then
  echo "  Running backfill (limit=500)..."
  BACKFILL=$(curl -s -X POST -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
    -d '{"limit": 500}' "${BASE_URL}/backfill")
  if echo "$BACKFILL" | grep -q '"succeeded"'; then
    TOTAL=$(echo "$BACKFILL" | grep -o '"total_found":[0-9]*' | cut -d':' -f2)
    SUCCEEDED=$(echo "$BACKFILL" | grep -o '"succeeded":[0-9]*' | cut -d':' -f2)
    FAILED=$(echo "$BACKFILL" | grep -o '"failed":[0-9]*' | cut -d':' -f2)
    CLUSTERS=$(echo "$BACKFILL" | grep -o '"clusters_created":[0-9]*' | cut -d':' -f2)
    echo "  OK: Processed ${TOTAL} docs (${SUCCEEDED} ok, ${FAILED} failed), ${CLUSTERS} clusters"
  else
    echo "  FAIL: Backfill failed"
    echo "  Response: $BACKFILL"
    exit 1
  fi

  # Verify clusters were created
  echo "  Verifying clusters after backfill..."
  CLUSTERS_AFTER=$(curl -s -H "x-api-key: $API_KEY" "${BASE_URL}/clusters?status=all")
  TOTAL_CLUSTERS=$(echo "$CLUSTERS_AFTER" | grep -o '"count":[0-9]*' | head -1 | cut -d':' -f2)
  echo "  OK: ${TOTAL_CLUSTERS:-0} total clusters after backfill"
else
  echo "  SKIPPED (use --with-backfill to run)"
fi

echo ""
echo "=========================================="
echo "All smoke tests passed!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. cd apps/review-tool"
echo "  2. pnpm install"
echo "  3. pnpm dev"
echo "  4. Open http://localhost:5174"
echo ""
echo "To run backfill:"
echo "  ./smoke-test.sh <API_KEY> --with-backfill"
