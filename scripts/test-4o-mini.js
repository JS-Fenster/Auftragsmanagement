// Load dotenv from backend directory
require('../backend/node_modules/dotenv').config({ path: './backend/.env' });
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY nicht gefunden!');
  process.exit(1);
}

const OCR_TEXT = `J.S. Fenster & Türen
Ihr Fachbetrieb für Fenster und Türen

Regensburger Straße 59, 92224 Amberg

Tel: 09621 / 76 35 33
Fax: 09621 / 78 32 5'
Mail: info@js-fenster.de

# Aufmaßblatt Fenster

|  Kunde | Baustelle | Seite  |
| --- | --- | --- |
|  Metschel Markus | e-m@iled 27. NOV. 1975 | 1  |

System: Dratex IDEAL NEO/AD

Farbe: Innen:
Außen: ![img-0.jpeg](img-0.jpeg)

AFB:

IFB:

Rollo: Pos. 2 Rollopanon Neu

Deckel:

Gurtaustritt: Wand ___ Leibung ___ Wickler ___

|  Montage Aufwand: Monteure 2 Stunden ___ Tage 1  |
| --- |
|  Notizen:  |

H/K/A Demontage ☑
Entsorgen ☑
Montage ☑
Versiegeln ___ Verleisten ___ Verputzen ☑

Neubau
Altbau
Angebot
Bestellung

Datum: 18.11.25 Wunschtermin:

Unterschrift:

|  Nr | Zimmer | außen Breite | außen Höhe | innen Breite | innen Höhe | Fertige Breite | Fertige Höhe | DIN |   | RL | Nutmaß | FBA | AFB bis Sturz | Bemerkung | AFB | IFB  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|   |   |   |   |   |   |   |   |  L | R  |   |   |   |   |   |   |   |
|  1 | K6 |  |  | 946 | 2045 | 935 | 2035 | ☑ |  |  |  |  |  | inkl. V40 water NET | Drucker/Kanal |   |
|  2 |  |  |  |  |  |  |  |  |  |  |  |  |  | Gosdlossen Füllung |  |   |
|  3 |  |  |  |  |  |  |  |  |  |  |  |  |  | einemontage mit DKK |  |   |
|  2 | 106 |  |  | 1001 | 2116 |  |  | ☑ | ☑ |  |  |  |  | im 652R 26 mm |  |   |
|  5 |  |  |  | 1060 | 1935 | 1035 | 1895 | ☑ | ☑ |  | +35 FA30 |  |  | inkl. v 180 water |  |   |
|  6 |  |  |  |  |  |  |  |  |  |  |  |  |  | FZ |  |   |
|  7 |  |  |  |  |  |  |  |  |  |  |  |  |  | 230 |  |   |`;

async function test() {
  console.log('GPT-4o-mini Test - Aufmassblatt OCR');
  console.log('=====================================\n');
  
  const start = Date.now();
  
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${OPENAI_API_KEY}` 
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'Extrahiere Aufmaßblatt-Daten als JSON. Korrigiere OCR-Fehler (z.B. "Dratex" -> "DRUTEX").' 
        },
        { role: 'user', content: OCR_TEXT }
      ],
      response_format: { type: 'json_object' }
    })
  });
  
  const data = await res.json();
  const duration = (Date.now() - start) / 1000;
  
  if (data.error) {
    console.log('FEHLER:', data.error.message);
    return;
  }
  
  console.log('Zeit:', duration.toFixed(2), 's');
  console.log('Tokens:', JSON.stringify(data.usage));
  console.log('\n--- ERGEBNIS ---\n');
  
  const result = JSON.parse(data.choices[0].message.content);
  console.log(JSON.stringify(result, null, 2));
  
  // Pruefe ob DRUTEX erkannt wurde
  console.log('\n--- PRUEFUNG ---');
  const jsonStr = JSON.stringify(result).toUpperCase();
  if (jsonStr.includes('DRUTEX')) {
    console.log('Hersteller DRUTEX: ERKANNT');
  } else if (jsonStr.includes('DRATEX')) {
    console.log('Hersteller DRUTEX: NICHT KORRIGIERT (immer noch "Dratex")');
  } else {
    console.log('Hersteller DRUTEX: NICHT GEFUNDEN');
  }
}

test().catch(err => console.error('Fehler:', err.message));
