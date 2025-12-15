"""
ERP to Supabase Sync Script
===========================
Synchronisiert Daten vom SQL Server (Work4all ERP) nach Supabase.

VORAUSSETZUNGEN:
----------------
1. Python-Pakete installieren:
   pip install pymssql supabase python-dotenv

2. Bei Remote-Zugriff: Cloudflare Tunnel starten:
   cloudflared access tcp --hostname sql.js-fenster-intern.org --url localhost:1433

3. .env Datei erstellen (siehe .env.example)

VERWENDUNG:
-----------
python sync_to_supabase.py           # Alle Tabellen syncen
python sync_to_supabase.py --table erp_kunden  # Nur eine Tabelle
python sync_to_supabase.py --dry-run # Nur anzeigen, nicht schreiben
"""

import os
import sys
import argparse
from datetime import datetime, date
from decimal import Decimal
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Check required packages
try:
    import pymssql
except ImportError:
    print("FEHLER: pymssql nicht installiert!")
    print("Installieren mit: pip install pymssql")
    sys.exit(1)

try:
    from supabase import create_client, Client
except ImportError:
    print("FEHLER: supabase nicht installiert!")
    print("Installieren mit: pip install supabase")
    sys.exit(1)


# =============================================================================
# CONFIGURATION
# =============================================================================

# SQL Server (ERP)
SQL_SERVER = os.getenv("SQL_SERVER", "localhost")  # localhost wenn Tunnel aktiv
SQL_DATABASE = os.getenv("SQL_DATABASE", "WorkM001")
SQL_USER = os.getenv("SQL_USER", "sa")
SQL_PASSWORD = os.getenv("SQL_PASSWORD", "Work4all!")

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://rsmjgdujlpnydbsfuiek.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")  # Service Role Key!


# =============================================================================
# TABLE MAPPINGS
# =============================================================================

TABLE_MAPPINGS = {
    "erp_kunden": {
        "erp_table": "dbo.Kunden",
        "erp_query": """
            SELECT
                Code as code,
                Firma1 as firma1,
                Firma2 as firma2,
                Firma3 as firma3,
                Name as name,
                [Straße] as strasse,
                Plz as plz,
                Ort as ort,
                Telefon as telefon,
                NULL as mobil,
                [E-Mail] as email,
                InsertTime as erp_insert_time,
                UpdateTime as erp_update_time
            FROM dbo.Kunden
            WHERE Code IS NOT NULL
        """,
        "primary_key": "code"
    },

    "erp_projekte": {
        "erp_table": "dbo.Projekte",
        "erp_query": """
            SELECT
                Code as code,
                Nummer as nummer,
                Name as name,
                KundenCode as kunden_code,
                Datum as datum,
                ProjektStatus as projekt_status,
                Notiz as notiz,
                InsertTime as erp_insert_time,
                UpdateTime as erp_update_time
            FROM dbo.Projekte
            WHERE Code IS NOT NULL
        """,
        "primary_key": "code"
    },

    "erp_angebote": {
        "erp_table": "dbo.Angebot",
        "erp_query": """
            SELECT
                Code as code,
                Nummer as nummer,
                Datum as datum,
                ProjektCode as projekt_code,
                SDObjMemberCode as kunden_code,
                Wert as wert,
                AuftragsDatum as auftrags_datum,
                AuftragsNummer as auftrags_nummer,
                CAST(Notiz AS NVARCHAR(500)) as notiz,
                InsertTime as erp_insert_time,
                UpdateTime as erp_update_time
            FROM dbo.Angebot
            WHERE Code IS NOT NULL
        """,
        "primary_key": "code"
    },

    "erp_rechnungen": {
        "erp_table": "dbo.Rechnung",
        "erp_query": """
            SELECT
                Code as code,
                Nummer as nummer,
                Datum as datum,
                ProjektCode as projekt_code,
                SDObjMemberCode as kunden_code,
                Wert as wert,
                Bruttowert as bruttowert,
                Zahlbarbis as zahlbar_bis,
                Zahlungsfrist as zahlungsfrist,
                InsertTime as erp_insert_time,
                UpdateTime as erp_update_time
            FROM dbo.Rechnung
            WHERE Code IS NOT NULL
        """,
        "primary_key": "code"
    },

    "erp_ra": {
        "erp_table": "dbo.RA",
        "erp_query": """
            SELECT
                Code as code,
                RCode as r_code,
                RNummer as r_nummer,
                RBetrag as r_betrag,
                BezSumme as bez_summe,
                Mahnstuffe as mahnstufe,
                [FälligDatum] as faellig_datum
            FROM dbo.RA
            WHERE Code IS NOT NULL
        """,
        "primary_key": "code"
    },

    "erp_lieferanten": {
        "erp_table": "dbo.Lieferanten",
        "erp_query": """
            SELECT
                Code as code,
                Firma1 as firma1,
                Firma2 as firma2,
                Name as name,
                [Straße] as strasse,
                Plz as plz,
                Ort as ort,
                Telefon as telefon,
                [E-Mail] as email
            FROM dbo.Lieferanten
            WHERE Code IS NOT NULL
        """,
        "primary_key": "code"
    },

    "erp_bestellungen": {
        "erp_table": "dbo.Bestellung",
        "erp_query": """
            SELECT
                Code as code,
                Nummer as nummer,
                Datum as datum,
                ProjektCode as projekt_code,
                SDObjMemberCode as lieferant_code,
                Wert as wert,
                InsertTime as erp_insert_time,
                UpdateTime as erp_update_time
            FROM dbo.Bestellung
            WHERE Code IS NOT NULL
        """,
        "primary_key": "code"
    }
}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def convert_value(value):
    """Convert Python types to JSON-serializable types for Supabase."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, bytes):
        return value.decode('utf-8', errors='ignore')
    return value


def convert_row(row):
    """Convert a database row to a JSON-serializable dict."""
    return {key: convert_value(value) for key, value in row.items()}


def get_sql_connection():
    """Create SQL Server connection."""
    print(f"Verbinde mit SQL Server: {SQL_SERVER}...")
    try:
        conn = pymssql.connect(
            server=SQL_SERVER,
            user=SQL_USER,
            password=SQL_PASSWORD,
            database=SQL_DATABASE,
            as_dict=True
        )
        print("  SQL Server Verbindung erfolgreich!")
        return conn
    except Exception as e:
        print(f"  FEHLER: {e}")
        print("\n  Falls Remote: Ist der Cloudflare Tunnel aktiv?")
        print("  cloudflared access tcp --hostname sql.js-fenster-intern.org --url localhost:1433")
        sys.exit(1)


def get_supabase_client():
    """Create Supabase client."""
    if not SUPABASE_KEY:
        print("FEHLER: SUPABASE_KEY nicht gesetzt!")
        print("Bitte in .env Datei eintragen oder als Umgebungsvariable setzen.")
        print("Du brauchst den 'service_role' Key aus Supabase > Settings > API")
        sys.exit(1)

    print(f"Verbinde mit Supabase: {SUPABASE_URL}...")
    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("  Supabase Verbindung erfolgreich!")
        return client
    except Exception as e:
        print(f"  FEHLER: {e}")
        sys.exit(1)


# =============================================================================
# SYNC FUNCTIONS
# =============================================================================

def sync_table(sql_conn, supabase: Client, table_name: str, dry_run: bool = False):
    """Sync a single table from ERP to Supabase."""

    if table_name not in TABLE_MAPPINGS:
        print(f"FEHLER: Unbekannte Tabelle '{table_name}'")
        return False

    mapping = TABLE_MAPPINGS[table_name]
    erp_table = mapping["erp_table"]
    query = mapping["erp_query"]

    print(f"\n{'='*60}")
    print(f"Sync: {erp_table} -> {table_name}")
    print(f"{'='*60}")

    # Fetch from ERP
    print(f"  Lese aus ERP ({erp_table})...")
    cursor = sql_conn.cursor()
    try:
        cursor.execute(query)
        rows = cursor.fetchall()
    except Exception as e:
        print(f"  FEHLER beim Lesen: {e}")
        return False

    print(f"  Gefunden: {len(rows)} Datensaetze")

    if len(rows) == 0:
        print("  Keine Daten zum Syncen.")
        return True

    # Convert rows
    converted_rows = [convert_row(row) for row in rows]

    if dry_run:
        print(f"  [DRY RUN] Wuerde {len(converted_rows)} Datensaetze nach Supabase schreiben")
        print(f"  Beispiel (erster Datensatz):")
        if converted_rows:
            for key, value in list(converted_rows[0].items())[:5]:
                print(f"    {key}: {value}")
        return True

    # Write to Supabase in batches
    print(f"  Schreibe nach Supabase ({table_name})...")
    batch_size = 500
    total_written = 0
    errors = 0

    for i in range(0, len(converted_rows), batch_size):
        batch = converted_rows[i:i + batch_size]
        try:
            # Use upsert to handle existing records
            result = supabase.table(table_name).upsert(batch).execute()
            total_written += len(batch)
            print(f"    Batch {i//batch_size + 1}: {len(batch)} Datensaetze geschrieben")
        except Exception as e:
            errors += 1
            print(f"    FEHLER bei Batch {i//batch_size + 1}: {e}")
            # Try individual inserts for failed batch
            for row in batch:
                try:
                    supabase.table(table_name).upsert(row).execute()
                    total_written += 1
                except Exception as e2:
                    print(f"      Fehler bei Datensatz {row.get('code', '?')}: {e2}")

    print(f"  Ergebnis: {total_written}/{len(rows)} Datensaetze geschrieben")
    if errors > 0:
        print(f"  WARNUNG: {errors} Batch-Fehler aufgetreten")

    return True


def sync_all_tables(sql_conn, supabase: Client, dry_run: bool = False):
    """Sync all tables from ERP to Supabase."""

    # Order matters for foreign key constraints!
    # First: tables without dependencies
    # Then: tables that reference others
    sync_order = [
        "erp_kunden",       # No dependencies
        "erp_lieferanten",  # No dependencies
        "erp_projekte",     # References: erp_kunden (optional)
        "erp_angebote",     # References: erp_projekte, erp_kunden
        "erp_rechnungen",   # References: erp_projekte, erp_kunden
        "erp_ra",           # References: erp_rechnungen
        "erp_bestellungen", # References: erp_projekte, erp_lieferanten
    ]

    results = {}

    for table_name in sync_order:
        success = sync_table(sql_conn, supabase, table_name, dry_run)
        results[table_name] = success

    # Summary
    print(f"\n{'='*60}")
    print("ZUSAMMENFASSUNG")
    print(f"{'='*60}")

    for table_name, success in results.items():
        status = "OK" if success else "FEHLER"
        print(f"  {table_name}: {status}")

    failed = sum(1 for s in results.values() if not s)
    if failed > 0:
        print(f"\n  {failed} Tabelle(n) fehlgeschlagen!")
    else:
        print(f"\n  Alle {len(results)} Tabellen erfolgreich synchronisiert!")


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Sync ERP data to Supabase")
    parser.add_argument("--table", help="Sync only this table (e.g. erp_kunden)")
    parser.add_argument("--dry-run", action="store_true", help="Only show what would be synced")
    parser.add_argument("--list-tables", action="store_true", help="List available tables")
    args = parser.parse_args()

    if args.list_tables:
        print("Verfuegbare Tabellen:")
        for name, mapping in TABLE_MAPPINGS.items():
            print(f"  {name} <- {mapping['erp_table']}")
        return

    print("="*60)
    print("ERP -> Supabase Sync")
    print(f"Gestartet: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)

    if args.dry_run:
        print("\n*** DRY RUN MODE - Keine Aenderungen werden geschrieben ***\n")

    # Connect
    sql_conn = get_sql_connection()
    supabase = get_supabase_client()

    try:
        if args.table:
            sync_table(sql_conn, supabase, args.table, args.dry_run)
        else:
            sync_all_tables(sql_conn, supabase, args.dry_run)
    finally:
        sql_conn.close()
        print(f"\nBeendet: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
