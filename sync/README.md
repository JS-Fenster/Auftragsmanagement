# ERP to Supabase Sync

Synchronisiert Daten vom SQL Server (Work4all ERP) nach Supabase.

## Setup

```bash
# 1. Python-Pakete installieren
pip install pymssql supabase python-dotenv

# 2. Konfiguration erstellen
cp .env.example .env
# Dann .env editieren und SUPABASE_KEY eintragen
```

## Verwendung

### Remote (ueber Cloudflare Tunnel)

```bash
# Terminal 1: Tunnel starten
cloudflared access tcp --hostname sql.js-fenster-intern.org --url localhost:1433

# Terminal 2: Sync ausfuehren
python sync_to_supabase.py
```

### Lokal (auf ERP-Server)

```bash
# .env anpassen: SQL_SERVER=192.168.16.202\SQLEXPRESS
python sync_to_supabase.py
```

## Optionen

```bash
python sync_to_supabase.py              # Alle Tabellen syncen
python sync_to_supabase.py --dry-run    # Nur anzeigen, nicht schreiben
python sync_to_supabase.py --table erp_kunden  # Nur eine Tabelle
python sync_to_supabase.py --list-tables       # Verfuegbare Tabellen
```

## Tabellen-Mapping

| ERP Tabelle | Supabase Tabelle | Datensaetze |
|-------------|------------------|-------------|
| dbo.Kunden | erp_kunden | ~8.700 |
| dbo.Projekte | erp_projekte | ~2.500 |
| dbo.Angebot | erp_angebote | ~4.700 |
| dbo.Rechnung | erp_rechnungen | ~3.000 |
| dbo.RA | erp_ra | ~3.000 |
| dbo.Lieferanten | erp_lieferanten | ~660 |
| dbo.Bestellung | erp_bestellungen | ~3.800 |
