// =============================================================================
// Auftrags-Aging - Automatisches Setzen des ist_zu_lange_offen Flags
// Version: 2.0.0 - 2026-02-02
// =============================================================================
// BREAKING CHANGES v2.0:
//   - Tabelle reparatur_auftraege -> auftraege
// =============================================================================
// Endpoints:
//   POST /reparatur-aging/run    - Manuell triggern (fuer Cron-Job)
//   GET  /reparatur-aging?health=1 - Health Check
// =============================================================================
// Logik (SPEC 3.8 Aging-Regel):
// - Auftraege mit status IN ('OFFEN', 'IN_BEARBEITUNG', 'NICHT_BESTAETIGT')
// - UND (letzter_kontakt_am IS NULL ODER letzter_kontakt_am < now() - 14 Tage)
// - UND ist_zu_lange_offen = false
// => Werden auf ist_zu_lange_offen = true gesetzt
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SVC_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const AGING_DAYS = 14;
const AGING_STATUS = ['OFFEN', 'IN_BEARBEITUNG', 'NICHT_BESTAETIGT'];

interface AgingResult {
  success: boolean;
  updated_count: number;
  checked_count: number;
  updated_ids: string[];
  timestamp: string;
  aging_threshold_days: number;
  error?: string;
}

async function runAgingCheck(): Promise<AgingResult> {
  const timestamp = new Date().toISOString();
  console.log(`[AGING] Starting aging check at ${timestamp}`);
  console.log(`[AGING] Threshold: ${AGING_DAYS} days without contact`);

  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - AGING_DAYS);
    const thresholdISO = thresholdDate.toISOString();

    // Query gegen 'auftraege' (umbenannt von reparatur_auftraege)
    const { data: candidates, error: fetchError } = await supabase
      .from('auftraege')
      .select('id, status, letzter_kontakt_am, erstellt_am')
      .in('status', AGING_STATUS)
      .eq('ist_zu_lange_offen', false);

    if (fetchError) {
      console.error('[AGING] Fetch error:', fetchError.message);
      throw new Error(`Database fetch failed: ${fetchError.message}`);
    }

    const checkedCount = candidates?.length || 0;
    console.log(`[AGING] Found ${checkedCount} candidates to check`);

    if (!candidates || candidates.length === 0) {
      return {
        success: true,
        updated_count: 0,
        checked_count: 0,
        updated_ids: [],
        timestamp,
        aging_threshold_days: AGING_DAYS,
      };
    }

    const toUpdate = candidates.filter(auftrag => {
      if (auftrag.letzter_kontakt_am === null) {
        const erstelltDate = new Date(auftrag.erstellt_am);
        return erstelltDate < thresholdDate;
      } else {
        const kontaktDate = new Date(auftrag.letzter_kontakt_am);
        return kontaktDate < thresholdDate;
      }
    });

    console.log(`[AGING] ${toUpdate.length} of ${checkedCount} need aging flag`);

    if (toUpdate.length === 0) {
      return {
        success: true,
        updated_count: 0,
        checked_count: checkedCount,
        updated_ids: [],
        timestamp,
        aging_threshold_days: AGING_DAYS,
      };
    }

    const idsToUpdate = toUpdate.map(a => a.id);

    const { data: updated, error: updateError } = await supabase
      .from('auftraege')
      .update({
        ist_zu_lange_offen: true,
        aktualisiert_am: new Date().toISOString(),
      })
      .in('id', idsToUpdate)
      .select('id');

    if (updateError) {
      console.error('[AGING] Update error:', updateError.message);
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    const updatedCount = updated?.length || 0;
    const updatedIds = updated?.map(a => a.id) || [];

    console.log(`[AGING] Successfully flagged ${updatedCount} orders`);

    return {
      success: true,
      updated_count: updatedCount,
      checked_count: checkedCount,
      updated_ids: updatedIds,
      timestamp,
      aging_threshold_days: AGING_DAYS,
    };

  } catch (error) {
    console.error('[AGING] Error:', error);
    return {
      success: false,
      updated_count: 0,
      checked_count: 0,
      updated_ids: [],
      timestamp,
      aging_threshold_days: AGING_DAYS,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);

  try {
    if (req.method === 'GET' && url.searchParams.get('health') === '1') {
      return new Response(
        JSON.stringify({
          service: 'reparatur-aging',
          version: '2.0.0',
          status: 'ready',
          table: 'auftraege',
          config: { aging_threshold_days: AGING_DAYS, checked_status: AGING_STATUS },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST') {
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length === 1 || (pathParts.length === 2 && pathParts[1] === 'run')) {
        console.log('[AGING] Manual trigger received');
        const result = await runAgingCheck();
        return new Response(
          JSON.stringify(result),
          { status: result.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Not found', path: url.pathname }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[ERROR] ${error}`);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
