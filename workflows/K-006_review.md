# K-006: Dokument-Review - KOMPLETT (550 Docs)

> **Status:** REVIEW BEREIT
> **Datum:** 2026-02-24
> **Basis:** K-006 Backtest Report (550 Docs, Prompt v2.3.0 / v37)
> **Methode:** 2 Runden OCR-Text-Review durch Claude (10 parallele Agenten total)
> **Ergebnis Runde 1:** 137 Backtest-Änderungen + 5 PRÜFEN + 8 Backtest-Fehler
> **Ergebnis Runde 2:** 13 zusätzliche Fehler die der Backtest NICHT fand
> **GESAMT: ~150 Änderungen empfohlen**

## Legende
- **OK** = Änderung korrekt, übernehmen
- **FALSCH** = Backtest-Vorschlag war falsch, alte Kategorie bleibt
- **PRÜFEN** = Manuell prüfen (Andreas)
- **NEU** = Andere Kategorie als alt UND Backtest vorgeschlagen
- **R2-NEU** = Erst in Runde 2 (Komplett-Prüfung) entdeckt

---

## Gesamtübersicht

### Runde 1: Backtest-Änderungen (142 vorgeschlagen → 137 bestätigt)

| Gruppe | Docs geprüft | Änderungen | Backtest korrekt | Backtest falsch | PRÜFEN |
|--------|-------------|------------|-----------------|-----------------|--------|
| Sonstiges_Dokument | 42 | 39 (+1 ELS) | 39 | 0 | 3 |
| Auftragsbestätigung | 47 | 22 | 21 | 0 | 1 |
| Eingangsrechnung | 59 | 17 | 17 | 0 | 0 |
| Bauplan | 22 | 18 | 17 | 2 | 0 |
| Restliche Kategorien | ~380 | 41 | 36 | 5 | 1 |
| **GESAMT** | **550** | **137** | **130** | **7** | **5** |

### Backtest-Genauigkeit: 95% (130 von 137 korrekt)

---

## BLOCK 1: Sonstiges_Dokument → Bild (31 Docs)

> Alle JPG-Fotos mit wenig/keinem OCR-Text. Empfehlung: alle → **Bild**

| # | Doc-ID | Dateiname | OCR-Text | Empfehlung | Status |
|---|--------|-----------|----------|------------|--------|
| 1 | `d0247771` | Busch2.jpg | "60888 17550" nur Zahlen | Bild | |
| 2 | `95be9930` | Brilz2.jpg | "2" eine einzige Zahl | Bild | |
| 3 | `9889d8f2` | G.S.7.jpg | "1" | Bild | |
| 4 | `2d32c770` | G.S.8.jpg | Jahreszahlen 1965-1977 | Bild | |
| 5 | `1481f1e9` | G.S.9.jpg | "72458 Albutant, CER, 118E 130" | Bild (PRÜFEN) | |
| 6 | `f233480c` | Montsho2.jpg | "1 2 3 4 5 6 7 8" nur Zahlen | Bild | |
| 7 | `a5068ba3` | Kistner2.jpg | "192300" dreimal | Bild | |
| 8 | `d8b8be77` | Kistner5.jpg | "100000..." Nullen | Bild | |
| 9 | `ba0b174e` | Kistner2.jpg (2) | "1841" zweimal | Bild | |
| 10 | `20e4b981` | 1.jpg | "12222, 1000 2000" | Bild | |
| 11 | `ed8fba4e` | 2.jpg | "11 6 1" wiederholt | Bild | |
| 12 | `1bfd8213` | 9.jpg | "10.250" | Bild | |
| 13 | `a0dee56a` | 6.jpg | "FFH 1851-2104" Beschlag-Etikett | Bild (PRÜFEN) | |
| 14 | `58ac3a3d` | 1.jpg (22.01) | "1 2 3 4 5 6 7" | Bild | |
| 15 | `e933aaa8` | 2.jpg (22.01) | "1 2 3 4 5 6" | Bild | |
| 16 | `1d796773` | IMG-20260123-WA0009.jpg | WhatsApp-Foto, kein Text | Bild | |
| 17 | `49fe0f46` | 1000089649.jpg | kein Text | Bild | |
| 18 | `38d60709` | 1000089650.jpg | kein Text | Bild | |
| 19 | `45b8dd8f` | 20260127_140027.jpg | kein Text | Bild | |
| 20 | `d194f838` | IMG-20260122-WA0003.jpg | "." nur ein Punkt | Bild | |

---

## BLOCK 2: Sonstiges_Dokument → Bild (Forts.) + andere (11+8 Docs)

| # | Doc-ID | Dateiname | OCR-Text | Empfehlung | Status |
|---|--------|-----------|----------|------------|--------|
| 21 | `62a23458` | IMG-20260122-WA0005.jpg | kein Text | Bild | |
| 22 | `5cff21d3` | 1000090039.jpg | "SMS-Code, KDW 7/14 AL" | Bild (PRÜFEN) | |
| 23 | `d1b0a9f4` | IMG-20260127-WA0003.jpg | kein Text | Bild | |
| 24 | `7666da62` | DKF_Beschlag.jpg | "FFH 751-1200" Beschlag-Etikett | Bild | |
| 25 | `b7d2fc05` | 7.jpg | "2 3" | Bild | |
| 26 | `026ea30c` | 1.jpg (05.02) | "ID-10713, 314573" | Bild | |
| 27 | `46c07f5e` | 3.jpg (05.02) | "10" zwölfmal | Bild | |
| 28-31 | `327cd65f` `f5e39462` `af2cbad0` `e2504e7b` | 20260206_125801.jpg (4x) | Jahreskalender-Foto | Bild | |
| 32 | `7a9cf18f` | IMG_20260130_102843.jpg | kein Text | Bild | |
| 33-35 | `d13a56ed` `502537d8` `b79089e3` | 1000086356/53/55.jpg | kein Text (3x) | Bild | |

**Sonstiges → andere Kategorien:**

| # | Doc-ID | Dateiname | OCR-Text | Empfehlung | Status |
|---|--------|-----------|----------|------------|--------|
| 36 | `9321ebb5` | 20260130121031.pdf | Zulassungsbescheinigung Teil II | **Fahrzeugdokument** | |
| 37 | `305480b3` | 20260130121046.pdf | Kraftstoffverbrauch 9.4l/100km | **Fahrzeugdokument** | |
| 38 | `4e270ee3` | 20260202124852.pdf | TSE-Bon Dr. Donnini, Katze Lenny | **Kassenbeleg** | |
| 39 | `73588d88` | 20260202124904.pdf | TSE-Bon Dr. Donnini, Katze Milo | **Kassenbeleg** | |
| 40 | `b7b3cb54` | 20260116091807.pdf | WERU GARANTIEPASS HAUSTÜREN | **Produktdatenblatt** | |
| 41 | `e2c83354` | PDF_2_11022026.pdf | GLS Einlieferungsbeleg PaketShop | **Eingangslieferschein** | |
| 42 | `345efeed` | Dichtung_Schroether.pdf | Zahlenreihen, evtl. Skizze | Bild (PRÜFEN) | |
| 43 | `eb4f8a75` | Hubertus-Cup2026.pdf | Handball-Turnierplan | Sonstiges (bleibt) | |
| 44 | `edf6ce79` | Hubertus-Cup2026.pdf (Dup.) | Handball-Turnierplan | Sonstiges (bleibt) | |

---

## BLOCK 3: Auftragsbestätigung → andere (22 Docs)

| # | Doc-ID | Dateiname | OCR-Text | Empfehlung | Status |
|---|--------|-----------|----------|------------|--------|
| 45 | `68fcd7f0` | Allgemeine_Geschaeftsbedingungen.pdf | AGB JS Fenster, Paragraph 1 Geltung | **Vertrag** | |
| 46 | `08e21f3e` | Allgemeine_Geschaeftsbedingungen.pdf | AGB JS Fenster (Duplikat) | **Vertrag** | |
| 47 | `aa6ab7aa` | Ehrenreich_Vertragsbedingungen.pdf | Ausschreibungsbedingungen Stand 20.04.2023 | **Vertrag** | |
| 48 | `0726efbc` | Ehrenreich_Vertragsbedingungen.pdf | Ausschreibungsbedingungen (Duplikat) | **Vertrag** | |
| 49 | `cac9edeb` | Liefer-und_Zahlungsbedingungen.pdf | Viktor Müller Rolladen, AGB | **Vertrag** | |
| 50 | `6454ff29` | Vorvertragliche_Pflichtinfo.pdf | Telekom Business Glasfaser 600 Pro | **Vertrag** | |
| 51 | `3b1252bc` | Vorvertragliche_Pflichtinfo.pdf | Telekom (Duplikat) | **Vertrag** | |
| 52 | `7bfba6d2` | RE245253-2026.pdf | ab-in-die-BOX Rechnung | **Eingangsrechnung** | |
| 53 | `e63f1bba` | Rechnung_5202656496.pdf | Jalousie-Ersatzteil-Service Rechnung | **Eingangsrechnung** | |
| 54 | `42f91ef4` | Rechnung_5202656496_2026_02.pdf | Jalousie-Ersatzteil (Duplikat) | **Eingangsrechnung** | |
| 55 | `a2445721` | Rechnung_5202656496_2026_02.pdf | Jalousie-Ersatzteil (Duplikat 2) | **Eingangsrechnung** | |
| 56 | `2554d43e` | Lieferschein_n.86022473.PDF | Somfy Lieferschein | **Eingangslieferschein** | |
| 57 | `70a438db` | Lieferschein_AU548626.pdf | ab-in-die-BOX LIEFERSCHEIN | **Eingangslieferschein** | |
| 58 | `4ba25726` | 005CAN001...pdf | WERU Leistungserkl. (DoP) EN 14351 | **Produktdatenblatt** | |
| 59 | `f529848a` | 005CAN001...pdf | WERU Leistungserkl. (DoP) | **Produktdatenblatt** | |
| 60 | `c6e363e8` | LV_Fenster_Rolllaeden.pdf | Ehrenreich LV Sonnenstr. Lappersdorf | **Kundenanfrage** | |
| 61 | `2e374734` | LV_Fenster_-_Rolllaeden.pdf | Ehrenreich LV Weichser Breite | **Kundenanfrage** | |
| 62 | `ccfdedc3` | Anschreiben_Lieferzeiten_26.01.pdf | Trendtüren Lieferzeiten-Info | **Brief_eingehend** | |
| 63 | `77d2e5d6` | Anschreiben_Lieferzeiten_09.02.pdf | Trendtüren Lieferzeiten-Info | **Brief_eingehend** | |
| 64 | `d8853a17` | 20260212123042.pdf | Trendtüren AB-Begleit-Email | **Brief_eingehend** | |
| 65 | `ceee8aa4` | 20260203160715.pdf | JS Fenster Reparatur-Auftragsformular | **Serviceauftrag** | |
| 66 | `ef3cb5c6` | 20260122_SS_an_AG_Amberg.pdf | Anwaltskanzlei Becker, Klage Zahlung | **Brief_eingehend** | |

**PRÜFEN:** `f4f5539a` Ford Transit AB/Kaufvertrag Auto Auers → AB oder Vertrag?

---

## BLOCK 4: Eingangsrechnung → andere (17 Docs)

| # | Doc-ID | Dateiname | OCR-Text | Empfehlung | Status |
|---|--------|-----------|----------|------------|--------|
| 67 | `5a3d7f2c` | 20260206_125728.jpg | Grün Beschläge LIEFERSCHEIN | **Eingangslieferschein** | |
| 68 | `4228c058` | 20260206_125728.jpg (Dup.) | Grün Beschläge (Duplikat) | **Eingangslieferschein** | |
| 69 | `c9db1a11` | 20260206_125750.jpg | Grün Beschläge Lieferschein Seite 2 | **Eingangslieferschein** | |
| 70 | `5c247bff` | 20260206_125728.jpg (Dup.) | Grün Beschläge (Duplikat 2) | **Eingangslieferschein** | |
| 71 | `d0f201b0` | 20260206_125728.jpg (Dup.) | Grün Beschläge (Duplikat 3) | **Eingangslieferschein** | |
| 72 | `765d3e82` | 20260206_12575.jpg | Grün Beschläge Lieferschein | **Eingangslieferschein** | |
| 73 | `75ca609f` | 10_Brutto_Netto-Abrechnung.pdf | Lohnabrechnung Personal-Nr. 00012 | **Personalunterlagen** | |
| 74 | `071a72ae` | lovor.pdf | Lohnvorschau PNR 38, Gesamtbrutto | **Personalunterlagen** | |
| 75 | `683f9944` | Hauptwetter_26.pdf | Radio Ramasuri Sponsoring-Angebot | **Lieferantenangebot** | |
| 76 | `3398d3df` | Hauptwetter_26.pdf (Dup.) | Radio Ramasuri (Duplikat) | **Lieferantenangebot** | |
| 77 | `828e0d7b` | Receipt-2223-7907-3400.pdf | Anthropic Receipt, Date paid | **Kassenbeleg** | |
| 78 | `8011e8bb` | PDF_2_22012026.pdf | E-Center Kunert, Bar 5,00 Rückgeld | **Kassenbeleg** | |
| 79 | `cd56c872` | Anmeldung_Planungswettbewerbe.pdf | Anmeldeformular Vergaberecht, 259 EUR | **Formular** | |
| 80 | `e012d7d3` | 20260218115447.pdf | Oberpfalz TV AUFTRAGSBESTÄTIGUNG | **Auftragsbestaetigung** | |
| 81 | `0d113f3b` | 2026_01_WEG_Pfarrer-Drexler.pdf | G.S. Hausverwaltung, Rollladen-Rep. | **Serviceauftrag** | |
| 82 | `c690c53b` | 20260129123556.pdf | Generali Vertrag/Ansprechpartner | **Brief_eingehend** | |
| 83 | `af3983c9` | 20260220113420.pdf | IHK Regensburg Guthabenbescheid | **Brief_eingehend** | |

---

## BLOCK 5: Bauplan → andere (18 Docs)

| # | Doc-ID | Dateiname | OCR-Text | Empfehlung | Status |
|---|--------|-----------|----------|------------|--------|
| 84 | `d554ed5a` | Anfrage_BV_Kinderkrippe_Kastl.pdf | Lotter Metallbau, Kinderkrippe | **Kundenanfrage** | |
| 85 | `404a20a2` | Bau-_Leistungsbeschreibung_MFH.pdf | MFH Weichser Breiten Regensburg | **Kundenanfrage** | |
| 86 | `154ed388` | MFH_Sonnenstrasse_10_WE.pdf | MFH 10 WE Lappersdorf | **Kundenanfrage** | |
| 87 | `f18d2e75` | VE55_Sonnenschutz_Gb.1.pdf | Headquarters TrÜbPl GOI, Ausschr. | **Kundenanfrage** | |
| 88 | `a4f95e7f` | VE55_Sonnenschutz_Gb.2.pdf | Sonnenschutz Gb.2 (wie oben) | **Kundenanfrage** | |
| 89 | `7c599868` | VE55_Sonnenschutz_Gb.3.pdf | Sonnenschutz Gb.3 (wie oben) | **Kundenanfrage** | |
| 90 | `b8647602` | 20260124_Angebot_Fenster.pdf | Bodenaeckerstr. 5, Alu-Haustür | **Angebot** | |
| 91 | `8c31f749` | Angebot_250306.pdf | JS Fenster ANGEBOT an Hönig | **Angebot** | |
| 92 | `45a95689` | Angebot_260076.pdf | JS Fenster ANGEBOT an Hönig | **Angebot** | |
| 93 | `a332bc30` | 20260202155923.pdf | OBI Amberg Retoure-Kassenbon | **Kassenbeleg** | |
| 94 | `77d0bb6e` | 20260202164052.pdf | OBI Amberg PTC Turmheizer 99,99 | **Kassenbeleg** | |
| 95 | `d8f58d09` | 20260202164804.pdf | OBI Amberg Retoure-Kassenbon | **Kassenbeleg** | |
| 96 | `c971396c` | Schreiben_an_Generali.pdf | Anwaltskanzlei Becker, Scheibenschaden | **Brief_eingehend** | |
| 97 | `19e33f6e` | Softwareentwicklung_Embedded.pdf | Initiativbewerbung Foyet Nithieug | **Brief_eingehend** | |
| 98 | `60ab3bbf` | Screenshot_2026-02-06.png | Windows Ransomware-Einstellungen | **Sonstiges_Dokument** | |
| 99 | `07b7e275` | Birner_Fenster_Masse.pdf | Techn. Auftragsdaten, Sprossen, RC | **Sonstiges_Dokument** | |
| 100 | `7e541b9d` | 6410009808-2026-01-23.PDF | ammon Beschläge AB 6410009808 | **Auftragsbestaetigung** | |
| 101 | `8abd7303` | VK_Lieferavise_WKSHCD.pdf | SUEHAC Lieferavis 26301153 | **Eingangslieferschein** | |

**FALSCH (Bauplan bleibt):** `3a635794` Grundriss M 1:100, Architekt Peter Seliger → bleibt Bauplan
**FALSCH (Backtest):** `07b7e275` Birner_Fenster_Masse.pdf → Backtest sagte "Vertrag", Agent sagt "Sonstiges_Dokument"

---

## BLOCK 6: Restliche Kategorien Teil 1 (20 Docs)

| # | Doc-ID | Dateiname | Alt | OCR-Text | Empfehlung | Status |
|---|--------|-----------|-----|----------|------------|--------|
| 102 | `ee58aca2` | Formular/...113645.pdf | Formular | Lohnabrechnung Januar 2026, PNr 00037 | **Personalunterlagen** | |
| 103 | `0526f452` | Formular/...114947.pdf | Formular | Krankenkasse Schmid, AU | **Personalunterlagen** | |
| 104 | `6a20a3e7` | Formular/...115003.pdf | Formular | Krankenkasse Schmid, AU | **Personalunterlagen** | |
| 105 | `6dbe2dba` | Formular/...115019.pdf | Formular | DAK Schmölzl Mario, AU | **Personalunterlagen** | |
| 106 | `94c065fc` | Formular/...122812.pdf | Formular | Generali Kfz-Versicherungsantrag | **Fahrzeugdokument** | |
| 107 | `c8b53c75` | Lieferschein_AU548626.pdf | Formular | ab-in-die-BOX LIEFERSCHEIN | **Eingangslieferschein** | |
| 108 | `7fb9546b` | Finanzierung/Brutto_Netto.pdf | Finanzierung | Lohnabrechnung PNr 00012 | **Personalunterlagen** | |
| 109 | `e85ddcf9` | Finanzierung/Brutto_Netto.pdf | Finanzierung | Lohnabrechnung (Duplikat) | **Personalunterlagen** | |
| 110 | `00d62efd` | Invoice_453444.pdf | Bestellung | Werbefabrik Rechnungs-Nr 453444 | **Eingangsrechnung** | |
| 111 | `c677a7f3` | Invoice_453453.pdf | Bestellung | Werbefabrik Fahrzeugbeschr. 885 EUR | **Eingangsrechnung** | |
| 112 | `78324f3e` | Wuerth_Lieferschein.pdf | Bestellung | Würth LIEFERSCHEIN 8141349399 | **Eingangslieferschein** | |
| 113 | `b665be29` | 225797000318.PDF | Bestellung | Kompotherm Haustüren, Lieferdokument | **Eingangslieferschein** | |
| 114 | `164ecb8e` | Einladung_Kundentag.pdf | Reiseunterlagen | Würth Einladung Kundentag 11.02. | **Brief_eingehend** | |
| 115 | `f736cde8` | expertentag_2026.pdf | Reiseunterlagen | Somfy Einladung Wien 12.-14.03. | **Brief_eingehend** | |
| 116 | `ad50cb2b` | expertentag_2026.pdf (Dup.) | Reiseunterlagen | Somfy Einladung (Duplikat) | **Brief_eingehend** | |
| 117 | `f13a383a` | AvisTemp.pdf | Zahlungsavis | WERU Abholavis Gestelle | **Eingangslieferschein** | |
| 118 | `9f1d8739` | AvisTemp.pdf | Zahlungsavis | WERU Lieferavis, Lieferanschrift | **Eingangslieferschein** | |
| 119 | `9300d700` | AvisTemp.pdf | Zahlungsavis | WERU Lieferavis (wie oben) | **Eingangslieferschein** | |
| 120 | `36bce1d8` | Receipt-OAQFTU-00003.pdf | Zahlungsavis | Supabase Receipt $25.00 Pro Plan | **Eingangsrechnung** | |
| 121 | `657fc98e` | Receipt-2949-3830-8175.pdf | Zahlungsavis | Anthropic Receipt EUR 90.00 Claude | **Eingangsrechnung** | |

---

## BLOCK 7: Restliche Kategorien Teil 2 (20 Docs)

| # | Doc-ID | Dateiname | Alt | OCR-Text | Empfehlung | Status |
|---|--------|-----------|-----|----------|------------|--------|
| 122 | `b52bc1c0` | Serviceauftrag/...142811.pdf | Serviceauftrag | Ford Transit Service-Nachweis, VIN | **Fahrzeugdokument** | |
| 123 | `f9fb25f0` | Brief_ausgehend/...121417.pdf | Brief_ausgehend | Email Susann→Roland: "Angebot anpassen" | **Email_Ausgehend** | |
| 124 | `f07db92f` | Brief_ausgehend/...105207.pdf | Brief_ausgehend | Email Tanja: "SEPA-Mandat Korrektur" | **Email_Ausgehend** | |
| 125 | `f387333f` | Brief_ausgehend/PDF_2.pdf | Brief_ausgehend | ANGEBOT 250753, JS Fenster an Singer | **Angebot** | |
| 126 | `a988d4d8` | Brief_ausgehend/PDF_2.pdf (Dup.) | Brief_ausgehend | ANGEBOT 250753 (Duplikat) | **Angebot** | |
| 127 | `2f38a81c` | Resume__1_.pdf | Produktdatenblatt | Lebenslauf Jacek Szczesniak (polnisch) | **Personalunterlagen** | |
| 128 | `3ea3db2d` | Bauteiliste_Fenster.pdf | Produktdatenblatt | Freigabeliste Baustoffe Ehrenreich | **Formular** | |
| 129 | `8dc24a94` | Freigabeliste_Fenster.pdf | Produktdatenblatt | Freigabeliste Baustoffe (Duplikat) | **Formular** | |
| 130 | `b90f192c` | Fenster.pdf | Produktdatenblatt | Freigabeliste Baustoffe (Variante) | **Formular** | |
| 131 | `02b81e3a` | Elektro-Ingenieur_Ayoob.pdf | Kundenanfrage | Initiativbewerbung Elektronik | **Personalunterlagen** | |
| 132 | `41fe41a4` | Kundenanfrage/...112741.pdf | Kundenanfrage | Handschriftl. Maße "Krupp-Wolfslach" | **Aufmassblatt** | |
| 133 | `929fe9cc` | Kundenlieferschein/...110708.pdf | Kundenlieferschein | AGADOS Anhänger-Identifizierungskarte | **Fahrzeugdokument** | |
| 134 | `8bc44f29` | Kundenlieferschein/...121651.pdf | Kundenlieferschein | Ticzko Energy Gas-Lieferschein | **Eingangslieferschein** | |
| 135 | `ca2b3cda` | Return_Label_317.pdf | Kundenlieferschein | GLS Retoure-Label | **Sonstiges_Dokument** | |
| 136 | `6d6a6b68` | Kundenlieferschein/...102012.pdf | Kundenlieferschein | Handschriftl. Lieferschein Metall-Teile | **Eingangslieferschein** | |
| 137 | `07495f11` | Gutschrift/...111140.pdf | Gutschrift | SUEHAC Rückgabe-Beleg Türen | **Eingangslieferschein** | |
| 138 | `792d7bf4` | Brief_eingehend/...121345.pdf | Brief_eingehend | Lebenslauf Kraus Thomas, Bewerbung | **Personalunterlagen** | |
| 139 | `632385b2` | Brief_eingehend/...935844.pdf | Brief_eingehend | WERU Abholavis Gestelle | **Eingangslieferschein** | |
| 140 | `a437304a` | Brief_eingehend/...135844.pdf | Brief_eingehend | Internationale Versicherungskarte Kfz | **Fahrzeugdokument** | |
| 141 | `89fdc7b7` | Eingangslieferschein/...121420.pdf | Eingangslieferschein | klarmobil Allnet Flat 6 GB | **Brief_eingehend** | |

---

## BLOCK 8: Restliche Kategorien Teil 3 (letzter Block, 4 Docs + Sonderfälle)

| # | Doc-ID | Dateiname | Alt | OCR-Text | Empfehlung | Status |
|---|--------|-----------|-----|----------|------------|--------|
| 142 | `44061970` | eVB_JS_Fenster.pdf | Vertrag | Generali eVB-Nr. Kfz-Zulassung | **Fahrzeugdokument** | |
| 143 | `c10afbec` | Lieferantenangebot/...121012.pdf | Lieferantenangebot | Conbato "Auftrag erteilt" | **Bestellung** | |
| 144 | `b476ce02` | Montageauftrag/...124351.pdf | Montageauftrag | Aufmaß-Skizze Kunde Santag | **Aufmassblatt** | |

### PRÜFEN (Andreas entscheidet)

| # | Doc-ID | Dateiname | Alt | OCR-Text | Frage |
|---|--------|-----------|-----|----------|-------|
| P1 | `f4f5539a` | 20260130094516.pdf | Auftragsbestaetigung | Ford Transit Connect, Auto Auers, "Auftragsbestätigung" | AB bleiben oder → Vertrag (Kfz-Kaufvertrag)? |
| P2 | `1481f1e9` | G.S.9.jpg | Sonstiges_Dokument | "72458 Albutant, CER" Typenschild | Bild oder Produktdatenblatt? |
| P3 | `a0dee56a` | 6.jpg | Sonstiges_Dokument | "FFH 1851-2104" Beschlag-Etikett | Bild oder Produktdatenblatt? |
| P4 | `5cff21d3` | 1000090039.jpg | Sonstiges_Dokument | "SMS-Code, KDW 7/14 AL" | Bild oder Eingangslieferschein? |
| P5 | `345efeed` | Dichtung_Schroether.pdf | Sonstiges_Dokument | Zahlenreihen, PDF mit Dichtungsname | Bild oder Skizze/Aufmassblatt? |

### FALSCH (Backtest lag daneben, aktuelle Kategorie korrekt)

| Doc-ID | Aktuell | Backtest sagt | Bewertung |
|--------|---------|---------------|-----------|
| `3a635794` | Bauplan | Aufmassblatt | **Bauplan bleibt** (M 1:100 Grundriss, Architekt) |
| `80d5c7ff` | Finanzierung | Brief_eingehend | **Finanzierung bleibt** (Mercedes Tilgungsplan) |
| `69a6e05e` | Finanzierung | Brief_eingehend | **Finanzierung bleibt** (Opel Finanzierungsangebot) |
| `6ff9ab28` | Serviceauftrag | Notiz | **Serviceauftrag bleibt** (Werner PSK-Tür Reparatur) |
| `d6a4dda9` | Brief_eingehend | Sonstiges_Dokument | **Brief_eingehend bleibt** (klarmobil SIM) |
| `46340987` | Brief_eingehend | Sonstiges_Dokument | **Brief_eingehend bleibt** (klarmobil SIM) |
| `3d450bf2` | Brief_eingehend | Sonstiges_Dokument | **Brief_eingehend bleibt** (klarmobil SIM) |
| `e772372f` | Brief_eingehend | Sonstiges_Dokument | **Brief_eingehend bleibt** (klarmobil SIM) |

---

## Statistik nach neuer Kategorie

| Neue Kategorie | Anzahl Änderungen |
|----------------|-------------------|
| Bild | 35 |
| Eingangslieferschein | 20 |
| Personalunterlagen | 12 |
| Fahrzeugdokument | 8 |
| Brief_eingehend | 10 |
| Vertrag | 7 |
| Kassenbeleg | 7 |
| Kundenanfrage | 8 |
| Eingangsrechnung | 8 |
| Angebot | 5 |
| Formular | 4 |
| Produktdatenblatt | 3 |
| Sonstiges_Dokument | 3 |
| Auftragsbestaetigung | 2 |
| Serviceauftrag | 2 |
| Email_Ausgehend | 2 |
| Lieferantenangebot | 2 |
| Bestellung | 1 |
| Aufmassblatt | 3 |
| **GESAMT** | **~142** |

---

## Hauptfehlerquellen

1. **rule-Kategorisierung** (56.9% Fehlerrate!) - kategorisiert nach Ordnerpfad, nicht Inhalt
2. **Duplikate** - viele Dokumente mehrfach erfasst (Email-Anhang + Scan)
3. **Personalunterlagen** - Neue Kategorie, alte Docs noch nicht zugeordnet
4. **Fahrzeugdokument** - Neue Kategorie, alte Docs noch nicht zugeordnet
5. **WERU Liefer-/Abholavis** - werden als "Zahlungsavis" fehlkategorisiert

---

## RUNDE 2: Komplett-Prüfung aller 550 Docs (6 Agenten)

> Alle Dokumente nochmal geprüft - auch die 408 "bestätigten".
> Ergebnis: **13 zusätzliche Fehler** die der Backtest nicht fand (alt=neu, aber beide falsch)

### Neue Fehler (R2-NEU)

| # | Doc-ID | Aktuell | Richtig | OCR-Hinweis | Quelle |
|---|--------|---------|---------|-------------|--------|
| R1 | `8502e47e` | Montageauftrag | **Notiz** | Checkbox-Notizblatt Ersatzteile (Kurbelgetriebe, T-Schiene) | process-document-gpt |
| R2 | `c3e56f7e` | Eingangslieferschein | **Eingangsrechnung** | eBay RECHNUNG/PACKZETTEL Nr. 202602-2038, mit Preisen | process-document-gpt |
| R3 | `51910d8e` | Eingangslieferschein | **Eingangsrechnung** | eBay RECHNUNG/PACKZETTEL Nr. 202602-2108, mit Preisen | process-document-gpt |
| R4 | `35448475` | Eingangslieferschein | **Eingangsrechnung** | Handgeschrieben, "205 EUR", Preisangabe | manual-review |
| R5 | `d13ae3f8` | Aufmassblatt | **Notiz** | Outlook-Termin "Angebotsaufmass", eingebettete Maße | process-document-gpt |
| R6 | `8b0684c8` | Brief_ausgehend | **Brief_eingehend** | JHV-Einladung VON RS Innung AN JS Fenster | manual-review-k004 |
| R7 | `7d0686fd` | Brief_eingehend | **Formular** | Prüfbericht EN 50699, standardisiertes Formular | process-document-gpt |
| R8 | `32cf998f` | Brief_eingehend | **Fahrzeugdokument** | Email Auto Auers bzgl. Kfz-Zulassung/Vollmacht/SEPA | process-document-gpt |
| R9 | `81800def` | Brief_eingehend | **Brief_von_Finanzamt** | Hauptzollamt Regensburg, SEPA Kfz-Steuer | process-document-gpt |
| R10 | `13ee4582` | Formular | **Serviceauftrag** | JS Fenster Reparatur-Auftragsformular, Kunde David Goh | process-document-gpt |
| R11 | `6499f3d7` | Serviceauftrag | **Eingangsrechnung** | Elektrotechnik Färber Rechnung/Auftrag AN JS Fenster | process-document-gpt |
| R12 | `389f452c` | Eingangsrechnung | **Kassenbeleg** | Dr. Donnini TSE-Bon, Kassenbeleg-Daten | process-document-gpt |
| R13 | `92b1893b` | Auftragsbestaetigung | **Brief_ausgehend** | EIGENE AB 260036 von JS Fenster an Kunden Singer | process-document-gpt |

### Zielkategorie-Unstimmigkeiten (Prompt-Schwächen)

Einige Dokumente wurden von verschiedenen Agenten unterschiedlich kategorisiert:

| Doc-ID | Aktuell | Agent A sagt | Agent B sagt | Problem |
|--------|---------|-------------|-------------|---------|
| `0d113f3b` | Eingangsrechnung | Serviceauftrag | Kundenbestellung | Hausverwaltung erteilt Auftrag - was ist es? |
| `af3983c9` | Eingangsrechnung | Brief_eingehend | Gutschrift | IHK Guthabenbescheid - Brief oder Gutschrift? |
| `828e0d7b` | Eingangsrechnung | Kassenbeleg | Zahlungsavis | Anthropic Receipt - Bon oder Zahlungsbeleg? |
| `ca2b3cda` | Kundenlieferschein | Sonstiges_Dokument | Eingangslieferschein | GLS Retoure-Label |
| `07b7e275` | Bauplan | Sonstiges_Dokument | Auftragsbestaetigung | Birner Fenster Maße - techn. Auftragsdaten |
| `ef3cb5c6` | Auftragsbestaetigung | Brief_eingehend | Brief_ausgehend | Anwaltsschriftsatz (VON JS-Anwalt) |

### Prüfergebnisse Runde 2 pro Kategorie

| Kategorie | Geprüft | Korrekt | Falsch | Fehlerquote |
|-----------|---------|---------|--------|-------------|
| Montageauftrag | 100 | 99 | 1 | 1.0% |
| Eingangslieferschein | 82 | 78 | 4 | 4.9% |
| Eingangsrechnung | 55 | 37 | 18 | 32.7% |
| Auftragsbestaetigung | 48 | 26 | 22 | 45.8% |
| Aufmassblatt | 32 | 31 | 1 | 3.1% |
| Bauplan | 22 | 4 | 18 | 81.8% |
| Skizze | 1 | 1 | 0 | 0% |
| Brief_eingehend | 25 | 19 | 6 | 24% |
| Brief_ausgehend | 5 | 0 | 5 | 100% |
| Formular | 11 | 3 | 8 | 72.7% |
| Serviceauftrag | 13 | 11 | 2 | 15.4% |
| Notiz | 7 | 7 | 0 | 0% |
| Sonstiges_Dokument | 33 | 2 | 31 | 93.9% |
| Bild | 16 | 16 | 0 | 0% |
| Kassenbeleg | 8 | 8 | 0 | 0% |
| Zahlungsavis | 8 | 3 | 5 | 62.5% |
| Bestellung | 7 | 3 | 4 | 57.1% |
| Finanzierung | 8 | 6 | 2 | 25% |
| Kundenlieferschein | 4 | 1 | 3 | 75% |
| Vertrag | 6 | 5 | 1 | 16.7% |
| Produktdatenblatt | 12 | 11 | 1 | 8.3% |
| Kundenanfrage | 2 | 1 | 1 | 50% |
| Lieferantenangebot | 2 | 1 | 1 | 50% |
| Restliche (Angebot, Leasing, etc.) | ~23 | ~23 | 0 | 0% |
| **GESAMT** | **~550** | **~395** | **~155** | **~28%** |

---

## Prompt-Verbesserungen (nach Review)

### Identifizierte Schwächen im aktuellen Prompt v2.3.0:

1. **eBay Rechnung/Packzettel MIT Preisen** → wird als Eingangslieferschein statt Eingangsrechnung erkannt
   - Prompt-Rule nötig: "eBay Packzettel MIT Preisangaben/Rechnungsnummer = Eingangsrechnung"

2. **Eigene JS-Fenster-Dokumente** (AB, Angebote) → werden nicht als ausgehend erkannt
   - Prompt sollte: "Absender JS Fenster = ausgehendes Dokument (Angebot, Brief_ausgehend)"

3. **Prüfberichte** (EN 50699 etc.) → werden als Brief statt Formular erkannt
   - Prompt-Rule: "Standardisierte Prüfberichte nach EN/DIN-Norm = Formular"

4. **Hauptzollamt/Zoll** → wird als Brief statt Brief_von_Finanzamt erkannt
   - Prompt-Rule: "Hauptzollamt/Zoll = Brief_von_Finanzamt"

5. **Kfz-Zulassung/eVB in Emails** → wird nicht als Fahrzeugdokument erkannt
   - Prompt braucht: "Email mit Kfz-Zulassung/Vollmacht/eVB = Fahrzeugdokument"

6. **Reparatur-Auftragsformulare** → werden als Formular statt Serviceauftrag erkannt
   - Prompt: "Auftragsformular Reparatur/Wartung MIT Kundenname = Serviceauftrag"

7. **Outlook-Termine mit Maßen** → werden als Aufmassblatt statt Notiz erkannt
   - Prompt: "Outlook-Kalendereinträge ohne Formular-Struktur = Notiz"

8. **Hausverwaltung Auftragserteilung** → unklar ob Kundenbestellung oder Serviceauftrag
   - Prompt muss klären: "Auftragserteilung von Kunde = Kundenbestellung"

---

*Generiert am 2026-02-24 von K-006 Review-Agenten (Runde 1: 4 Agenten, Runde 2: 6 Agenten)*
