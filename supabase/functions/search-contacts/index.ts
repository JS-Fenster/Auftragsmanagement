// search-contacts: Fuzzy contact search using pg_trgm + fulltext
// Searches kontakte, kontakt_personen, kontakt_details
//
// POST /functions/v1/search-contacts
// Body: { query: string, typ?: "kunde"|"lieferant", limit?: number }
// Returns: { results: [...], count: number, query: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCorsHeaders,
  checkRateLimit,
  validateQueryLength,
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
    const { query, typ = null, limit = 20 } = await req.json();

    if (!query || typeof query !== "string") {
      return jsonResponse({ error: "query is required" }, 400, corsHeaders);
    }

    // Input validation
    const queryError = validateQueryLength(query);
    if (queryError) {
      return jsonResponse({ error: queryError }, 400, corsHeaders);
    }

    if (typ && !["kunde", "lieferant"].includes(typ)) {
      return jsonResponse({ error: "typ must be 'kunde' or 'lieferant'" }, 400, corsHeaders);
    }

    const maxResults = Math.min(Math.max(limit, 1), 50);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase.rpc("search_contacts", {
      search_query: query,
      filter_typ: typ,
      max_results: maxResults,
    });

    if (error) {
      console.error("search_contacts RPC error:", error.message);
      throw new Error("Search failed");
    }

    return jsonResponse({ results: data, count: data?.length ?? 0, query }, 200, corsHeaders);
  } catch (err) {
    return jsonResponse({ error: sanitizeError(err) }, 500, corsHeaders);
  }
});
