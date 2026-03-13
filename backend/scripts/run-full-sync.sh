#!/bin/bash
# ==============================================================================
# W4A -> Supabase Full Sync
# Startet Cloudflare-Tunnel, synced Rechnungen + Angebote + LV, stoppt Tunnel.
# Aufruf: bash scripts/run-full-sync.sh [--dry-run] [--force]
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
FLAGS="$*"
TUNNEL_PID=""

cleanup() {
  if [ -n "$TUNNEL_PID" ] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
    echo ""
    echo "[TUNNEL] Stoppe cloudflared (PID $TUNNEL_PID)..."
    kill "$TUNNEL_PID" 2>/dev/null
    wait "$TUNNEL_PID" 2>/dev/null
  fi
}
trap cleanup EXIT

echo "======================================================================"
echo "  W4A -> SUPABASE FULL SYNC"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Flags: ${FLAGS:-keine}"
echo "======================================================================"

# --- Tunnel starten ---
echo ""
echo "[TUNNEL] Starte cloudflared access tcp..."

# Pruefen ob Port 1433 bereits belegt ist
if netstat -an 2>/dev/null | grep -q "127.0.0.1:1433.*ABHO"; then
  echo "[TUNNEL] Port 1433 bereits belegt - Tunnel laeuft schon"
else
  cloudflared access tcp --hostname sql.js-fenster-intern.org --url localhost:1433 &
  TUNNEL_PID=$!
  sleep 4

  if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
    echo "[FEHLER] cloudflared konnte nicht gestartet werden"
    exit 1
  fi

  if ! netstat -an 2>/dev/null | grep -q "127.0.0.1:1433"; then
    echo "[FEHLER] Port 1433 nicht erreichbar nach Tunnel-Start"
    exit 1
  fi
  echo "[TUNNEL] OK - localhost:1433 erreichbar"
fi

# --- Syncs ausfuehren ---
cd "$BACKEND_DIR"

echo ""
echo "======================================================================"
echo "  [1/4] STAMMDATEN"
echo "======================================================================"
node scripts/sync-stammdaten.js $FLAGS

echo ""
echo "======================================================================"
echo "  [2/4] RECHNUNGEN"
echo "======================================================================"
node scripts/sync-positions-to-supabase.js $FLAGS

echo ""
echo "======================================================================"
echo "  [3/4] ANGEBOTE"
echo "======================================================================"
node scripts/sync-angebots-positionen.js $FLAGS

echo ""
echo "======================================================================"
echo "  [4/4] LEISTUNGSVERZEICHNIS"
echo "======================================================================"
node scripts/build-leistungsverzeichnis.js $FLAGS

echo ""
echo "======================================================================"
echo "  FULL SYNC ABGESCHLOSSEN - $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================================"
