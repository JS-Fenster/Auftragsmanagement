/**
 * GPT-5.2 TEST (reasoning: low) fÃ¼r AufmaÃŸblatt-OCR
 *
 * Testet verschiedene GPT-Modelle und Reasoning-Stufen
 * mit echtem OCR-Text aus einem AufmaÃŸblatt.
 *
 * Usage: node scripts/test-gpt-variants.js
 *
 * BenÃ¶tigt: OPENAI_API_KEY in .env oder Umgebungsvariable
 */

require('dotenv').config({ path: './backend/.env' });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('âŒ OPENAI_API_KEY nicht gefunden!');
  console.error('   Setze die Variable in backend/.env oder als Umgebungsvariable.');
  process.exit(1);
}

// Echter OCR-Text vom AufmaÃŸblatt (aus Supabase documents Tabelle)
const OCR_TEXT = `J.S. Fenster & TÃ¼ren
Ihr Fachbetrieb fÃ¼r Fenster und TÃ¼ren

Regensburger StraÃŸe 59, 92224 Amberg

Tel: 09621 / 76 35 33
Fax: 09621 / 78 32 5'
Mail: info@js-fenster.de

# AufmaÃŸblatt Fenster

|  Kunde | Baustelle | Seite  |
| --- | --- | --- |
|  Metschel Markus | e-m@iled 27. NOV. 1975 | 1  |

System: Dratex IDEAL NEO/AD

Farbe: Innen:
AuÃŸen: ![img-0.jpeg](img-0.jpeg)

AFB:

IFB:

Rollo: Pos. 2 Rollopanon Neu

Deckel:

Gurtaustritt: Wand ___ Leibung ___ Wickler ___

|  Montage Aufwand: Monteure 2 Stunden ___ Tage 1  |
| --- |
|  Notizen:  |

H/K/A Demontage â˜‘
Entsorgen â˜‘
Montage â˜‘
Versiegeln ___ Verleisten ___ Verputzen â˜‘

Neubau
Altbau
Angebot
Bestellung

Datum: 18.11.25 Wunschtermin:

Unterschrift:

|  Nr | Zimmer | auÃŸen Breite | auÃŸen HÃ¶he | innen Breite | innen HÃ¶he | Fertige Breite | Fertige HÃ¶he | DIN |   | RL | NutmaÃŸ | FBA | AFB bis Sturz | Bemerkung | AFB | IFB  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|   |   |   |   |   |   |   |   |  L | R  |   |   |   |   |   |   |   |
|  1 | K6 |  |  | 946 | 2045 | 935 | 2035 | â˜‘ |  |  |  |  |  | inkl. V40 water NET | Drucker/Kanal |   |
|  2 |  |  |  |  |  |  |  |  |  |  |  |  |  | Gosdlossen FÃ¼llung |  |   |
|  3 |  |  |  |  |  |  |  |  |  |  |  |  |  | einemontage mit DKK |  |   |
|  2 | 106 |  |  | 1001 | 2116 |  |  | â˜‘ | â˜‘ |  |  |  |  | im 652R 26 mm |  |   |
|  5 |  |  |  | 1060 | 1935 | 1035 | 1895 | â˜‘ | â˜‘ |  | +35 FA30 |  |  | inkl. v 180 water |  |   |
|  6 |  |  |  |  |  |  |  |  |  |  |  |  |  | FZ |  |   |
|  7 |  |  |  |  |  |  |  |  |  |  |  |  |  | 230 |  |   |`;

// System-Prompt fÃ¼r Budgetangebot-Strukturierung
const SYSTEM_PROMPT = `Du bist ein Experte fÃ¼r Fenster-AufmaÃŸblÃ¤tter bei J.S. Fenster & TÃ¼ren.

AUFGABE: Extrahiere alle relevanten Informationen aus dem OCR-Text und korrigiere offensichtliche OCR-Fehler.

REGELN:
- Korrigiere Tippfehler kontextuell (z.B. "Dratex" â†’ "DRUTEX", "Gosdlossen" â†’ "Geschlossene")
- Interpretiere Zimmer-KÃ¼rzel (K6 â†’ KG/Keller, 106 â†’ OG/Obergeschoss)
- MaÃŸe sind in mm (auch wenn nicht explizit angegeben)
- Nutze "fertige_breite/hoehe" wenn vorhanden, sonst "innen_breite/hoehe"
- Zeilen ohne eigene MaÃŸe gehÃ¶ren zur vorherigen Position (Zusatzinfo)

OUTPUT: Nur JSON, keine ErklÃ¤rung.`;

const JSON_SCHEMA = {
  type: "object",
  properties: {
    kunde: {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
        baustelle: { type: ["string", "null"] }
      },
      required: ["name", "baustelle"],
      additionalProperties: false
    },
    profil: {
      type: "object",
      properties: {
        hersteller: { type: ["string", "null"] },
        system: { type: ["string", "null"] },
        farbe_innen: { type: ["string", "null"] },
        farbe_aussen: { type: ["string", "null"] }
      },
      required: ["hersteller", "system", "farbe_innen", "farbe_aussen"],
      additionalProperties: false
    },
    elemente: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pos: { type: "number" },
          zimmer: { type: ["string", "null"] },
          breite_mm: { type: "number" },
          hoehe_mm: { type: "number" },
          typ: { type: "string", enum: ["fenster", "tuer", "hst", "psk", "balkontuer"] },
          din: { type: ["string", "null"], enum: ["L", "R", "LR", null] },
          bemerkung: { type: ["string", "null"] }
        },
        required: ["pos", "zimmer", "breite_mm", "hoehe_mm", "typ", "din", "bemerkung"],
        additionalProperties: false
      }
    },
    zubehoer: {
      type: "object",
      properties: {
        rollladen: { type: "boolean" },
        rollladen_details: { type: ["string", "null"] },
        afb: { type: "boolean" },
        ifb: { type: "boolean" }
      },
      required: ["rollladen", "rollladen_details", "afb", "ifb"],
      additionalProperties: false
    },
    montage: {
      type: "object",
      properties: {
        demontage: { type: "boolean" },
        montage: { type: "boolean" },
        entsorgung: { type: "boolean" },
        verputzen: { type: "boolean" }
      },
      required: ["demontage", "montage", "entsorgung", "verputzen"],
      additionalProperties: false
    },
    meta: {
      type: "object",
      properties: {
        datum: { type: ["string", "null"] },
        monteure: { type: ["number", "null"] },
        tage: { type: ["number", "null"] }
      },
      required: ["datum", "monteure", "tage"],
      additionalProperties: false
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    korrekturen: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["kunde", "profil", "elemente", "zubehoer", "montage", "meta", "confidence", "korrekturen"],
  additionalProperties: false
};

// Test-Varianten
// Test-Varianten - NUR GPT-5.2 mit low
const VARIANTS = [
  { name: 'GPT-5.2 (low)', model: 'gpt-5.2', reasoning: 'low' },
];

async function testVariant(variant) {
  const startTime = Date.now();

  const requestBody = {
    model: variant.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Analysiere dieses AufmaÃŸblatt:\n\n${OCR_TEXT}` }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'aufmassblatt_extraction',
        strict: true,
        schema: JSON_SCHEMA
      }
    }
  };

  // Reasoning nur fÃ¼r GPT-5.x Modelle
  if (variant.reasoning && variant.model.startsWith('gpt-5')) {
    requestBody.reasoning = { effort: variant.reasoning };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        variant: variant.name,
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        duration
      };
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    const parsed = JSON.parse(content);

    // Token-Verbrauch
    const usage = result.usage || {};

    return {
      variant: variant.name,
      success: true,
      duration,
      tokens: {
        prompt: usage.prompt_tokens || 0,
        completion: usage.completion_tokens || 0,
        reasoning: usage.completion_tokens_details?.reasoning_tokens || 0,
        total: usage.total_tokens || 0
      },
      result: parsed
    };
  } catch (error) {
    return {
      variant: variant.name,
      success: false,
      error: error.message,
      duration: (Date.now() - startTime) / 1000
    };
  }
}

function evaluateResult(result) {
  if (!result.success) return { score: 0, details: 'Fehler: ' + result.error };

  const data = result.result;
  let score = 0;
  const details = [];

  // 1. Kunde erkannt (10 Punkte)
  if (data.kunde?.name === 'Metschel Markus') {
    score += 10;
    details.push('âœ… Kunde korrekt');
  } else {
    details.push(`âŒ Kunde: "${data.kunde?.name}" (erwartet: "Metschel Markus")`);
  }

  // 2. Hersteller korrigiert (15 Punkte)
  if (data.profil?.hersteller?.toUpperCase() === 'DRUTEX') {
    score += 15;
    details.push('âœ… Hersteller korrigiert (Dratex â†’ DRUTEX)');
  } else {
    details.push(`âŒ Hersteller: "${data.profil?.hersteller}" (erwartet: "DRUTEX")`);
  }

  // 3. System erkannt (10 Punkte)
  if (data.profil?.system?.includes('IDEAL') || data.profil?.system?.includes('NEO')) {
    score += 10;
    details.push('âœ… System erkannt');
  } else {
    details.push(`âŒ System: "${data.profil?.system}"`);
  }

  // 4. Elemente-Anzahl (15 Punkte)
  const elementCount = data.elemente?.length || 0;
  if (elementCount >= 3) {
    score += 15;
    details.push(`âœ… ${elementCount} Elemente erkannt`);
  } else if (elementCount >= 2) {
    score += 8;
    details.push(`âš ï¸ Nur ${elementCount} Elemente (erwartet: 3+)`);
  } else {
    details.push(`âŒ Nur ${elementCount} Elemente`);
  }

  // 5. MaÃŸe korrekt (20 Punkte)
  const expectedMeasures = [
    { b: 935, h: 2035 },   // Pos 1 FertigmaÃŸ
    { b: 1001, h: 2116 },  // Pos 2 InnenmaÃŸ (kein FertigmaÃŸ)
    { b: 1035, h: 1895 }   // Pos 5 FertigmaÃŸ
  ];

  let correctMeasures = 0;
  for (const elem of (data.elemente || [])) {
    for (const exp of expectedMeasures) {
      if (Math.abs(elem.breite_mm - exp.b) < 20 && Math.abs(elem.hoehe_mm - exp.h) < 20) {
        correctMeasures++;
        break;
      }
    }
  }

  if (correctMeasures >= 3) {
    score += 20;
    details.push('âœ… Alle MaÃŸe korrekt');
  } else if (correctMeasures >= 2) {
    score += 12;
    details.push(`âš ï¸ ${correctMeasures}/3 MaÃŸe korrekt`);
  } else {
    details.push(`âŒ Nur ${correctMeasures}/3 MaÃŸe korrekt`);
  }

  // 6. Zimmer interpretiert (10 Punkte)
  const hasKG = data.elemente?.some(e =>
    e.zimmer?.toUpperCase()?.includes('KG') ||
    e.zimmer?.toUpperCase()?.includes('KELLER')
  );
  const hasOG = data.elemente?.some(e =>
    e.zimmer?.toUpperCase()?.includes('OG') ||
    e.zimmer?.toUpperCase()?.includes('OBER')
  );

  if (hasKG || hasOG) {
    score += 10;
    details.push('âœ… Zimmer interpretiert (K6â†’KG oder 106â†’OG)');
  } else {
    details.push('âŒ Zimmer nicht interpretiert');
  }

  // 7. Montage-Checkboxen (10 Punkte)
  if (data.montage?.demontage && data.montage?.montage && data.montage?.entsorgung) {
    score += 10;
    details.push('âœ… Montage-Checkboxen korrekt');
  } else {
    details.push('âŒ Montage-Checkboxen fehlerhaft');
  }

  // 8. Korrekturen dokumentiert (10 Punkte)
  if (data.korrekturen?.length >= 2) {
    score += 10;
    details.push(`âœ… ${data.korrekturen.length} Korrekturen dokumentiert`);
  } else {
    details.push(`âš ï¸ Nur ${data.korrekturen?.length || 0} Korrekturen`);
  }

  return { score, details, maxScore: 100 };
}

async function runTests() {
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('  GPT-5.2 TEST (reasoning: low) - AufmaÃŸblatt OCR');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log(`  Datum: ${new Date().toISOString()}`);
  console.log(`  OCR-Text: ${OCR_TEXT.length} Zeichen`);
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');

  const results = [];

  for (const variant of VARIANTS) {
    console.log(`\nâ–¶ Teste: ${variant.name}...`);

    const result = await testVariant(variant);
    const evaluation = evaluateResult(result);

    results.push({
      ...result,
      evaluation
    });

    if (result.success) {
      console.log(`  âœ… Erfolgreich in ${result.duration.toFixed(2)}s`);
      console.log(`  ðŸ“Š Tokens: ${result.tokens.total} (davon ${result.tokens.reasoning} Reasoning)`);
      console.log(`  ðŸŽ¯ Score: ${evaluation.score}/100`);
    } else {
      console.log(`  âŒ Fehler: ${result.error}`);
    }
  }

  // Zusammenfassung
  console.log('\n\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('  ZUSAMMENFASSUNG');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');

  console.log('| Variante           | Score | Zeit    | Tokens  | Reasoning |');
  console.log('|--------------------|-------|---------|---------|-----------|');

  for (const r of results) {
    const score = r.success ? `${r.evaluation.score}/100` : 'FEHLER';
    const time = `${r.duration.toFixed(1)}s`;
    const tokens = r.success ? r.tokens.total : '-';
    const reasoning = r.success ? (r.tokens.reasoning || 0) : '-';

    console.log(`| ${r.variant.padEnd(18)} | ${score.padEnd(5)} | ${time.padEnd(7)} | ${String(tokens).padEnd(7)} | ${String(reasoning).padEnd(9)} |`);
  }

  // Beste Variante
  const best = results
    .filter(r => r.success)
    .sort((a, b) => b.evaluation.score - a.evaluation.score)[0];

  if (best) {
    console.log(`\nðŸ† BESTE VARIANTE: ${best.variant} mit Score ${best.evaluation.score}/100`);
    console.log('\nDetails:');
    best.evaluation.details.forEach(d => console.log(`   ${d}`));

    console.log('\nðŸ“‹ Extrahierte Daten:');
    console.log(JSON.stringify(best.result, null, 2));
  }

  // Ergebnisse speichern
  const outputPath = `./scripts/gpt-test-results-${Date.now()}.json`;
  require('fs').writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nðŸ’¾ Ergebnisse gespeichert: ${outputPath}`);
}

runTests().catch(console.error);

