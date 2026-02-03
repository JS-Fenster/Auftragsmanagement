# Projektspezifikation: Budgetangebot V1 (Fenster)

> **Nur Projektleiter darf diese Datei editieren.**
> Stand: 2026-02-03 | Version: 0.1 (Entwurf)

---

## INDEX
| Kap. | Titel | Zeilen |
|------|-------|--------|
| 1 | Einfuehrung & Ziele | 25-50 |
| 2 | Fachliche Regeln | 55-120 |
| 3 | Datenmodell | 125-250 |
| 4 | Bridge/Proxy Architektur | 255-320 |
| 5 | Backtest-Konzept | 325-380 |
| 6 | Meilensteine | 385-420 |

---

## 1. Einfuehrung & Ziele

### 1.1 Zweck
Budgetangebot-Modul fuer schnelle Kostenvoranschlaege aus:
- Aufmassblatt (Scan/Foto)
- Kundennotiz (handschriftlich/telefonisch)
- Manuelle Eingabe

### 1.2 Langfristziel
Eigene Bestandswerte aufbauen (Budget → Angebot → Auftrag → Outcome), um Work4All langfristig ersetzen zu koennen.

### 1.3 Scope V1
- **IN:** Fenster, Tueren, Rollladen/Raffstore, Fensterbaenke, Insektenschutz, Plissee, Montage
- **OUT:** Terrassendaecher, Wintergaerten, Haustechnik

---

## 2. Fachliche Regeln

### 2.1 Masse
| Regel | Beschreibung |
|-------|--------------|
| Standard | Fertigmass (Rahmen-Aussenmass) |
| Fallback | Innenmass (wenn erkennbar) |
| Toleranz | ±10mm fuer Rundung |

### 2.2 Einheiten
| Input | Erkennung | Normalisierung |
|-------|-----------|----------------|
| `1230x1480` | mm (Standard) | → mm |
| `123x148` | cm (2-3 stellig) | × 10 → mm |
| `1,23x1,48` | m (Komma) | × 1000 → mm |
| `B=1230 H=1480` | explizit | → mm |

### 2.3 B/H Vertauschung
- Heuristik: B < H bei Fenstern (normal)
- Confidence Score: high/medium/low
- Bei low: Rueckfrage oder Markierung

### 2.4 Hersteller & Systeme
| Regel | Default |
|-------|---------|
| Hersteller | WERU |
| 3-fach Glas | CALIDO |
| 2-fach Glas | CASTELLO |
| Premium | IMPREO (nur wenn explizit) |

### 2.5 Profil-Kontext
- Profil gilt global pro Aufmassblatt
- Header/Textposition setzt Kontext (Material, Farbe, Glas, System)
- Kontext vererbt sich auf Folgepositionen bis zum naechsten Header

### 2.6 Zubehoer V1
| Element | Berechnung |
|---------|------------|
| Rollladen/Raffstore | Nach Fensterbreite |
| Motor | NUR wenn elektrisch |
| Aussenfensterbank (AFB) | Pro Fenster |
| Innenfensterbank (IFB) | Pro Fenster |
| Insektenschutz | Pro Fenster (optional) |
| Plissee | Pro Fenster (optional) |

### 2.7 Montage-Block
Separat ausweisen:
- Montage (pro Element)
- Demontage Alt (pro Element)
- Entsorgung Alt (pauschal oder pro Element)

### 2.8 Ausgabe
- **Intern:** Netto-Werte
- **Kunde:** Brutto, gerundet auf 50 EUR Schritte
- **Range:** Low/Medium/High mit Confidence

---

## 3. Datenmodell

### 3.1 Neue Tabellen (Supabase)

#### budget_cases
```sql
id UUID PK DEFAULT gen_random_uuid()
created_at TIMESTAMPTZ DEFAULT now()
updated_at TIMESTAMPTZ DEFAULT now()
erp_kunden_code INTEGER FK (optional)
erp_projekt_code INTEGER FK (optional)
lead_name TEXT (falls kein ERP-Kunde)
lead_telefon TEXT
lead_email TEXT
kanal TEXT CHECK (showroom|telefon|email|website)
status TEXT CHECK (draft|calculated|sent|quoted|ordered|won|lost)
assigned_to UUID FK auth.users
notes TEXT
```

#### budget_inputs
```sql
id UUID PK
budget_case_id UUID FK
source_type TEXT CHECK (aufmassblatt|kundennotiz|manuell)
document_id UUID FK documents (optional)
raw_text TEXT
raw_ocr TEXT
source_unit TEXT CHECK (mm|cm|m|unknown)
parsing_confidence TEXT CHECK (high|medium|low)
parsed_at TIMESTAMPTZ
```

#### budget_profile
```sql
id UUID PK
budget_case_id UUID FK UNIQUE
manufacturer TEXT DEFAULT 'WERU'
system TEXT
glazing TEXT CHECK (2-fach|3-fach)
color_inside TEXT
color_outside TEXT
material_class TEXT
inferred BOOLEAN DEFAULT true
manual_override BOOLEAN DEFAULT false
```

#### budget_items
```sql
id UUID PK
budget_case_id UUID FK
room TEXT
element_type TEXT (fenster|tuer|hst|etc)
width_mm INTEGER
height_mm INTEGER
qty INTEGER DEFAULT 1
position_in_source INTEGER
notes TEXT
confidence TEXT CHECK (high|medium|low)
```

#### budget_accessories
```sql
id UUID PK
budget_item_id UUID FK
shutter BOOLEAN DEFAULT false
shutter_type TEXT (rollladen|raffstore)
shutter_electric BOOLEAN DEFAULT false
motor_qty INTEGER
afb BOOLEAN DEFAULT false
ifb BOOLEAN DEFAULT false
insect BOOLEAN DEFAULT false
plissee BOOLEAN DEFAULT false
```

#### budget_results
```sql
id UUID PK
budget_case_id UUID FK
calculated_at TIMESTAMPTZ DEFAULT now()
net_total NUMERIC(12,2)
vat_rate NUMERIC(4,2) DEFAULT 19.00
gross_total NUMERIC(12,2)
gross_rounded_50 NUMERIC(12,2)
range_low NUMERIC(12,2)
range_high NUMERIC(12,2)
assumptions_json JSONB
model_version TEXT
```

#### budget_outcomes
```sql
id UUID PK
budget_case_id UUID FK
converted_to_quote BOOLEAN
quote_number TEXT
converted_to_order BOOLEAN
order_number TEXT
final_value NUMERIC(12,2)
deviation_percent NUMERIC(5,2)
competitor_lost_to TEXT
lost_reason TEXT
outcome_date DATE
```

#### price_model_versions
```sql
id UUID PK
version TEXT UNIQUE
valid_from DATE
valid_to DATE
description TEXT
created_by UUID FK auth.users
```

#### price_params
```sql
id UUID PK
model_version_id UUID FK
param_key TEXT
param_value NUMERIC
unit TEXT
category TEXT (fenster|zubehoer|montage)
```

#### learned_stats
```sql
id UUID PK
category TEXT
stat_key TEXT
stat_value NUMERIC
sample_size INTEGER
computed_at TIMESTAMPTZ
confidence TEXT
```

---

## 4. Bridge/Proxy Architektur

### 4.1 Konzept
On-demand Abfrage von Work4All Positionen via Proxy-Service, OHNE dbo.Positionen zu replizieren.

### 4.2 Endpunkte
| Route | Beschreibung |
|-------|--------------|
| `GET /api/w4a/angebote/:code/positionen` | Positionen eines Angebots (paginated) |
| `GET /api/w4a/angebote/:code/summary` | Aggregat: fenster_count, montage_summe, etc. |
| `GET /api/w4a/kunden/:code/angebots-history` | Alle Angebote eines Kunden mit Summen |

### 4.3 Security
- Cloudflare Access Service Token
- IP Allowlist (nur lokales Netz + bekannte IPs)
- Auth Header Validierung

### 4.4 Cache
```sql
erp_angebot_summaries_cache (
  angebot_code INTEGER PK,
  computed_at TIMESTAMPTZ,
  fenster_count INTEGER,
  montage_summe NUMERIC,
  zubehoer_summe NUMERIC,
  positionen_count INTEGER,
  heuristic_version TEXT
)
```
TTL: 24h oder bei Angebot-Update

### 4.5 Fallback
Wenn Proxy nicht erreichbar:
- Nutze `erp_angebote.wert` (Netto-Summe)
- Markiere als "ohne Positionsanalyse"

---

## 5. Backtest-Konzept

### 5.1 Sampling
- Letzte 200-500 Angebote mit Positionen
- Filter: Nur Fenster-Projekte (Notiz = DKF, EA)
- Zeitraum: Letzte 12-24 Monate

### 5.2 Textposition-Erkennung
Header/Textpositionen in dbo.Positionen erkennen:
- `Anzahl = 0` oder `Anzahl IS NULL`
- `EinzPreis = 0` oder `EinzPreis IS NULL`
- `Bezeichnung` enthaelt System/Farbe/Material-Keywords

### 5.3 Kontext-Parser
```
Position 1: "WERU CASTELLO weiss/weiss 3-fach"  → HEADER (setzt Kontext)
Position 2: "Fenster DK 1230x1480 mm"           → ITEM (erbt Kontext)
Position 3: "Fenster FIX 800x1200 mm"           → ITEM (erbt Kontext)
Position 4: "WERU CALIDO anthrazit 2-fach"      → HEADER (neuer Kontext)
Position 5: "Fenster DK 1000x1400 mm"           → ITEM (erbt neuen Kontext)
```

### 5.4 Metriken
| Metrik | Ziel |
|--------|------|
| Median-Abweichung | < 10% |
| Trefferquote (innerhalb +/-15%) | > 80% |
| Ausreisser (> 30% Abweichung) | < 5% |

### 5.5 Range-Breiten
| Confidence | Range |
|------------|-------|
| High | +/-10% |
| Medium | +/-20% |
| Low | +/-30% |

---

## 6. Meilensteine

### Phase 1: Grundlagen (Woche 1-2)
- [ ] 1.1 Datenmodell in Supabase anlegen
- [ ] 1.2 RLS Policies definieren
- [ ] 1.3 Bridge-Proxy Endpunkte implementieren

### Phase 2: Parser (Woche 3-4)
- [ ] 2.1 Textposition-Erkennung
- [ ] 2.2 Kontext-Parser
- [ ] 2.3 Mass-Extraktion + Normalisierung

### Phase 3: Backtest (Woche 5)
- [ ] 3.1 Sampling durchfuehren
- [ ] 3.2 Metriken berechnen
- [ ] 3.3 Range-Parameter kalibrieren

### Phase 4: Kalkulation (Woche 6-7)
- [ ] 4.1 Preismodell V1 implementieren
- [ ] 4.2 Zubehoer-Berechnung
- [ ] 4.3 Montage-Block

### Phase 5: Integration (Woche 8)
- [ ] 5.1 API-Endpunkte
- [ ] 5.2 Outcome-Tracking
- [ ] 5.3 Monthly Update Job

---

*Wartet auf Detaillierung durch Analyse-Agenten.*
