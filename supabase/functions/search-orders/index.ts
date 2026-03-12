// search-orders: Search AM orders (documents, auftraege, projekte)
// Combines fulltext search (tsvector) with structured filters
//
// POST /functions/v1/search-orders
// Body: { query?: string, kategorie?: string, kunde?: string,
//         status?: string, datum_von?: string, datum_bis?: string, limit?: number }
// Returns: { results: [...], count: number, query: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCorsHeaders,
  checkRateLimit,
  validateQueryLength,
  validateISODate,
  sanitizeError,
} from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonResponse(body: unknown, status = 200, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate limiting
  const rateCheck = checkRateLimit(req);
  if (!rateCheck.allowed) {
    return jsonResponse({ error: "Rate limit exceeded. Try again in 1 minute." }, 429, corsHeaders);
  }

  try {
    const {
      query = null,
      kategorie = null,
      kunde = null,
      status = null,
      datum_von = null,
      datum_bis = null,
      limit = 20,
    } = await req.json();

    if (!query && !kategorie && !kunde && !status && !datum_von) {
      return jsonResponse(
        { error: "At least one search parameter is required" },
        400,
        corsHeaders,
      );
    }

    // Input validation
    if (query) {
      const queryError = validateQueryLength(query);
      if (queryError) {
        return jsonResponse({ error: queryError }, 400, corsHeaders);
      }
    }
    if (kunde) {
      const kundeError = validateQueryLength(kunde, 200);
      if (kundeError) {
        return jsonResponse({ error: "kunde parameter too long" }, 400, corsHeaders);
      }
    }
    if (datum_von && !validateISODate(datum_von)) {
      return jsonResponse({ error: "datum_von must be ISO format (YYYY-MM-DD)" }, 400, corsHeaders);
    }
    if (datum_bis && !validateISODate(datum_bis)) {
      return jsonResponse({ error: "datum_bis must be ISO format (YYYY-MM-DD)" }, 400, corsHeaders);
    }

    const maxResults = Math.min(Math.max(limit, 1), 100);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase.rpc("search_orders", {
      search_query: query,
      filter_kategorie: kategorie,
      filter_kunde: kunde,
      filter_status: status,
      filter_datum_von: datum_von,
      filter_datum_bis: datum_bis,
      max_results: maxResults,
    });

    if (error) {
      console.error("search_orders RPC error:", error.message);
      throw new Error("Search failed");
    }

    return jsonResponse({ results: data, count: data?.length ?? 0, query }, 200, corsHeaders);
  } catch (err) {
    return jsonResponse({ error: sanitizeError(err) }, 500, corsHeaders);
  }
});
