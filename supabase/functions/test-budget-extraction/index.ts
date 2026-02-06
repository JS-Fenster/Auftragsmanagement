// =============================================================================
// Test: Budget-Extraktion Performance
// Temporäre Edge Function zum Messen der GPT-Extraktionszeit
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const BUDGET_EXTRACTION_PROMPT = `Du bist ein Experte für Fenster und Türen bei J.S. Fenster & Türen.

Analysiere das folgende Aufmassblatt/Kundenanfrage und extrahiere ALLE Informationen für ein Budgetangebot.

EXTRAHIERE:
1. Kunde (Name, Adresse wenn vorhanden)
2. Kontext (Hersteller, System, Verglasung, Farben)
3. JEDES Fenster/Tür einzeln mit:
   - Raum
   - Typ (Fenster, Tür, HST, Festfeld)
   - Öffnungsart (DK, DK/K, FIX, Kipp, Dreh, etc.)
   - Breite in mm
   - Höhe in mm
   - Menge
   - Zubehör (Rollladen, Raffstore, elektrisch, AFB, IFB, Insektenschutz)
4. Montage-Infos (Montage, Demontage, Entsorgung)
5. Was FEHLT (Höhe? Farbe? Verglasung?)
6. Was ANGENOMMEN werden muss

REGELN:
- Maße immer in mm (cm×10, m×1000)
- Bei "1230x1480" → Breite=1230, Höhe=1480
- Bei "B=1230 H=1480" → explizit
- Hersteller Default: WERU
- 3-fach → CALIDO, 2-fach → CASTELLO
- Fehlendes markieren!

Antworte NUR mit validem JSON:
{
  "kunde": { "name": "", "adresse": "" },
  "kontext": {
    "hersteller": "",
    "system": "",
    "verglasung": "",
    "farbe_innen": "",
    "farbe_aussen": ""
  },
  "elemente": [
    {
      "position": 1,
      "raum": "",
      "typ": "fenster",
      "oeffnungsart": "",
      "breite_mm": 0,
      "hoehe_mm": 0,
      "menge": 1,
      "zubehoer": {
        "rollladen": false,
        "rollladen_elektrisch": false,
        "raffstore": false,
        "raffstore_elektrisch": false,
        "insektenschutz": false,
        "afb": false,
        "ifb": false
      },
      "bemerkungen": ""
    }
  ],
  "montage": {
    "montage": true,
    "demontage_alt": false,
    "entsorgung_alt": false
  },
  "fehlende_infos": [],
  "annahmen": []
}`;

// Echter OCR-Text aus der Datenbank (gekürzt)
const TEST_OCR_TEXT = `J.S. Fenster & Türen
Aufmaßblatt Fenster

Kunde: Binder
Farbe: Innen: weiß Außen: Anthrazit
Glas: 3-fach
Rollo: VR + Motor für Wdvs

Montage Aufwand: Monteure 3 Stunden, Tage 4
Demontage: ☑
Entsorgen: ☑
Montage: ☑

Nr. | Zimmer | Fertige Breite | Fertige Höhe | DIN | RL | Bemerkung
1   | WC     | 970            | 1080         | R   |    |
2   | Bad    | 970            | 1080         | R   |    |
3   | Küche  | 2570           | 2440         | L   | Raff | inkl. 140
4   |        | 970            | 1500         | L   | Raff |
5   | Ess    | 1855           | 1500         | L+R | Raff |
6   |        | 1070           | 2440         |     | Raff | Festfeld
7   |        | 1800           | 1500         |     | Raff | inkl. 140
8   |        | 1850           | 2350         |     | Raff | DK abschließbar
9   | Erg    | 1855           | 1420         | L   |      |
10  | HT     | 1450           | 2070         |     |      | Haustür`;

Deno.serve(async (req: Request) => {
  // Health Check
  if (req.method === "GET") {
    return new Response(JSON.stringify({
      service: "test-budget-extraction",
      status: "ready",
      openai_configured: !!OPENAI_API_KEY,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // POST: Run extraction test
  const startTime = Date.now();

  try {
    console.log("[TEST] Starting GPT budget extraction...");

    const gptStart = Date.now();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o", // Gleich wie process-document
        messages: [
          { role: "system", content: BUDGET_EXTRACTION_PROMPT },
          { role: "user", content: TEST_OCR_TEXT },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    const gptEnd = Date.now();
    const gptDuration = (gptEnd - gptStart) / 1000;

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const content = JSON.parse(result.choices[0].message.content);

    const totalEnd = Date.now();
    const totalDuration = (totalEnd - startTime) / 1000;

    console.log(`[TEST] GPT call: ${gptDuration.toFixed(2)}s`);
    console.log(`[TEST] Elements found: ${content.elemente?.length || 0}`);

    return new Response(JSON.stringify({
      success: true,
      timing: {
        gpt_call_seconds: gptDuration,
        total_seconds: totalDuration,
      },
      usage: {
        prompt_tokens: result.usage.prompt_tokens,
        completion_tokens: result.usage.completion_tokens,
        total_tokens: result.usage.total_tokens,
      },
      result: {
        kunde: content.kunde,
        kontext: content.kontext,
        elemente_count: content.elemente?.length || 0,
        fehlende_infos: content.fehlende_infos,
        annahmen: content.annahmen,
      },
      // Vollständiges Ergebnis
      full_result: content,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error("[TEST] Error:", error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duration_seconds: duration,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
