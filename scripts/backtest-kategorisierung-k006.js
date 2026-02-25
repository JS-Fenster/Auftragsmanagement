#!/usr/bin/env node
// =============================================================================
// K-006: Vollständiger Kategorisierungs-Backtest mit Prompt v2.3.0 (v37)
// 2026-02-23
// =============================================================================
// Liest ALLE kategorisierten Dokumente (mit OCR-Text, exkl. Emails),
// schickt sie durch classify-backtest (apply=false = dry-run),
// und schreibt einen detaillierten Report.
// =============================================================================

const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://rsmjgdujlpnydbsfuiek.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbWpnZHVqbHBueWRic2Z1aWVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc2NjQ1NywiZXhwIjoyMDgxMzQyNDU3fQ.xdzy1wAqVZ_MZgs9PjPpz3mofbffBM5lHAUBrZnC_ks";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbWpnZHVqbHBueWRic2Z1aWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NjY0NTcsImV4cCI6MjA4MTM0MjQ1N30.da6ZwbEfqhqdsZlKYNUGP7uvu8A7qwlVLBI0IK4uQfc";
const INTERNAL_API_KEY = "wNzMEZJRoUBnyb8JxiMUwEi7rDlxcUMTzAlYkkW2SE040w98gna3x1MmrPpC3qeX";
const BATCH_SIZE = 20;
const DELAY_MS = 3000; // 3s pause between batches

const REPORT_PATH = path.join(__dirname, "..", "workflows", "K-006_backtest_report.md");

// =============================================================================
// Helpers
// =============================================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestamp() {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}

// =============================================================================
// Step 1: Fetch all document IDs to backtest
// =============================================================================

async function fetchDocumentIds() {
  console.log(`[${timestamp()}] Lade Dokument-IDs aus Supabase...`);

  const query = `
    SELECT id, kategorie, kategorisiert_von, dokument_url, extraktions_qualitaet
    FROM documents
    WHERE kategorie IS NOT NULL
      AND ocr_text IS NOT NULL
      AND length(ocr_text) > 10
      AND kategorie NOT IN ('Email_Eingehend', 'Email_Anhang')
      AND processing_status = 'done'
    ORDER BY created_at ASC
  `;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ query }),
  });

  // Fallback: use PostgREST query directly
  const url = new URL(`${SUPABASE_URL}/rest/v1/documents`);
  url.searchParams.set("select", "id,kategorie,kategorisiert_von,dokument_url,extraktions_qualitaet");
  url.searchParams.set("kategorie", "not.in.(Email_Eingehend,Email_Anhang)");
  url.searchParams.set("ocr_text", "not.is.null");
  url.searchParams.set("processing_status", "eq.done");
  url.searchParams.set("order", "created_at.asc");
  url.searchParams.set("limit", "2000");

  const res2 = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!res2.ok) {
    throw new Error(`PostgREST error: ${res2.status} - ${await res2.text()}`);
  }

  const docs = await res2.json();
  // Filter out docs with very short ocr_text (can't filter length via PostgREST easily)
  console.log(`[${timestamp()}] ${docs.length} Dokumente geladen`);
  return docs;
}

// =============================================================================
// Step 2: Run backtest in batches
// =============================================================================

async function runBatch(batchNum, totalBatches, ids) {
  const url = `${SUPABASE_URL}/functions/v1/classify-backtest`;
  const body = { doc_ids: ids, apply: false }; // DRY RUN!

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "x-api-key": INTERNAL_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Batch ${batchNum}/${totalBatches}] FEHLER ${res.status} nach ${elapsed}s: ${errText.substring(0, 300)}`);
      return { batch: batchNum, status: "error", httpStatus: res.status, elapsed, results: [] };
    }

    const data = await res.json();
    const { summary, results } = data;
    console.log(
      `[Batch ${batchNum}/${totalBatches}] OK (${elapsed}s) - ${summary.total} Docs, ${summary.changed} geaendert`
    );

    return { batch: batchNum, status: "ok", summary, results: results || [], elapsed };
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`[Batch ${batchNum}/${totalBatches}] EXCEPTION nach ${elapsed}s: ${err.message}`);
    return { batch: batchNum, status: "exception", error: err.message, elapsed, results: [] };
  }
}

// =============================================================================
// Step 3: Generate Report
// =============================================================================

function generateReport(docs, allResults, startTime, endTime) {
  const docMap = {};
  for (const doc of docs) {
    docMap[doc.id] = doc;
  }

  // Categorize results
  const changed = [];
  const unchanged = [];
  const errors = [];

  for (const r of allResults) {
    if (r.neu === "ERROR") {
      errors.push(r);
    } else if (r.changed) {
      changed.push({
        ...r,
        dokument_url: docMap[r.id]?.dokument_url || null,
        extraktions_qualitaet: docMap[r.id]?.extraktions_qualitaet || null,
      });
    } else {
      unchanged.push(r);
    }
  }

  // Group changes by type
  const changeTypes = {};
  for (const c of changed) {
    const key = `${c.alt} → ${c.neu}`;
    if (!changeTypes[key]) changeTypes[key] = [];
    changeTypes[key].push(c);
  }

  // Sort by count
  const sortedChangeTypes = Object.entries(changeTypes).sort((a, b) => b[1].length - a[1].length);

  // Count changes FROM Sonstiges
  const fromSonstiges = changed.filter((c) => c.alt === "Sonstiges_Dokument");
  const toSonstiges = changed.filter((c) => c.neu === "Sonstiges_Dokument");

  // Build report
  let report = `# K-006: Kategorisierungs-Backtest Report

## Meta
- **Datum:** ${new Date().toISOString().substring(0, 10)}
- **Prompt-Version:** v2.3.0 (process-document v37)
- **GPT-Modell:** gpt-5-mini
- **Start:** ${startTime}
- **Ende:** ${endTime}
- **Dauer:** ${((new Date(endTime) - new Date(startTime)) / 1000 / 60).toFixed(1)} Minuten

## Zusammenfassung

| Metrik | Wert |
|--------|------|
| Dokumente gesamt | ${allResults.length} |
| Unverändert (Kategorie bestätigt) | ${unchanged.length} (${((unchanged.length / allResults.length) * 100).toFixed(1)}%) |
| **Geändert (neue Kategorie vorgeschlagen)** | **${changed.length} (${((changed.length / allResults.length) * 100).toFixed(1)}%)** |
| Fehler | ${errors.length} |
| Davon: Sonstiges_Dokument → echte Kategorie | ${fromSonstiges.length} |
| Davon: echte Kategorie → Sonstiges_Dokument | ${toSonstiges.length} |

## Änderungen nach Typ (${sortedChangeTypes.length} verschiedene)

| Alt → Neu | Anzahl | Bewertung |
|-----------|--------|-----------|
`;

  for (const [changeType, items] of sortedChangeTypes) {
    report += `| ${changeType} | ${items.length} | TODO |\n`;
  }

  report += `\n## Detail: Alle vorgeschlagenen Änderungen\n\n`;
  report += `> **WICHTIG:** Diese Änderungen wurden noch NICHT angewendet (dry-run).\n`;
  report += `> Bitte prüfen und Problemfälle markieren, bevor wir apply=true laufen lassen.\n\n`;

  let changeNum = 0;
  for (const [changeType, items] of sortedChangeTypes) {
    report += `### ${changeType} (${items.length}x)\n\n`;
    report += `| # | Doc-ID | Dateiname | Alt-Quelle | Qual. | Aktion |\n`;
    report += `|---|--------|-----------|------------|-------|--------|\n`;

    for (const item of items) {
      changeNum++;
      const filename = item.dokument_url ? item.dokument_url.split("/").pop() : "?";
      report += `| ${changeNum} | \`${item.id.substring(0, 8)}\` | ${filename} | ${item.alt_source || "?"} | ${item.extraktions_qualitaet || "?"} | |\n`;
    }
    report += `\n`;
  }

  if (errors.length > 0) {
    report += `## Fehler (${errors.length})\n\n`;
    report += `| Doc-ID | Fehler |\n`;
    report += `|--------|--------|\n`;
    for (const e of errors) {
      report += `| \`${e.id.substring(0, 8)}\` | ${e.grund || "Unbekannt"} |\n`;
    }
    report += `\n`;
  }

  // Stats per original kategorisiert_von
  const bySource = {};
  for (const r of allResults) {
    const src = r.alt_source || "unknown";
    if (!bySource[src]) bySource[src] = { total: 0, changed: 0 };
    bySource[src].total++;
    if (r.changed) bySource[src].changed++;
  }

  report += `## Fehlerrate nach Quelle\n\n`;
  report += `| Kategorisiert von | Gesamt | Geändert | Rate |\n`;
  report += `|-------------------|--------|----------|------|\n`;
  for (const [src, stats] of Object.entries(bySource).sort((a, b) => b[1].changed - a[1].changed)) {
    const rate = ((stats.changed / stats.total) * 100).toFixed(1);
    report += `| ${src} | ${stats.total} | ${stats.changed} | ${rate}% |\n`;
  }

  report += `\n---\n*Generiert von backtest-kategorisierung-k006.js*\n`;

  return report;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const startTime = timestamp();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`K-006 KATEGORISIERUNGS-BACKTEST (DRY RUN)`);
  console.log(`Prompt v2.3.0 | GPT-5 mini | apply=false`);
  console.log(`Start: ${startTime}`);
  console.log(`${"=".repeat(60)}\n`);

  // Step 1: Fetch documents
  const docs = await fetchDocumentIds();
  const totalDocs = docs.length;
  const totalBatches = Math.ceil(totalDocs / BATCH_SIZE);

  console.log(`Dokumente: ${totalDocs}, Batches: ${totalBatches}, BatchSize: ${BATCH_SIZE}\n`);

  // Step 2: Run batches
  const allResults = [];
  let totalChanged = 0;
  let totalErrors = 0;

  for (let i = 0; i < totalBatches; i++) {
    const batchDocs = docs.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const batchIds = batchDocs.map((d) => d.id);

    const result = await runBatch(i + 1, totalBatches, batchIds);

    if (result.status === "ok" && result.results) {
      allResults.push(...result.results);
      totalChanged += result.summary?.changed || 0;
    } else {
      totalErrors++;
      // Add error placeholders
      for (const id of batchIds) {
        allResults.push({
          id,
          alt: docs.find((d) => d.id === id)?.kategorie,
          neu: "ERROR",
          changed: false,
          applied: false,
          alt_source: docs.find((d) => d.id === id)?.kategorisiert_von,
          grund: result.error || `HTTP ${result.httpStatus}`,
        });
      }
    }

    // Progress
    const pct = (((i + 1) / totalBatches) * 100).toFixed(0);
    console.log(`--- Progress: ${pct}% (${i + 1}/${totalBatches}) | Geändert bisher: ${totalChanged} ---\n`);

    // Delay between batches (except last)
    if (i < totalBatches - 1) {
      await sleep(DELAY_MS);
    }
  }

  const endTime = timestamp();

  // Step 3: Generate report
  console.log(`\nGeneriere Report...`);
  const report = generateReport(docs, allResults, startTime, endTime);

  // Ensure directory exists
  const reportDir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(REPORT_PATH, report, "utf-8");
  console.log(`Report geschrieben: ${REPORT_PATH}`);

  // Final summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`ERGEBNIS K-006 BACKTEST`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Dokumente:  ${allResults.length}/${totalDocs}`);
  console.log(`Unverändert: ${allResults.length - totalChanged - totalErrors}`);
  console.log(`Geändert:   ${totalChanged}`);
  console.log(`Fehler:     ${totalErrors} Batches`);
  console.log(`Report:     ${REPORT_PATH}`);
  console.log(`Ende:       ${endTime}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
