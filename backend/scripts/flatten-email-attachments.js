/**
 * FLATTEN EMAIL-ATTACHMENTS STORAGE STRUCTURE
 * ============================================
 *
 * Migrates all files in Supabase Storage bucket "documents" from:
 *   email-attachments/<uuid>/<filename>
 * to:
 *   email-attachments/<timestamp>_<filename>
 *
 * Timestamp format (matches process-email v4.1):
 *   created_at "2026-02-10 16:16:14.477997+00" → "2026-02-10T16-16-14-477Z"
 *
 * Also updates:
 *   - documents.dokument_url (the storage path reference)
 *   - email_anhaenge_meta on parent emails (JSON array with storagePath field)
 *
 * Usage:
 *   node flatten-email-attachments.js --dry-run   # Preview only
 *   node flatten-email-attachments.js              # Execute migration
 *
 * Erstellt: 2026-02-24
 */

const path = require('path');
const fs = require('fs');

// Load env from dashboard/.env (contains service role key as VITE_SUPABASE_ANON_KEY)
const dashboardEnvPath = path.join(__dirname, '..', '..', 'dashboard', '.env');
const envContent = fs.readFileSync(dashboardEnvPath, 'utf8');
const envVars = {};
envContent.replace(/\r/g, '').split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_KEY = envVars.VITE_SUPABASE_ANON_KEY; // Actually service_role key

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('FEHLER: VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY muessen in dashboard/.env gesetzt sein');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// =============================================================================
// CONFIG
// =============================================================================

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 10;
const BUCKET = 'documents';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert a created_at timestamp to the flat filename prefix.
 * Input:  "2026-02-10T16:16:14.477997+00:00" or "2026-02-10 16:16:14.477997+00"
 * Output: "2026-02-10T16-16-14-477Z"
 *
 * Matches the format used in process-email:
 *   new Date().toISOString().replace(/:/g, '-').replace('.', '-').slice(0, -1) + 'Z'
 */
function formatTimestamp(createdAt) {
  const d = new Date(createdAt);
  // toISOString() → "2026-02-10T16:16:14.477Z"
  const iso = d.toISOString();
  // Replace colons → dashes, dot before ms → dash, remove trailing 'Z', add 'Z' back
  // "2026-02-10T16:16:14.477Z" → "2026-02-10T16-16-14-477Z"
  return iso.replace(/:/g, '-').replace('.', '-').slice(0, -1) + 'Z';
}

/**
 * Extract the filename from a path like "email-attachments/<uuid>/<filename>"
 */
function extractFilename(dokUrl) {
  const parts = dokUrl.split('/');
  return parts[parts.length - 1];
}

/**
 * Check if a dokument_url matches the old UUID-subfolder pattern.
 * Pattern: email-attachments/<uuid>/<filename>
 * UUID pattern: 8-4-4-4-12 hex chars
 */
function isOldPath(dokUrl) {
  return /^email-attachments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/.+$/i.test(dokUrl);
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('FLATTEN EMAIL-ATTACHMENTS STORAGE');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE MIGRATION'}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log('='.repeat(70));
  console.log();

  // -------------------------------------------------------------------------
  // Step 1: Query all documents with old UUID-subfolder paths
  // -------------------------------------------------------------------------
  console.log('[STEP 1] Querying documents with UUID-subfolder paths...');

  const { data: docs, error: queryError } = await supabase
    .from('documents')
    .select('id, dokument_url, created_at')
    .like('dokument_url', 'email-attachments/%/%')
    .order('created_at', { ascending: true });

  if (queryError) {
    console.error('FEHLER beim Query:', queryError.message);
    process.exit(1);
  }

  // Filter to only old UUID-subfolder paths (exclude already-flat paths)
  const oldDocs = docs.filter(d => isOldPath(d.dokument_url));

  console.log(`  Gefunden: ${docs.length} Dokumente mit email-attachments/*/- Pattern`);
  console.log(`  Davon UUID-Subfolder: ${oldDocs.length}`);
  console.log(`  Bereits flach: ${docs.length - oldDocs.length}`);
  console.log();

  if (oldDocs.length === 0) {
    console.log('Keine Dokumente zum Migrieren gefunden. Fertig.');
    return;
  }

  // -------------------------------------------------------------------------
  // Step 2: Calculate new paths and detect collisions
  // -------------------------------------------------------------------------
  console.log('[STEP 2] Berechne neue Pfade und erkenne Kollisionen...');

  // Build map: newPath → [docs]
  const pathMap = new Map();
  for (const doc of oldDocs) {
    const filename = extractFilename(doc.dokument_url);
    const timestamp = formatTimestamp(doc.created_at);
    const newPath = `email-attachments/${timestamp}_${filename}`;

    if (!pathMap.has(newPath)) {
      pathMap.set(newPath, []);
    }
    pathMap.get(newPath).push(doc);
  }

  // Detect collisions and resolve them
  let collisionCount = 0;
  const migrationPlan = []; // { doc, oldPath, newPath }

  for (const [basePath, docsForPath] of pathMap) {
    if (docsForPath.length === 1) {
      // No collision
      migrationPlan.push({
        doc: docsForPath[0],
        oldPath: docsForPath[0].dokument_url,
        newPath: basePath,
      });
    } else {
      // Collision! Append _<first8chars-of-doc-id> before extension
      collisionCount += docsForPath.length;
      for (const doc of docsForPath) {
        const idPrefix = doc.id.substring(0, 8);
        const lastDotIdx = basePath.lastIndexOf('.');
        let newPath;
        if (lastDotIdx > basePath.lastIndexOf('/')) {
          // Has extension: insert _<id> before extension
          newPath = basePath.substring(0, lastDotIdx) + '_' + idPrefix + basePath.substring(lastDotIdx);
        } else {
          // No extension: append _<id>
          newPath = basePath + '_' + idPrefix;
        }
        migrationPlan.push({
          doc,
          oldPath: doc.dokument_url,
          newPath,
        });
      }
    }
  }

  console.log(`  Eindeutige Pfade: ${pathMap.size}`);
  console.log(`  Kollisionen: ${collisionCount} Dateien in ${[...pathMap.values()].filter(v => v.length > 1).length} Gruppen`);
  console.log(`  Migration-Plan: ${migrationPlan.length} Dateien`);
  console.log();

  // -------------------------------------------------------------------------
  // Step 3: Execute moves in batches
  // -------------------------------------------------------------------------
  console.log(`[STEP 3] ${DRY_RUN ? 'Simuliere' : 'Fuehre aus'} Storage-Moves und DB-Updates...`);
  console.log();

  let moved = 0;
  let failed = 0;
  let skipped = 0;
  const oldToNewMap = new Map(); // oldPath → newPath (for email_anhaenge_meta update)

  for (let i = 0; i < migrationPlan.length; i += BATCH_SIZE) {
    const batch = migrationPlan.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(migrationPlan.length / BATCH_SIZE);

    console.log(`--- Batch ${batchNum}/${totalBatches} (${batch.length} Dateien) ---`);

    for (const item of batch) {
      const { doc, oldPath, newPath } = item;
      const shortId = doc.id.substring(0, 8);

      if (DRY_RUN) {
        console.log(`  [DRY] ${shortId}  ${oldPath}`);
        console.log(`        → ${newPath}`);
        oldToNewMap.set(oldPath, newPath);
        moved++;
        continue;
      }

      // 3a: Move file in storage
      const { error: moveError } = await supabase.storage
        .from(BUCKET)
        .move(oldPath, newPath);

      if (moveError) {
        console.error(`  [FAIL] ${shortId}  Move fehlgeschlagen: ${moveError.message}`);
        console.error(`         ${oldPath}`);
        failed++;
        continue;
      }

      // 3b: Update dokument_url in documents table
      const { error: updateError } = await supabase
        .from('documents')
        .update({ dokument_url: newPath })
        .eq('id', doc.id);

      if (updateError) {
        console.error(`  [FAIL] ${shortId}  DB-Update fehlgeschlagen: ${updateError.message}`);
        console.error(`         Datei wurde verschoben aber DB nicht aktualisiert!`);
        console.error(`         Manual fix: UPDATE documents SET dokument_url='${newPath}' WHERE id='${doc.id}'`);
        failed++;
        continue;
      }

      oldToNewMap.set(oldPath, newPath);
      moved++;
      console.log(`  [OK]   ${shortId}  → ${newPath}`);
    }

    // Small delay between batches to avoid overwhelming the API
    if (i + BATCH_SIZE < migrationPlan.length) {
      await sleep(500);
    }
  }

  console.log();
  console.log(`  Storage + Documents: ${moved} moved, ${failed} failed, ${skipped} skipped`);
  console.log();

  // -------------------------------------------------------------------------
  // Step 4: Update email_anhaenge_meta on parent emails
  // -------------------------------------------------------------------------
  console.log('[STEP 4] Aktualisiere email_anhaenge_meta auf Eltern-Emails...');

  if (oldToNewMap.size === 0) {
    console.log('  Keine Pfade geaendert, ueberspringe email_anhaenge_meta Update.');
  } else {
    // Query all parent emails that have email_anhaenge_meta
    const { data: parentEmails, error: parentError } = await supabase
      .from('documents')
      .select('id, email_anhaenge_meta')
      .not('email_anhaenge_meta', 'is', null);

    if (parentError) {
      console.error('  FEHLER beim Query der Eltern-Emails:', parentError.message);
    } else {
      console.log(`  ${parentEmails.length} Emails mit email_anhaenge_meta gefunden`);

      let metaUpdated = 0;
      let metaFailed = 0;

      for (const email of parentEmails) {
        const meta = email.email_anhaenge_meta;
        if (!Array.isArray(meta) || meta.length === 0) continue;

        let changed = false;
        const updatedMeta = meta.map(att => {
          if (att.storagePath && oldToNewMap.has(att.storagePath)) {
            changed = true;
            return { ...att, storagePath: oldToNewMap.get(att.storagePath) };
          }
          return att;
        });

        if (!changed) continue;

        if (DRY_RUN) {
          const shortId = email.id.substring(0, 8);
          const changedPaths = meta
            .filter(att => att.storagePath && oldToNewMap.has(att.storagePath))
            .map(att => `    ${att.storagePath} → ${oldToNewMap.get(att.storagePath)}`);
          console.log(`  [DRY] Email ${shortId}: ${changedPaths.length} Pfade aktualisiert`);
          for (const p of changedPaths) {
            console.log(p);
          }
          metaUpdated++;
          continue;
        }

        const { error: metaUpdateError } = await supabase
          .from('documents')
          .update({ email_anhaenge_meta: updatedMeta })
          .eq('id', email.id);

        if (metaUpdateError) {
          const shortId = email.id.substring(0, 8);
          console.error(`  [FAIL] Email ${shortId}: ${metaUpdateError.message}`);
          metaFailed++;
        } else {
          metaUpdated++;
        }
      }

      console.log(`  email_anhaenge_meta: ${metaUpdated} updated, ${metaFailed} failed`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 5: Final report
  // -------------------------------------------------------------------------
  console.log();
  console.log('='.repeat(70));
  console.log('ERGEBNIS');
  console.log('='.repeat(70));
  console.log(`  Modus:       ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Verschoben:  ${moved}`);
  console.log(`  Fehlschlag:  ${failed}`);
  console.log(`  Uebersprungen: ${skipped}`);
  console.log(`  Kollisionen: ${collisionCount} (mit ID-Suffix aufgeloest)`);
  console.log('='.repeat(70));

  if (DRY_RUN) {
    console.log();
    console.log('Dies war ein DRY RUN. Keine Aenderungen vorgenommen.');
    console.log('Starte ohne --dry-run um die Migration auszufuehren.');
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unerwarteter Fehler:', err);
  process.exit(1);
});
