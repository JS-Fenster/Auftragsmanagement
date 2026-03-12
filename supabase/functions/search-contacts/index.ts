// search-contacts: Fuzzy contact search using pg_trgm + fulltext
// Searches kontakte, kontakt_personen, kontakt_details
//
// POST /functions/v1/search-contacts
// Body: { query: string, typ?: "kunde"|"lieferant", limit?: number }
// Returns: { results: [...], count: number, query: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query, typ = null, limit = 20 } = await req.json();

    if (!query || typeof query !== "string") {
      return jsonResponse({ error: "query is required" }, 400);
    }

    const maxResults = Math.min(Math.max(limit, 1), 50);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Combined search: trigram similarity on firma/name + fulltext on notes
    // Uses pg_trgm for fuzzy matching and tsvector for keyword search
    const { data, error } = await supabase.rpc("search_contacts", {
      search_query: query,
      filter_typ: typ,
      max_results: maxResults,
    });

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    return jsonResponse({ results: data, count: data?.length ?? 0, query });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
