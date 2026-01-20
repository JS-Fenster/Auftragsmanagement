#!/bin/bash
# =============================================================================
# Smoke Test for Review Tool API
# Usage: ./smoke-test.sh <INTERNAL_API_KEY>
# =============================================================================

set -e

API_KEY="${1:-}"
BASE_URL="https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/admin-review"

if [ -z "$API_KEY" ]; then
  echo "Usage: ./smoke-test.sh <INTERNAL_API_KEY>"
  echo "  INTERNAL_API_KEY: Your API key (will not be logged)"
  exit 1
fi

echo "=========================================="
echo "Review Tool API Smoke Test"
echo "=========================================="
echo ""

# Test 1: Health Check (no auth)
echo "[1/6] Health Check..."
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
echo "[2/6] GET /categories..."
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
echo "[3/6] GET /stats..."
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
echo "[4/6] GET / (queue)..."
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
echo "[5/6] GET /rule-suggestions..."
RULES=$(curl -s -H "x-api-key: $API_KEY" "${BASE_URL}/rule-suggestions")
if echo "$RULES" | grep -q '"suggestions"'; then
  RULE_COUNT=$(echo "$RULES" | grep -o '"count":[0-9]*' | cut -d':' -f2)
  echo "  OK: ${RULE_COUNT} rule suggestions (threshold: 5)"
else
  echo "  FAIL: Could not fetch rule suggestions"
  echo "  Response: $RULES"
  exit 1
fi

# Test 6: Auth Rejection (without key)
echo ""
echo "[6/6] Auth rejection test (no key)..."
NO_AUTH=$(curl -s "${BASE_URL}/stats")
if echo "$NO_AUTH" | grep -q '"error"'; then
  echo "  OK: Correctly rejected request without API key"
else
  echo "  WARN: Request without API key was not rejected!"
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
