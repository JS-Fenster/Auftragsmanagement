# K-006: Kategorisierungs-Backtest Report

## Meta
- **Datum:** 2026-02-23
- **Prompt-Version:** v2.3.0 (process-document v37)
- **GPT-Modell:** gpt-5-mini
- **Start:** 2026-02-23 16:42:59
- **Ende:** 2026-02-23 17:33:42
- **Dauer:** 50.7 Minuten

## Zusammenfassung (nach Retry der 20 Timeout-Docs)

| Metrik | Wert |
|--------|------|
| Dokumente gesamt | 550 |
| Unverändert (Kategorie bestätigt) | 399 (72.5%) |
| **Geändert (neue Kategorie vorgeschlagen)** | **151 (27.5%)** |
| Fehler | 0 |
| Davon: Sonstiges_Dokument → echte Kategorie | 40 |
| Davon: echte Kategorie → Sonstiges_Dokument | 3 |

## Änderungen nach Typ (67 verschiedene)

| Alt → Neu | Anzahl | Bewertung |
|-----------|--------|-----------|
| Sonstiges_Dokument → Bild | 31 | TODO |
| Auftragsbestaetigung → Vertrag | 7 | TODO |
| Eingangsrechnung → Eingangslieferschein | 6 | TODO |
| Bauplan → Kundenanfrage | 4 | TODO |
| Formular → Personalunterlagen | 4 | TODO |
| Auftragsbestaetigung → Eingangsrechnung | 4 | TODO |
| Auftragsbestaetigung → Eingangslieferschein | 3 | TODO |
| Reiseunterlagen → Brief_eingehend | 3 | TODO |
| Bestellung → Eingangsrechnung | 3 | TODO |
| Bauplan → Angebot | 3 | TODO |
| Zahlungsavis → Brief_eingehend | 3 | TODO |
| Serviceauftrag → Formular | 2 | TODO |
| Sonstiges_Dokument → Produktdatenblatt | 2 | TODO |
| Eingangsrechnung → Serviceauftrag | 2 | TODO |
| Serviceauftrag → Montageauftrag | 2 | TODO |
| Eingangsrechnung → Personalunterlagen | 2 | TODO |
| Eingangsrechnung → Lieferantenangebot | 2 | TODO |
| Produktdatenblatt → Brief_eingehend | 2 | TODO |
| Auftragsbestaetigung → Produktdatenblatt | 2 | TODO |
| Auftragsbestaetigung → Kundenanfrage | 2 | TODO |
| Bauplan → Sonstiges_Dokument | 2 | TODO |
| Bauplan → Brief_eingehend | 2 | TODO |
| Auftragsbestaetigung → Brief_eingehend | 2 | TODO |
| Finanzierung → Brief_eingehend | 2 | TODO |
| Finanzierung → Personalunterlagen | 2 | TODO |
| Sonstiges_Dokument → Fahrzeugdokument | 2 | TODO |
| Brief_ausgehend → Angebot | 2 | TODO |
| Eingangslieferschein → Eingangsrechnung | 2 | TODO |
| Brief_eingehend → Formular | 1 | TODO |
| Formular → Brief_eingehend | 1 | TODO |
| Bild → Produktdatenblatt | 1 | TODO |
| Sonstiges_Dokument → Skizze | 1 | TODO |
| Eingangsrechnung → Kassenbeleg | 1 | TODO |
| Brief_ausgehend → Email_Ausgehend | 1 | TODO |
| Sonstiges_Dokument → Notiz | 1 | TODO |
| Bestellung → Eingangslieferschein | 1 | TODO |
| Bauplan → Eingangslieferschein | 1 | TODO |
| Bauplan → Auftragsbestaetigung | 1 | TODO |
| Produktdatenblatt → Formular | 1 | TODO |
| Eingangsrechnung → Formular | 1 | TODO |
| Bauplan → Vertrag | 1 | TODO |
| Auftragsbestaetigung → Brief_ausgehend | 1 | TODO |
| Kundenlieferschein → Eingangslieferschein | 1 | TODO |
| Kundenlieferschein → Fahrzeugdokument | 1 | TODO |
| Auftragsbestaetigung → Serviceauftrag | 1 | TODO |
| Bestellung → Vertrag | 1 | TODO |
| Brief_eingehend → Zahlungsavis | 1 | TODO |
| Brief_eingehend → Vertrag | 1 | TODO |
| Brief_eingehend → Fahrzeugdokument | 1 | TODO |
| Serviceauftrag → Fahrzeugdokument | 1 | TODO |
| Lieferantenangebot → Bestellung | 1 | TODO |
| Kundenanfrage → Brief_eingehend | 1 | TODO |
| Zahlungsavis → Eingangsrechnung | 1 | TODO |
| Formular → Eingangslieferschein | 1 | TODO |
| Kundenlieferschein → Sonstiges_Dokument | 1 | TODO |
| Bauplan → Aufmassblatt | 1 | TODO |
| Vertrag → Brief_eingehend | 1 | TODO |
| Sonstiges_Dokument → Kassenbeleg | 1 | TODO |
| Formular → Serviceauftrag | 1 | TODO |
| Brief_eingehend → Brief_ausgehend | 1 | TODO |
| Montageauftrag → Aufmassblatt | 1 | TODO |
| Eingangsrechnung → Auftragsbestaetigung | 1 | TODO |
| Gutschrift → Eingangslieferschein | 1 | TODO |
| Eingangsrechnung → Brief_eingehend | 1 | TODO |
| Montageauftrag → Formular | 1 | TODO |
| Kundenanfrage → Aufmassblatt | 1 | TODO |
| Notiz → Brief_eingehend | 1 | TODO |

## Detail: Alle vorgeschlagenen Änderungen

> **WICHTIG:** Diese Änderungen wurden noch NICHT angewendet (dry-run).
> Bitte prüfen und Problemfälle markieren, bevor wir apply=true laufen lassen.

### Sonstiges_Dokument → Bild (31x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 1 | `2d32c770` | 2026-01-20T09-08-05-554Z_G.S.8.jpg | process-document-gpt | niedrig | |
| 2 | `95be9930` | 2026-01-20T09-03-48-782Z_Brilz2.jpg | process-document-gpt | niedrig | |
| 3 | `9889d8f2` | 2026-01-20T09-07-53-933Z_G.S.7.jpg | process-document-gpt | niedrig | |
| 4 | `a5068ba3` | 2026-01-20T09-18-25-077Z_Kistner2.jpg | process-document-gpt | niedrig | |
| 5 | `d0247771` | 2026-01-20T08-59-48-639Z_Busch2.jpg | process-document-gpt | niedrig | |
| 6 | `d8b8be77` | 2026-01-20T09-18-54-607Z_Kistner5.jpg | process-document-gpt | niedrig | |
| 7 | `f233480c` | 2026-01-20T09-11-28-112Z_Montsho2.jpg | process-document-gpt | niedrig | |
| 8 | `ba0b174e` | 2026-01-20T09-19-40-176Z_Kistner2.jpg | process-document-gpt | niedrig | |
| 9 | `1bfd8213` | 2026-01-21T08-53-44-781Z_9.jpg | process-document-gpt | niedrig | |
| 10 | `20e4b981` | 2026-01-21T08-52-24-730Z_1.jpg | process-document-gpt | niedrig | |
| 11 | `a0dee56a` | 2026-01-21T09-32-24-682Z_6.jpg | process-document-gpt | niedrig | |
| 12 | `ed8fba4e` | 2026-01-21T08-52-35-829Z_2.jpg | process-document-gpt | niedrig | |
| 13 | `58ac3a3d` | 2026-01-22T07-39-26-758Z_1.jpg | process-document-gpt | niedrig | |
| 14 | `e933aaa8` | 2026-01-22T07-39-37-681Z_2.jpg | process-document-gpt | niedrig | |
| 15 | `49fe0f46` | 1000089649.jpg | process-document-gpt | niedrig | |
| 16 | `62a23458` | IMG-20260122-WA0005.jpg | process-document-gpt | niedrig | |
| 17 | `d194f838` | IMG-20260122-WA0003.jpg | process-document-gpt | niedrig | |
| 18 | `1d796773` | IMG-20260123-WA0009.jpg | process-document-gpt | niedrig | |
| 19 | `38d60709` | 1000089650.jpg | process-document-gpt | niedrig | |
| 20 | `d1b0a9f4` | IMG-20260127-WA0003.jpg | process-document-gpt | niedrig | |
| 21 | `45b8dd8f` | 20260127_140027.jpg | process-document-gpt | niedrig | |
| 22 | `7666da62` | 2026-01-29T13-56-03-112Z_DKF_Beschlag.jpg | process-document-gpt | niedrig | |
| 23 | `026ea30c` | 2026-02-05T10-00-24-260Z_1.jpg | process-document-gpt | niedrig | |
| 24 | `46c07f5e` | 2026-02-05T10-00-46-160Z_3.jpg | process-document-gpt | niedrig | |
| 25 | `327cd65f` | 20260206_125801_copy_1200x1600.jpg | process-document-gpt | niedrig | |
| 26 | `af2cbad0` | 20260206_125801_copy_1200x1600.jpg | process-document-gpt | niedrig | |
| 27 | `e2504e7b` | 20260206_125801_copy_1200x1600.jpg | process-document-gpt | niedrig | |
| 28 | `7a9cf18f` | IMG_20260130_102843.jpg | process-document-gpt | niedrig | |
| 29 | `502537d8` | 1000086353.jpg | process-document-gpt | niedrig | |
| 30 | `b79089e3` | 1000086355.jpg | process-document-gpt | niedrig | |
| 31 | `d13a56ed` | 1000086356.jpg | process-document-gpt | niedrig | |

### Auftragsbestaetigung → Vertrag (7x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 32 | `68fcd7f0` | Allgemeine_Geschaeftsbedingungen.pdf | rule | mittel | |
| 33 | `aa6ab7aa` | Ehrenreich_GmbH_Vertragsbedingungen_mit_QNG_und_DGNB.pdf | rule | mittel | |
| 34 | `cac9edeb` | Liefer-und_Zahlungsbedingungen.pdf | rule | mittel | |
| 35 | `0726efbc` | Ehrenreich_GmbH_Vertragsbedingungen_mit_QNG_und_DGNB.pdf | rule | mittel | |
| 36 | `08e21f3e` | Allgemeine_Geschaeftsbedingungen.pdf | rule | mittel | |
| 37 | `3b1252bc` | Vorvertragliche_Pflichtinformationen.pdf | rule | mittel | |
| 38 | `6454ff29` | Vorvertragliche_Pflichtinformationen.pdf | rule | mittel | |

### Eingangsrechnung → Eingangslieferschein (6x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 39 | `4228c058` | 20260206_125728_copy_1200x1600.jpg | rule | mittel | |
| 40 | `5a3d7f2c` | 20260206_125728_copy_1200x1600.jpg | rule | mittel | |
| 41 | `5c247bff` | 20260206_125728_copy_1200x1600.jpg | rule | mittel | |
| 42 | `765d3e82` | 20260206_12575copy_1200x1600.jpg | rule | niedrig | |
| 43 | `c9db1a11` | 20260206_125750_copy_1200x1600.jpg | rule | niedrig | |
| 44 | `d0f201b0` | 20260206_125728_copy_1200x1600.jpg | rule | mittel | |

### Bauplan → Kundenanfrage (4x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 45 | `d554ed5a` | Anfrage_BV_Kinderkrippe_Kastl.pdf | rule | mittel | |
| 46 | `7c599868` | 2026-007_VE55_Sonnenschutz_Gb.3_Anfrage_LV.pdf | rule | mittel | |
| 47 | `a4f95e7f` | 2026-007_VE55_Sonnenschutz_Gb.2_Anfrage_LV.pdf | rule | mittel | |
| 48 | `f18d2e75` | 2026-007_VE55_Sonnenschutz_Gb.1_Anfrage_LV.pdf | rule | mittel | |

### Formular → Personalunterlagen (4x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 49 | `0526f452` | 2026-02-04T10-36-22-016Z_20260204114947.pdf | process-document-gpt | mittel | |
| 50 | `6a20a3e7` | 2026-02-04T10-36-37-399Z_20260204115003.pdf | process-document-gpt | mittel | |
| 51 | `6dbe2dba` | 2026-02-04T10-36-53-169Z_20260204115019.pdf | process-document-gpt | mittel | |
| 52 | `ee58aca2` | 2026-02-05T10-23-31-851Z_20260205113645.pdf | process-document-gpt | mittel | |

### Auftragsbestaetigung → Eingangsrechnung (4x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 53 | `7bfba6d2` | RE245253-2026_303464_AU548626-202602_1000102870.pdf | rule | hoch | |
| 54 | `42f91ef4` | Rechnung_5202656496_2026_02.pdf | rule | hoch | |
| 55 | `a2445721` | Rechnung_5202656496_2026_02.pdf | rule | hoch | |
| 56 | `e63f1bba` | Rechnung_Rechnung_5202656496.pdf | rule | hoch | |

### Auftragsbestaetigung → Eingangslieferschein (3x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 57 | `4d5e49f4` | 2026-01-29T08-19-45-362Z_20260129093300.pdf | process-document-gpt | hoch | |
| 58 | `2554d43e` | Lieferschein_n.86022473.PDF | rule | hoch | |
| 59 | `70a438db` | Lieferschein_AU548626-202602-001.pdf | rule | hoch | |

### Reiseunterlagen → Brief_eingehend (3x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 60 | `f736cde8` | expertentag_2026_einladungskarte.pdf | process-document-gpt | mittel | |
| 61 | `164ecb8e` | Einladung_zum_Kundentag_-_11.02.2026.pdf | rule | mittel | |
| 62 | `ad50cb2b` | expertentag_2026_einladungskarte.pdf | process-document-gpt | hoch | |

### Bestellung → Eingangsrechnung (3x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 63 | `00d62efd` | Invoice_453444.pdf | rule | hoch | |
| 64 | `b665be29` | 225797000318.PDF | rule | hoch | |
| 65 | `c677a7f3` | Invoice_453453.pdf | rule | hoch | |

### Bauplan → Angebot (3x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 66 | `b8647602` | 20260124_Angebot_Fenster_geschwaerzt.pdf | rule | mittel | |
| 67 | `45a95689` | Angebot_260076.pdf | rule | mittel | |
| 68 | `8c31f749` | Angebot_250306.pdf | rule | hoch | |

### Zahlungsavis → Brief_eingehend (3x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 69 | `f13a383a` | AvisTemp.pdf | process-document-gpt | hoch | |
| 70 | `9f1d8739` | AvisTemp.pdf | process-document-gpt | hoch | |
| 71 | `9300d700` | AvisTemp.pdf | process-document-gpt | hoch | |

### Serviceauftrag → Formular (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 72 | `6499f3d7` | 2026-01-16T08-33-07-860Z_20260116094603.pdf | process-document-gpt | mittel | |
| 73 | `c1e01278` | 2026-01-21T12-48-18-758Z_20260121140126.pdf | process-document-gpt | hoch | |

### Sonstiges_Dokument → Produktdatenblatt (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 74 | `b7b3cb54` | 2026-01-16T08-04-48-506Z_20260116091807.pdf | process-document-gpt | niedrig | |
| 75 | `1481f1e9` | 2026-01-20T09-08-22-310Z_G.S.9.jpg | process-document-gpt | niedrig | |

### Eingangsrechnung → Serviceauftrag (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 76 | `ccd3608e` | 2026-01-16T08-32-43-728Z_20260116094551.pdf | process-document-gpt | mittel | |
| 77 | `0d113f3b` | 2026_01_-_WEG_Pfarrer-Drexler-Str._1-5__Amberg_-_Haus-Nr._5__WE_2_-_Instandsetzung_Rollladen_Wohnzimmer.pdf | rule | hoch | |

### Serviceauftrag → Montageauftrag (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 78 | `fcb89b4e` | 2026-01-20T09-18-41-529Z_Kistner3.jpg | process-document-gpt | mittel | |
| 79 | `6ff9ab28` | 2026-01-22T10-15-00-120Z_20260122112822.pdf | process-document-gpt | hoch | |

### Eingangsrechnung → Personalunterlagen (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 80 | `071a72ae` | lovor.pdf | rule | mittel | |
| 81 | `75ca609f` | 10_Brutto_Netto-Abrechnung_01_2026___J.S.pdf | rule | mittel | |

### Eingangsrechnung → Lieferantenangebot (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 82 | `683f9944` | Hauptwetter_26.pdf | rule | mittel | |
| 83 | `3398d3df` | Hauptwetter_26.pdf | rule | mittel | |

### Produktdatenblatt → Brief_eingehend (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 84 | `3ea3db2d` | 20230615_Bauteiliste_Fenster.pdf | rule | mittel | |
| 85 | `2f38a81c` | Resume__1_.pdf | rule | mittel | |

### Auftragsbestaetigung → Produktdatenblatt (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 86 | `4ba25726` | 005CAN00120260126070423.pdf | rule | hoch | |
| 87 | `f529848a` | 005CAN00120260126070229.pdf | rule | hoch | |

### Auftragsbestaetigung → Kundenanfrage (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 88 | `2e374734` | LV_Fenster_-_Rolllaeden.pdf | rule | hoch | |
| 89 | `c6e363e8` | LV_Fenster___Rolllaeden.pdf | rule | hoch | |

### Bauplan → Sonstiges_Dokument (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 90 | `404a20a2` | Bau-___Leistungsbeschreibung_MFH_Weichser_Breiten_7_WE.pdf | rule | mittel | |
| 91 | `60ab3bbf` | Screenshot_2026-02-06_095433.png | rule | mittel | |

### Bauplan → Brief_eingehend (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 92 | `c971396c` | 20260123_Schreiben_an_Generali.pdf | rule | hoch | |
| 93 | `19e33f6e` | Softwareentwicklung_-_Embedded_Systems_-_Ronnel_Foyet_Nithieug.pdf | rule | mittel | |

### Auftragsbestaetigung → Brief_eingehend (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 94 | `ccfdedc3` | Anschreiben_Lieferzeiten_26.01.2026.pdf | rule | hoch | |
| 95 | `77d2e5d6` | Anschreiben_Lieferzeiten_09.02.2026.pdf | rule | hoch | |

### Finanzierung → Brief_eingehend (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 96 | `30d3a1e6` | 2026-01-30T08-36-04-105Z_20260130094923.pdf | process-document-gpt | hoch | |
| 97 | `4b7d1787` | 2026-02-05T12-51-51-094Z_20260205140513.pdf | process-document-gpt | hoch | |

### Finanzierung → Personalunterlagen (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 98 | `7fb9546b` | 10_Brutto_Netto-Abrechnung_01_2026___J.S.pdf | rule | mittel | |
| 99 | `e85ddcf9` | 10_Brutto_Netto-Abrechnung_01_2026___J.S.pdf | rule | mittel | |

### Sonstiges_Dokument → Fahrzeugdokument (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 100 | `305480b3` | 2026-01-30T10-57-46-791Z_20260130121046.pdf | process-document-gpt | mittel | |
| 101 | `9321ebb5` | 2026-01-30T10-57-14-374Z_20260130121031.pdf | process-document-gpt | mittel | |

### Brief_ausgehend → Angebot (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 102 | `a988d4d8` | 2026-02-11T15-47-23-901Z_PDF_2_11022026_0001.pdf | manual-review-k004 | niedrig | |
| 103 | `f387333f` | 2026-02-11T15-45-14-716Z_PDF_2_11022026_0001.pdf | manual-review-k004 | niedrig | |

### Eingangslieferschein → Eingangsrechnung (2x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 104 | `51910d8e` | 2026-02-23T09-29-36-520Z_RE_Beschlagswelten2.pdf | manual-review-k005 | niedrig | |
| 105 | `c3e56f7e` | 2026-02-23T09-28-36-836Z_RE_Beschlagswelten.pdf | manual-review-k005 | niedrig | |

### Brief_eingehend → Formular (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 106 | `7d0686fd` | 2026-01-16T08-28-56-638Z_20260116094157.pdf | process-document-gpt | hoch | |

### Formular → Brief_eingehend (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 107 | `c263fc42` | 2026-01-16T08-28-38-658Z_20260116094147.pdf | process-document-gpt | hoch | |

### Bild → Produktdatenblatt (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 108 | `a3d0d07f` | 2026-01-20T09-20-47-200Z_Kistner_DKF_ZB.pdf | process-document-gpt | niedrig | |

### Sonstiges_Dokument → Skizze (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 109 | `345efeed` | 2026-01-22T07-40-22-113Z_Dichtung_Schroether.pdf | process-document-gpt | niedrig | |

### Eingangsrechnung → Kassenbeleg (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 110 | `8011e8bb` | 2026-01-22T09-55-08-617Z_PDF_2_22012026.pdf | process-document-gpt | mittel | |

### Brief_ausgehend → Email_Ausgehend (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 111 | `f9fb25f0` | 2026-01-22T11-00-57-110Z_20260122121417.pdf | process-document-gpt | hoch | |

### Sonstiges_Dokument → Notiz (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 112 | `5cff21d3` | 1000090039.jpg | process-document-gpt | niedrig | |

### Bestellung → Eingangslieferschein (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 113 | `78324f3e` | Wuerth_Lieferschein_8141349399.pdf | rule | hoch | |

### Bauplan → Eingangslieferschein (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 114 | `8abd7303` | VK_Lieferavise__WKSHCD.pdf | rule | mittel | |

### Bauplan → Auftragsbestaetigung (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 115 | `7e541b9d` | 6410009808-2026-01-23.PDF | rule | hoch | |

### Produktdatenblatt → Formular (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 116 | `8dc24a94` | Freigabeliste_Fenster.pdf | rule | mittel | |

### Eingangsrechnung → Formular (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 117 | `cd56c872` | Anmeldung_Planungswettbewerbe_erfolgreich_durchfuehren.pdf | rule | hoch | |

### Bauplan → Vertrag (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 118 | `154ed388` | MFH_Sonnenstrasse_10_WE__Stand_22.10.2025.pdf | rule | mittel | |

### Auftragsbestaetigung → Brief_ausgehend (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 119 | `ef3cb5c6` | 20260122_SS_an_AG_Amberg.pdf | rule | hoch | |

### Kundenlieferschein → Eingangslieferschein (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 120 | `8bc44f29` | 2026-02-02T11-03-51-404Z_20260202121651.pdf | process-document-gpt | niedrig | |

### Kundenlieferschein → Fahrzeugdokument (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 121 | `929fe9cc` | 2026-02-02T09-53-43-903Z_20260202110708.pdf | process-document-gpt | hoch | |

### Auftragsbestaetigung → Serviceauftrag (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 122 | `ceee8aa4` | 2026-02-03T14-54-48-027Z_20260203160715.pdf | rule | mittel | |

### Bestellung → Vertrag (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 123 | `0ed96340` | 2026-02-05T09-22-34-689Z_20260205103533.pdf | process-document-gpt | mittel | |

### Brief_eingehend → Zahlungsavis (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 124 | `75b30ba4` | 2026-02-05T09-30-35-378Z_20260205104356.pdf | process-document-gpt | hoch | |

### Brief_eingehend → Vertrag (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 125 | `fd51f701` | 2026-02-05T09-54-03-242Z_20260205110728.pdf | process-document-gpt | hoch | |

### Brief_eingehend → Fahrzeugdokument (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 126 | `a437304a` | 2026-02-05T12-45-44-280Z_20260205135844.pdf | process-document-gpt | mittel | |

### Serviceauftrag → Fahrzeugdokument (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 127 | `b52bc1c0` | 2026-02-05T13-15-04-383Z_20260205142811.pdf | process-document-gpt | hoch | |

### Lieferantenangebot → Bestellung (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 128 | `6a55ea24` | 20260206_125750_copy_1200x1600.jpg | process-document-gpt | mittel | |

### Kundenanfrage → Brief_eingehend (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 129 | `02b81e3a` | Elektro-_und_Elektronikingenieur_-_Ayoob_Qayaji.pdf | process-document-gpt | mittel | |

### Zahlungsavis → Eingangsrechnung (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 130 | `657fc98e` | Receipt-2949-3830-8175.pdf | process-document-gpt | hoch | |

### Formular → Eingangslieferschein (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 131 | `c8b53c75` | Lieferschein_AU548626-202602-001.pdf | process-document-gpt | mittel | |

### Kundenlieferschein → Sonstiges_Dokument (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 132 | `ca2b3cda` | Return_Label_1770392155691_317.pdf | process-document-gpt | mittel | |

### Bauplan → Aufmassblatt (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 133 | `07b7e275` | Birner_Fenster_Masse.pdf | rule | mittel | |

### Vertrag → Brief_eingehend (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 134 | `44061970` | eVB_GVGJVKJ_J.S._Fenster___Tueren_GmbH.pdf | manual-review-k004 | niedrig | |

### Sonstiges_Dokument → Kassenbeleg (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 135 | `e2c83354` | 2026-02-11T07-06-36-212Z_PDF_2_11022026.pdf | process-document-gpt | ? | |

### Formular → Serviceauftrag (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 136 | `13ee4582` | 2026-02-12T08-02-47-135Z_20260212091507.pdf | process-document-gpt | niedrig | |

### Brief_eingehend → Brief_ausgehend (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 137 | `29c48705` | JHV_-_EL_27.03.-28.03.2026_1_Blatt.pdf | manual-review-k004 | niedrig | |

### Montageauftrag → Aufmassblatt (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 138 | `b476ce02` | 2026-02-12T11-31-25-649Z_20260212124351.pdf | manual-review-k004 | niedrig | |

### Eingangsrechnung → Auftragsbestaetigung (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 139 | `e012d7d3` | 2026-02-18T10-41-43-823Z_20260218115447.pdf | manual-review-k004 | niedrig | |

### Gutschrift → Eingangslieferschein (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 140 | `07495f11` | 2026-02-20T10-00-45-390Z_20260220111140.pdf | manual-review-k004 | niedrig | |

### Eingangsrechnung → Brief_eingehend (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 141 | `af3983c9` | 2026-02-20T10-21-17-205Z_20260220113420.pdf | manual-review-k004 | niedrig | |

### Montageauftrag → Formular (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 142 | `8502e47e` | 2026-02-23T07-46-25-980Z_20260223085911.pdf | manual-review-k005 | niedrig | |

### Kundenanfrage → Aufmassblatt (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 143 | `41fe41a4` | 2026-02-23T10-14-57-265Z_20260223112741.pdf | manual-review-k005 | niedrig | |

### Notiz → Brief_eingehend (1x)

| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |
|---|--------|-----------|------------|-------|--------|
| 144 | `b60d827a` | 2026-02-23T14-25-19-730Z_20260223153809.pdf | process-document-gpt | niedrig | |

## Retry Batch 13 (20 Docs, vorher HTTP 504 Timeout)

Die 20 Docs wurden in 2x10er Batches erfolgreich nachgeholt. Ergebnis: 7 weitere Änderungen.

| Doc-ID | Alt | Neu | Geändert |
|--------|-----|-----|----------|
| `3278b5bc` | Brief_eingehend | Brief_eingehend | - |
| `389f452c` | Eingangsrechnung | Eingangsrechnung | - |
| `3a896af5` | Bild | Bild | - |
| `4e270ee3` | Sonstiges_Dokument | Sonstiges_Dokument | - |
| `6d6a6b68` | Kundenlieferschein | **Eingangslieferschein** | JA |
| `705ea69f` | Eingangslieferschein | Eingangslieferschein | - |
| `707d4e22` | Eingangslieferschein | Eingangslieferschein | - |
| `73588d88` | Sonstiges_Dokument | **Eingangsrechnung** | JA |
| `77d0bb6e` | Bauplan | **Kassenbeleg** | JA |
| `8b25425a` | Produktdatenblatt | **Bild** | JA |
| `8cf494ad` | Aufmassblatt | Aufmassblatt | - |
| `94c065fc` | Formular | Formular | - |
| `99e086f6` | Aufmassblatt | Aufmassblatt | - |
| `a332bc30` | Bauplan | **Kassenbeleg** | JA |
| `b12cf27e` | Produktdatenblatt | Produktdatenblatt | - |
| `b5799137` | Aufmassblatt | Aufmassblatt | - |
| `b7d2fc05` | Sonstiges_Dokument | **Bild** | JA |
| `c2a873b4` | Eingangslieferschein | Eingangslieferschein | - |
| `c979d447` | Bild | Bild | - |
| `d8f58d09` | Bauplan | **Kassenbeleg** | JA |

## Fehlerrate nach Quelle

| Kategorisiert von | Gesamt | Geändert | Rate |
|-------------------|--------|----------|------|
| process-document-gpt | 383 | 74 | 19.3% |
| rule | 102 | 58 | 56.9% |
| manual-review-k004 | 39 | 8 | 20.5% |
| manual-review-k005 | 17 | 4 | 23.5% |
| manual-review | 9 | 0 | 0.0% |

## Analyse und Empfehlungen

### Quelle "rule" hat hoechste Fehlerrate (56.9%)
Die 102 Dokumente die per Heuristik-Regel kategorisiert wurden, haben die mit Abstand schlechteste Trefferquote. 58 davon wuerden vom v37-Prompt anders klassifiziert. **Empfehlung:** Diese 58 Aenderungen im Detail pruefen und bei Korrektheit uebernehmen.

### Sonstiges_Dokument: 40 bekommen echte Kategorie
Von den 258 Sonstiges_Dokument-Eintraegen wurden 40 vom neuen Prompt einer echten Kategorie zugewiesen:
- 32x → Bild (JPGs mit kaum OCR-Text - korrekt)
- 2x → Produktdatenblatt
- 2x → Fahrzeugdokument (NEUE Kategorie!)
- 1x → Eingangsrechnung
- 1x → Skizze
- 1x → Notiz
- 1x → Kassenbeleg

### Potenzielle Problemfaelle (zum manuellen Pruefen)
Diese Aenderungen sind verdaechtig und sollten manuell geprueft werden:
1. **Auftragsbestaetigung → Vertrag (7x)** - Koennten vorvertragliche Pflichtinfos sein (korrekt) ODER falsch
2. **Bauplan → Kassenbeleg (3x via "rule")** - Sehr ungewoehnlicher Wechsel, Regel war vermutlich falsch
3. **Bauplan → Kundenanfrage (4x)** - Ausschreibungen? Prompt-Verbesserung greift
4. **Eingangsrechnung → Eingangslieferschein (6x)** - Packzettel ohne Preise? Neue Regel greift
5. **Bestellung → Eingangsrechnung (3x)** - Verdaechtig, muss geprueft werden
6. **Reiseunterlagen → Brief_eingehend (3x)** - Waren die ueberhaupt Reiseunterlagen?
7. **Zahlungsavis → Brief_eingehend (3x)** - Waren das wirklich Zahlungsavise?
8. **Finanzierung → Personalunterlagen (2x)** - NEUE Kategorie greift evtl. falsch?
9. **Eingangsrechnung → Personalunterlagen (2x)** - Lohnabrechnungen? Pruefenswert

### Sichere Aenderungen (wahrscheinlich korrekt)
- **Sonstiges_Dokument → Bild (32x)** - JPGs mit niedrig-OCR, fast sicher korrekt
- **Formular → Personalunterlagen (4x)** - Neue Kategorie greift, wahrscheinlich Stundenzettel etc.
- **Brief_eingehend → Fahrzeugdokument (1x)** - Neue Kategorie fuer KFZ-Unterlagen

### Naechste Schritte
1. Andreas prueft die 9 Problemfall-Gruppen (ca. 35 Docs) manuell
2. Sichere Aenderungen (ca. 40-50 Docs) koennen direkt uebernommen werden
3. Danach: apply=true auf bestaetigte Aenderungen
4. Optional: "rule"-kategorisierte Docs komplett neu bewerten

---
*Generiert von backtest-kategorisierung-k006.js + manuellem Retry (Batch 13)*
*Analysiert am 2026-02-23*
