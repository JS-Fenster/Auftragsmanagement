// search-orders: Search AM orders (documents, auftraege, projekte)
// Combines fulltext search (tsvector) with structured filters
//
// POST /functions/v1/search-orders
// Body: { query?: string, kategorie?: string, kunde?: string,
//         status?: string, datum_von?: string, datum_bis?: string, limit?: number }
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
      );
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
      throw new Error(`Search failed: ${error.message}`);
    }

    return jsonResponse({ results: data, count: data?.length ?? 0, query });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
