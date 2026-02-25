#!/bin/bash
# =============================================================================
# Batch Re-Classification Script
# Calls classify-backtest Edge Function in batches of 20 with apply=true
# Usage: ./scripts/batch-reclassify.sh <chunk_file> [batch_size]
# =============================================================================

CHUNK_FILE="$1"
BATCH_SIZE="${2:-20}"
API_URL="https://rsmjgdujlpnydbsfuiek.supabase.co/functions/v1/classify-backtest"
API_KEY="wNzMEZJRoUBnyb8JxiMUwEi7rDlxcUMTzAlYkkW2SE040w98gna3x1MmrPpC3qeX"

if [ -z "$CHUNK_FILE" ]; then
  echo "Usage: $0 <chunk_file.json> [batch_size]"
  exit 1
fi

if [ ! -f "$CHUNK_FILE" ]; then
  echo "ERROR: File $CHUNK_FILE not found"
  exit 1
fi

# Count total IDs
TOTAL=$(python3 -c "import json; ids=json.load(open('$CHUNK_FILE')); print(len(ids))")
echo "=== Batch Re-Classification ==="
echo "Chunk: $CHUNK_FILE"
echo "Total docs: $TOTAL"
echo "Batch size: $BATCH_SIZE"
echo "================================"

# Process in batches
PROCESSED=0
CHANGED=0
ERRORS=0
SKIPPED=0
BATCH_NUM=0

while [ $PROCESSED -lt $TOTAL ]; do
  BATCH_NUM=$((BATCH_NUM + 1))

  # Extract batch of IDs
  BATCH_IDS=$(python3 -c "
import json
ids = json.load(open('$CHUNK_FILE'))
batch = ids[$PROCESSED:$PROCESSED+$BATCH_SIZE]
print(json.dumps(batch))
")

  BATCH_COUNT=$(python3 -c "import json; print(len(json.loads('$BATCH_IDS')))" 2>/dev/null || echo "$BATCH_SIZE")

  echo "[Batch $BATCH_NUM] Processing $BATCH_COUNT docs (${PROCESSED}/${TOTAL})..."

  # Call the Edge Function
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d "{\"doc_ids\": $BATCH_IDS, \"apply\": true}" \
    --max-time 180)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    # Parse summary
    BATCH_CHANGED=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('summary',{}).get('changed',0))" 2>/dev/null || echo "?")
    BATCH_SKIPPED=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('summary',{}).get('skipped',0))" 2>/dev/null || echo "0")
    BATCH_APPLIED=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('summary',{}).get('applied',0))" 2>/dev/null || echo "?")

    echo "  -> OK: changed=$BATCH_CHANGED, applied=$BATCH_APPLIED, skipped=$BATCH_SKIPPED"

    if [ "$BATCH_CHANGED" != "?" ]; then
      CHANGED=$((CHANGED + BATCH_CHANGED))
    fi
    if [ "$BATCH_SKIPPED" != "0" ] && [ "$BATCH_SKIPPED" != "?" ]; then
      SKIPPED=$((SKIPPED + BATCH_SKIPPED))
    fi
  else
    echo "  -> ERROR: HTTP $HTTP_CODE"
    echo "  -> Body: $(echo "$BODY" | head -c 200)"
    ERRORS=$((ERRORS + 1))

    # On error, wait and retry once
    sleep 5
    echo "  -> Retrying..."
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
      -H "Content-Type: application/json" \
      -H "x-api-key: $API_KEY" \
      -d "{\"doc_ids\": $BATCH_IDS, \"apply\": true}" \
      --max-time 180)
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    if [ "$HTTP_CODE" = "200" ]; then
      echo "  -> Retry OK"
    else
      echo "  -> Retry FAILED: HTTP $HTTP_CODE"
    fi
  fi

  PROCESSED=$((PROCESSED + BATCH_COUNT))

  # Delay between batches to avoid rate limiting (longer for parallel runs)
  sleep 3
done

echo ""
echo "=== DONE ==="
echo "Total processed: $PROCESSED"
echo "Changed: $CHANGED"
echo "Skipped: $SKIPPED"
echo "Errors: $ERRORS"
echo "============="
