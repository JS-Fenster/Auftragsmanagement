// Backtest Runner - Processes 500 documents through classify-backtest edge function
// Usage: node _backtest_runner.js
// Input: _backtest_ids.json (array of UUIDs)
// Output: _backtest_results.json

const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://rsmjgdujlpnydbsfuiek.supabase.co';
const API_KEY = 'wNzMEZJRoUBnyb8JxiMUwEi7rDlxcUMTzAlYkkW2SE040w98gna3x1MmrPpC3qeX';
const BATCH_SIZE = 20;
const CONCURRENCY = 3;

// Call classify-backtest edge function
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
      timeout: 300000, // 5 minutes per batch
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse: ${data.substring(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end(body);
  });
}

// Run batches with controlled concurrency
async function runWithConcurrency(batches, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < batches.length) {
      const batchIndex = index++;
      const batch = batches[batchIndex];
      const startTime = Date.now();

      try {
        const result = await callBacktest(batch);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (result.error) {
          console.error(`[Batch ${batchIndex + 1}/${batches.length}] API ERROR: ${result.error} (${elapsed}s)`);
          results.push({ batchIndex, error: result.error, doc_ids: batch });
        } else {
          console.log(`[Batch ${batchIndex + 1}/${batches.length}] ${result.summary?.total || 0} docs, ${result.summary?.changed || 0} changed, ${result.summary?.errors || 0} errors (${elapsed}s)`);
          results.push({ batchIndex, ...result });
        }
      } catch (err) {
        console.error(`[Batch ${batchIndex + 1}/${batches.length}] EXCEPTION: ${err.message}`);
        results.push({ batchIndex, error: err.message, doc_ids: batch });
      }
    }
  }

  const workers = Array(concurrency).fill(null).map(() => worker());
  await Promise.all(workers);

  return results;
}

async function main() {
  console.log('=== Backtest Runner ===');

  // Read IDs from file
  const idsFile = path.join(__dirname, '_backtest_ids.json');
  if (!fs.existsSync(idsFile)) {
    console.error(`IDs file not found: ${idsFile}`);
    process.exit(1);
  }

  const allIds = JSON.parse(fs.readFileSync(idsFile, 'utf8'));
  const targetIds = allIds.slice(0, 500);
  console.log(`Loaded ${allIds.length} IDs, processing ${targetIds.length}`);
  console.log(`Batch size: ${BATCH_SIZE}, Concurrency: ${CONCURRENCY}`);

  // Split into batches
  const batches = [];
  for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
    batches.push(targetIds.slice(i, i + BATCH_SIZE));
  }
  console.log(`Created ${batches.length} batches`);
  console.log('');

  const startTime = Date.now();
  const batchResults = await runWithConcurrency(batches, CONCURRENCY);
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  // Aggregate results
  let totalDocs = 0;
  let totalChanged = 0;
  let totalUnchanged = 0;
  let totalErrors = 0;
  const allResults = [];
  const allChanges = [];
  const changeSummary = {};
  const kategorieVon = {}; // Track alt_source distribution

  for (const batch of batchResults) {
    if (batch.error && !batch.results) {
      totalErrors += (batch.doc_ids?.length || 0);
      continue;
    }
    totalDocs += batch.summary?.total || 0;
    totalChanged += batch.summary?.changed || 0;
    totalUnchanged += (batch.summary?.total || 0) - (batch.summary?.changed || 0) - (batch.summary?.errors || 0);
    totalErrors += batch.summary?.errors || 0;

    if (batch.results) allResults.push(...batch.results);
    if (batch.changes) allChanges.push(...batch.changes);

    // Track change patterns + source stats
    for (const r of (batch.results || [])) {
      // Source stats
      const src = r.alt_source || 'unknown';
      kategorieVon[src] = (kategorieVon[src] || 0) + 1;

      if (r.changed) {
        const key = `${r.alt || '(null)'} -> ${r.neu}`;
        changeSummary[key] = (changeSummary[key] || 0) + 1;
      }
    }
  }

  // Sort change patterns by frequency
  const sortedPatterns = Object.entries(changeSummary)
    .sort((a, b) => b[1] - a[1]);

  const finalReport = {
    meta: {
      timestamp: new Date().toISOString(),
      total_time_seconds: parseFloat(totalTime),
      batches: batches.length,
      concurrency: CONCURRENCY,
    },
    summary: {
      total: totalDocs,
      changed: totalChanged,
      unchanged: totalUnchanged,
      errors: totalErrors,
      change_rate: totalDocs > 0 ? ((totalChanged / totalDocs) * 100).toFixed(1) + '%' : 'N/A',
    },
    source_distribution: kategorieVon,
    change_patterns: sortedPatterns.map(([pattern, count]) => ({ pattern, count })),
    all_changes: allChanges,
    results: allResults,
  };

  // Save results
  fs.writeFileSync(path.join(__dirname, '_backtest_results.json'), JSON.stringify(finalReport, null, 2));

  console.log('');
  console.log('=== SUMMARY ===');
  console.log(`Total: ${totalDocs} docs in ${totalTime}s`);
  console.log(`Changed: ${totalChanged} (${finalReport.summary.change_rate})`);
  console.log(`Unchanged: ${totalUnchanged}`);
  console.log(`Errors: ${totalErrors}`);
  console.log('');
  console.log('Source distribution:');
  for (const [src, count] of Object.entries(kategorieVon).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src}: ${count}`);
  }
  console.log('');
  console.log('Top Change Patterns:');
  for (const [pattern, count] of sortedPatterns.slice(0, 20)) {
    console.log(`  ${count}x ${pattern}`);
  }
  console.log('');
  console.log('Results saved to _backtest_results.json');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
