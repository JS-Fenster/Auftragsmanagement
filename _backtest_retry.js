// Backtest Retry - Same as runner but with concurrency 1 and delay between batches
const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://rsmjgdujlpnydbsfuiek.supabase.co';
const API_KEY = 'wNzMEZJRoUBnyb8JxiMUwEi7rDlxcUMTzAlYkkW2SE040w98gna3x1MmrPpC3qeX';
const BATCH_SIZE = 20;
const DELAY_BETWEEN_BATCHES_MS = 5000; // 5 second delay

function callBacktest(docIds) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(`${SUPABASE_URL}/functions/v1/classify-backtest`);
    const body = JSON.stringify({ doc_ids: docIds });
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 300000,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error: ${data.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end(body);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const retryIds = JSON.parse(fs.readFileSync(path.join(__dirname, '_backtest_retry_ids.json'), 'utf8'));
  console.log(`Retrying ${retryIds.length} docs, batch size ${BATCH_SIZE}, sequential`);

  const batches = [];
  for (let i = 0; i < retryIds.length; i += BATCH_SIZE) {
    batches.push(retryIds.slice(i, i + BATCH_SIZE));
  }
  console.log(`${batches.length} batches\n`);

  const allResults = [];
  const allChanges = [];
  let totalDocs = 0, totalChanged = 0, totalErrors = 0;
  const changeSummary = {};
  const kategorieVon = {};

  for (let i = 0; i < batches.length; i++) {
    const startTime = Date.now();
    try {
      const result = await callBacktest(batches[i]);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (result.error) {
        console.error(`[Batch ${i + 1}/${batches.length}] ERROR: ${result.error} (${elapsed}s)`);
        totalErrors += batches[i].length;
      } else {
        console.log(`[Batch ${i + 1}/${batches.length}] ${result.summary?.total || 0} docs, ${result.summary?.changed || 0} changed (${elapsed}s)`);
        totalDocs += result.summary?.total || 0;
        totalChanged += result.summary?.changed || 0;
        if (result.results) allResults.push(...result.results);
        if (result.changes) allChanges.push(...result.changes);
        for (const r of (result.results || [])) {
          const src = r.alt_source || 'unknown';
          kategorieVon[src] = (kategorieVon[src] || 0) + 1;
          if (r.changed) {
            const key = `${r.alt || '(null)'} -> ${r.neu}`;
            changeSummary[key] = (changeSummary[key] || 0) + 1;
          }
        }
      }
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`[Batch ${i + 1}/${batches.length}] EXCEPTION: ${err.message} (${elapsed}s)`);
      totalErrors += batches[i].length;
    }

    if (i < batches.length - 1) await sleep(DELAY_BETWEEN_BATCHES_MS);
  }

  // Merge with existing results
  const existing = JSON.parse(fs.readFileSync(path.join(__dirname, '_backtest_results.json'), 'utf8'));
  const merged = {
    meta: {
      timestamp: new Date().toISOString(),
      note: 'Merged: original + retry run',
    },
    summary: {
      total: existing.summary.total + totalDocs,
      changed: existing.summary.changed + totalChanged,
      unchanged: (existing.summary.total + totalDocs) - (existing.summary.changed + totalChanged),
      errors: totalErrors,
    },
    results: [...existing.results, ...allResults],
    all_changes: [...existing.all_changes, ...allChanges],
  };

  // Recalculate patterns
  const allPatterns = {};
  const allSources = {};
  for (const r of merged.results) {
    const src = r.alt_source || 'unknown';
    allSources[src] = (allSources[src] || 0) + 1;
    if (r.changed) {
      const key = `${r.alt || '(null)'} -> ${r.neu}`;
      allPatterns[key] = (allPatterns[key] || 0) + 1;
    }
  }
  merged.source_distribution = allSources;
  merged.change_patterns = Object.entries(allPatterns).sort((a, b) => b[1] - a[1]).map(([p, c]) => ({ pattern: p, count: c }));
  merged.summary.change_rate = ((merged.summary.changed / merged.summary.total) * 100).toFixed(1) + '%';

  fs.writeFileSync(path.join(__dirname, '_backtest_results.json'), JSON.stringify(merged, null, 2));

  console.log('\n=== RETRY SUMMARY ===');
  console.log(`Retry: ${totalDocs} docs, ${totalChanged} changed, ${totalErrors} errors`);
  console.log(`\n=== MERGED TOTAL ===`);
  console.log(`Total: ${merged.summary.total} docs`);
  console.log(`Changed: ${merged.summary.changed} (${merged.summary.change_rate})`);
  console.log(`Unchanged: ${merged.summary.unchanged}`);
  console.log(`Errors: ${merged.summary.errors}`);
  console.log('\nTop Change Patterns (all):');
  for (const { pattern, count } of merged.change_patterns.slice(0, 20)) {
    console.log(`  ${count}x ${pattern}`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
