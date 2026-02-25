#!/bin/bash
# =============================================================================
# Batch Move Script
# Calls move-document Edge Function in auto-mode to move files in Storage
# Usage: ./scripts/batch-move.sh [batch_size] [max_iterations]
# =============================================================================

BATCH_SIZE="${1:-50}"
MAX_ITERATIONS="${2:-50}"
API_URL="https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/move-document"
API_KEY="wNzMEZJRoUBnyb8JxiMUwEi7rDlxcUMTzAlYkkW2SE040w98gna3x1MmrPpC3qeX"

echo "=== Batch Move Documents ==="
echo "Batch size: $BATCH_SIZE"
echo "Max iterations: $MAX_ITERATIONS"
echo "============================="

TOTAL_MOVED=0
TOTAL_SKIPPED=0
TOTAL_ERRORS=0
ITERATION=0

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))

  echo "[Iteration $ITERATION] Requesting $BATCH_SIZE docs to move..."

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d "{\"auto\": true, \"limit\": $BATCH_SIZE}" \
    --max-time 120)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    MOVED=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('summary',{}).get('moved',0))" 2>/dev/null || echo "?")
    SKIPPED=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('summary',{}).get('skipped',0))" 2>/dev/null || echo "0")
    ERRORS=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('summary',{}).get('errors',0))" 2>/dev/null || echo "0")
    TOTAL=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('summary',{}).get('total',0))" 2>/dev/null || echo "0")

    echo "  -> OK: moved=$MOVED, skipped=$SKIPPED, errors=$ERRORS (total=$TOTAL)"

    if [ "$MOVED" != "?" ]; then
      TOTAL_MOVED=$((TOTAL_MOVED + MOVED))
    fi
    if [ "$ERRORS" != "0" ] && [ "$ERRORS" != "?" ]; then
      TOTAL_ERRORS=$((TOTAL_ERRORS + ERRORS))
    fi
    if [ "$SKIPPED" != "0" ] && [ "$SKIPPED" != "?" ]; then
      TOTAL_SKIPPED=$((TOTAL_SKIPPED + SKIPPED))
    fi

    # If no docs were found to move, we're done
    if [ "$TOTAL" = "0" ]; then
      echo "  -> No more docs to move. Stopping."
      break
    fi

    # If only errors and no moves, something is wrong
    if [ "$MOVED" = "0" ] && [ "$ERRORS" != "0" ]; then
      echo "  -> WARNING: Only errors, no successful moves. Check logs."
    fi
  else
    echo "  -> ERROR: HTTP $HTTP_CODE"
    echo "  -> Body: $(echo "$BODY" | head -c 200)"

    # Wait and continue
    sleep 5
  fi

  # Small delay between iterations
  sleep 2
done

echo ""
echo "=== DONE ==="
echo "Total moved: $TOTAL_MOVED"
echo "Total skipped: $TOTAL_SKIPPED"
echo "Total errors: $TOTAL_ERRORS"
echo "============="
