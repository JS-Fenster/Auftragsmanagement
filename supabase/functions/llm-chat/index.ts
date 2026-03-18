// llm-chat: LLM Orchestrator with tool execution
// Receives user message, calls GPT-5.x with tools, executes tool calls, returns answer
//
// POST /functions/v1/llm-chat
// Body: { message: string, history?: Array<{role, content}>, context?: string | {page, entity_type?, entity_id?, entity_name?, kunde_id?, kunde_name?} }
// Returns: { answer: string, tool_calls?: Array<{name, args, result}>, model: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  TOOL_DEFINITIONS,
  SYSTEM_PROMPT,
  ACTION_TOOLS,
} from "../_shared/tool-definitions.ts";
import {
  getCorsHeaders,
  checkRateLimit,
  validateQueryLength,
  sanitizeError,
} from "../_shared/security.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5.4"; // Winner of A/B test: no leaks, faster, no content-policy issues
const REASONING_EFFORT = "low"; // Only used for final answer (no tools)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Clean leaked reasoning artifacts from LLM response text
function cleanResponse(text: string | null): string | null {
  if (!text) return text;
  let cleanText = text.replace(/^\s+/, "");
  // Cut at 3+ consecutive newlines
  const tripleNewline = cleanText.search(/\n{3,}/);
  if (tripleNewline > 0) {
    cleanText = cleanText.substring(0, tripleNewline);
  }
  // Remove English reasoning fragments
  cleanText = cleanText.replace(/\n(?:Ok|Stop|Let's|Need|Oops|I (?:should|must|will|think)|Hmm|Proceed)[\s\S]*$/i, "");
  // Remove trailing JSON/tool-call artifacts
  cleanText = cleanText.replace(/\n?\{\"(?:query|tool)[\s\S]*$/g, "");
  cleanText = cleanText.replace(/\nto=functions\.[\s\S]*$/g, "");
  // Remove German reasoning leaks: parenthesized self-talk
  cleanText = cleanText.replace(/\n?\((?:Ohne weitere|Noch kein|Kein weiteres|Erneut|ich (?:muss|nutze|starte|versuche|fuehre)|Ohne|stattdessen)[^)]*\)/gi, "");
  // Remove self-commentary lines
  cleanText = cleanText.replace(/\n(?:Ich (?:muss|versuche|starte|fuehre|erweitere|nutze) (?:tatsaechlich|nochmal|jetzt|die|noch|eine)[^\n]*)/gi, "");
  // Remove "sorry" / apology lines
  cleanText = cleanText.replace(/\n?(?:Sorry|Entschuldigung|Verzeihung)[.,!]?[^\n]*/gi, "");
  return cleanText.trim() || null;
}

function jsonResponse(body: unknown, status = 200, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Call search-knowledge Edge Function (shared pipeline for all KB search modes)
// Anon key is public/client-side — safe to use here for JWT validation
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbWpnZHVqbHBueWRic2Z1aWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NjY0NTcsImV4cCI6MjA4MTM0MjQ1N30.da6ZwbEfqhqdsZlKYNUGP7uvu8A7qwlVLBI0IK4uQfc";

async function callSearchKnowledge(
  args: Record<string, unknown>,
  mode: string,
): Promise<unknown> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/search-knowledge`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: args.query,
      mode,
      top_k: (args.top_k as number) || 5,
      rerank: (args.rerank as boolean) || false,
      filter_path: (args.filter_path as string) || null,
      filter_projekt: (args.filter_projekt as string) || null,
      filter_typ: (args.filter_typ as string) || null,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`search-knowledge failed (${resp.status}): ${err}`);
  }
  const data = await resp.json();
  return data.results;
}

// Execute a tool call against DB
async function executeTool(
  supabase: ReturnType<typeof createClient>,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "search_knowledge":
      return await callSearchKnowledge(args, "semantic");
    case "keyword_search":
      return await callSearchKnowledge(args, "keyword");
    case "hybrid_search":
      return await callSearchKnowledge(args, "hybrid");
    case "search_contacts": {
      const { data, error } = await supabase.rpc("search_contacts", {
        search_query: (args.query as string) || null,
        filter_typ: (args.typ as string) || null,
        max_results: Math.min((args.limit as number) || 10, 50),
        filter_ort: (args.ort as string) || null,
        filter_plz: (args.plz as string) || null,
        filter_name_pattern: (args.name_pattern as string) || null,
      });
      if (error) throw new Error(`search_contacts failed`);
      return data;
    }
    case "search_orders": {
      const { data, error } = await supabase.rpc("search_orders", {
        search_query: (args.query as string) || null,
        filter_kategorie: (args.kategorie as string) || null,
        filter_kunde: (args.kunde as string) || null,
        filter_status: (args.status as string) || null,
        filter_datum_von: (args.datum_von as string) || null,
        filter_datum_bis: (args.datum_bis as string) || null,
        max_results: Math.min((args.limit as number) || 20, 100),
      });
      if (error) throw new Error(`search_orders failed`);
      return data;
    }
    case "update_document_kategorie": {
      // Action tool: update document category
      const { data, error } = await supabase
        .from("documents")
        .update({
          kategorie_manual: args.neue_kategorie as string,
          kategorie_manual_grund: args.grund as string,
          kategorie_manual_am: new Date().toISOString(),
          kategorie_manual_von: "jess-assistant",
        })
        .eq("id", args.document_id as string)
        .select("id, email_betreff, kategorie, kategorie_manual")
        .single();
      if (error) throw new Error("update_document_kategorie failed");
      return data;
    }
    // LLM-016: New action tools
    case "add_project_note": {
      const projektId = args.projekt_id as string;
      const noteText = args.text as string;
      const timestamp = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

      // Append to projekte.notizen field (same pattern as Dashboard UI)
      const { data: projekt } = await supabase
        .from("projekte")
        .select("notizen")
        .eq("id", projektId)
        .single();
      const existing = projekt?.notizen || "";
      const updated = existing
        ? `${existing}\n\n[${timestamp} - Jess]\n${noteText}`
        : `[${timestamp} - Jess]\n${noteText}`;
      await supabase.from("projekte").update({ notizen: updated }).eq("id", projektId);

      // Also create historie entry for timeline
      const { data, error } = await supabase
        .from("projekt_historie")
        .insert({
          projekt_id: projektId,
          aktion: "notiz",
          feld: "notizen",
          neuer_wert: noteText,
          erstellt_von: "jess-assistant",
        })
        .select("id, projekt_id, aktion, neuer_wert, erstellt_am")
        .single();
      if (error) throw new Error("add_project_note failed");
      return data;
    }
    case "update_project_status": {
      const { data, error } = await supabase.rpc("update_projekt_status", {
        p_projekt_id: args.projekt_id as string,
        p_neuer_status: args.neuer_status as string,
        p_kommentar: (args.kommentar as string) || null,
      });
      if (error) throw new Error("update_project_status failed");
      return data;
    }
    case "update_contact_data": {
      const field = args.field as string;
      const value = args.value as string;
      const kontaktId = args.kontakt_id as string;

      if (field === "telefon" || field === "email") {
        // Update or insert in kontakt_details via the primary contact person
        const { data: person } = await supabase
          .from("kontakt_personen")
          .select("id")
          .eq("kontakt_id", kontaktId)
          .eq("ist_hauptkontakt", true)
          .single();

        if (!person) throw new Error("Hauptkontakt-Person nicht gefunden");

        const detailTyp = field === "telefon" ? "telefon" : "email";
        // Check if primary detail exists
        const { data: existing } = await supabase
          .from("kontakt_details")
          .select("id")
          .eq("kontakt_person_id", person.id)
          .eq("typ", detailTyp)
          .eq("ist_primaer", true)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("kontakt_details")
            .update({ wert: value })
            .eq("id", existing.id);
          if (error) throw new Error("update_contact_data failed");
        } else {
          const { error } = await supabase
            .from("kontakt_details")
            .insert({
              kontakt_person_id: person.id,
              typ: detailTyp,
              wert: value,
              ist_primaer: true,
            });
          if (error) throw new Error("update_contact_data insert failed");
        }
        return { kontakt_id: kontaktId, field, value, updated: true };
      } else if (field === "adresse") {
        // Update address on kontakte table
        const { error } = await supabase
          .from("kontakte")
          .update({ strasse: value })
          .eq("id", kontaktId);
        if (error) throw new Error("update_contact_data address failed");
        return { kontakt_id: kontaktId, field, value, updated: true };
      } else if (field === "notizen") {
        const { error } = await supabase
          .from("kontakte")
          .update({ notiz: value })
          .eq("id", kontaktId);
        if (error) throw new Error("update_contact_data notes failed");
        return { kontakt_id: kontaktId, field, value, updated: true };
      }
      throw new Error(`Unknown contact field: ${field}`);
    }
    case "assign_document_to_project": {
      const { data, error } = await supabase
        .from("projekt_dokumente")
        .insert({
          projekt_id: args.projekt_id as string,
          document_id: args.document_id as string,
        })
        .select("id, projekt_id, document_id")
        .single();
      if (error) throw new Error("assign_document_to_project failed");
      return data;
    }
    // LLM-013: Semantic email search via Voyage AI embeddings
    case "search_emails": {
      const voyageResp = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("VOYAGE_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: [args.query as string],
          model: "voyage-3",
        }),
      });
      if (!voyageResp.ok) throw new Error("Embedding generation failed");
      const voyageData = await voyageResp.json();
      const queryEmbedding = voyageData.data[0].embedding;

      const { data, error } = await supabase.rpc("search_emails_semantic", {
        p_query_embedding: JSON.stringify(queryEmbedding),
        p_absender: (args.absender as string) || null,
        p_kategorie: (args.kategorie as string) || null,
        p_datum_von: (args.datum_von as string) || null,
        p_datum_bis: (args.datum_bis as string) || null,
        p_limit: Math.min((args.limit as number) || 10, 50),
      });
      if (error) throw new Error("search_emails failed");
      return data;
    }
    // LLM-012: Report generation
    case "generate_report": {
      const reportType = args.report_type as string;
      const params = (args.parameters || {}) as Record<string, unknown>;

      // Map report_type to RPC
      const rpcMap: Record<string, string> = {
        finanzbericht: "query_report_finanzen",
        projekt_zusammenfassung: "query_report_projekt",
        kunden_historie: "query_report_kunde",
        pipeline_analyse: "query_report_pipeline",
        offene_posten: "query_report_offene_posten",
        montage_uebersicht: "query_report_montage",
      };

      const rpcName = rpcMap[reportType];
      if (!rpcName) throw new Error(`Unknown report type: ${reportType}`);

      // Build RPC params based on type — provide sensible defaults for date-range RPCs
      const rpcParams: Record<string, unknown> = {};
      const needsDates = ["finanzbericht", "montage_uebersicht"].includes(reportType);
      if (params.zeitraum_von) {
        rpcParams.p_von = params.zeitraum_von;
      } else if (needsDates) {
        // Default: start of current year
        rpcParams.p_von = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
      }
      if (params.zeitraum_bis) {
        rpcParams.p_bis = params.zeitraum_bis;
      } else if (needsDates) {
        // Default: today
        rpcParams.p_bis = new Date().toISOString().slice(0, 10);
      }
      if (params.projekt_id) rpcParams.p_projekt_id = params.projekt_id;
      if (params.kunde_id) rpcParams.p_kunde_id = params.kunde_id;

      const { data, error } = await supabase.rpc(rpcName, rpcParams);
      if (error) throw new Error(`Report RPC ${rpcName} failed`);

      // Upsert template for reuse
      await supabase.from("jess_report_templates").upsert({
        report_type: reportType,
        titel: args.titel as string,
        parameters: params,
        use_count: 1,
        last_used_at: new Date().toISOString(),
      }, { onConflict: "report_type" }).select();

      return {
        report_id: crypto.randomUUID(),
        report_type: reportType,
        titel: args.titel as string,
        data,
      };
    }
    // LLM-021: Analytics metrics
    case "query_analytics": {
      const metric = args.metric as string;

      const metricRpcMap: Record<string, string> = {
        umsatz_monatlich: "analytics_umsatz_monatlich",
        dokumente_pro_kategorie: "analytics_dokumente_pro_kategorie",
        projekte_pro_status: "analytics_projekte_pro_status",
        offene_rechnungen_summe: "analytics_offene_rechnungen_summe",
        email_volumen: "analytics_email_volumen",
        durchlaufzeit_projekte: "analytics_durchlaufzeit_projekte",
        top_kunden_umsatz: "analytics_top_kunden_umsatz",
      };

      const rpcName = metricRpcMap[metric];
      if (!rpcName) throw new Error(`Unknown metric: ${metric}`);

      const rpcParams: Record<string, unknown> = {};
      if (args.zeitraum_von) rpcParams.p_von = args.zeitraum_von;
      if (args.zeitraum_bis) rpcParams.p_bis = args.zeitraum_bis;
      if (args.gruppierung) rpcParams.p_gruppierung = args.gruppierung;
      if (args.limit) rpcParams.p_limit = Math.min(args.limit as number, 50);

      const { data, error } = await supabase.rpc(rpcName, rpcParams);
      if (error) throw new Error(`Analytics RPC ${rpcName} failed`);
      return data;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Call OpenAI API (GPT-5.x rules: no temperature/top_p/max_tokens)
async function callLLM(
  messages: Array<{ role: string; content: string }>,
  tools?: typeof TOOL_DEFINITIONS,
) {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
  };
  if (tools && tools.length > 0) {
    // GPT-5.4: reasoning_effort + tools not supported in chat/completions
    body.tools = tools;
  } else if (REASONING_EFFORT) {
    // Only set reasoning_effort when no tools (final answer)
    body.reasoning_effort = REASONING_EFFORT;
  }

  const resp = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error("OpenAI API error:", resp.status, err);
    throw new Error(`LLM request failed (${resp.status})`);
  }

  return await resp.json();
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate limiting (lower for LLM calls — more expensive)
  const rateCheck = checkRateLimit(req);
  if (!rateCheck.allowed) {
    return jsonResponse({ error: "Rate limit exceeded. Try again in 1 minute." }, 429, corsHeaders);
  }

  try {
    const { message, history = [], context = null, confirm_action = null } = await req.json();

    if (!message || typeof message !== "string") {
      return jsonResponse({ error: "message is required" }, 400, corsHeaders);
    }

    // Input validation
    const msgError = validateQueryLength(message, 2000);
    if (msgError) {
      return jsonResponse({ error: "Message too long (max 2000 characters)" }, 400, corsHeaders);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Build message array with current timestamp so Jess knows "today"
    const now = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
    const systemWithDate = `${SYSTEM_PROMPT}\n\nAktuelles Datum und Uhrzeit (Europe/Berlin): ${now}`;
    // Build context string from structured or plain context
    let contextStr = '';
    if (context && typeof context === 'object' && context.page) {
      const parts = [`Der User befindet sich auf der Seite '${context.page}'.`];
      if (context.entity_type && context.entity_id) {
        const name = context.entity_name ? ` '${context.entity_name}'` : '';
        parts.push(`Er schaut sich ${context.entity_type}${name} (ID: ${context.entity_id}) an.`);
      }
      if (context.kunde_id) {
        const kName = context.kunde_name ? ` '${context.kunde_name}'` : '';
        parts.push(`Zugehoeriger Kunde:${kName} (ID: ${context.kunde_id}).`);
      }
      contextStr = parts.join(' ');
    } else if (context && typeof context === 'string') {
      contextStr = context;
    }

    const systemContent = contextStr
      ? `${systemWithDate}\n\nAktueller Dashboard-Kontext:\n${contextStr}`
      : systemWithDate;

    const messages: Array<{ role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }> = [
      { role: "system", content: systemContent },
      ...history.slice(-20), // Keep last 20 messages for context
      { role: "user", content: message },
    ];

    // Tool execution loop (max 2 rounds — more causes reasoning loops)
    const MAX_ROUNDS = 2;
    const toolCallsLog: Array<{ name: string; args: unknown; result: unknown }> = [];

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await callLLM(
        messages as Array<{ role: string; content: string }>,
        TOOL_DEFINITIONS,
      );
      const choice = response.choices[0];

      // No tool calls — return final answer
      if (choice.finish_reason !== "tool_calls" || !choice.message.tool_calls) {
        // LLM-012: Include report data if generate_report was called
        const reportResult = toolCallsLog.find(tc => tc.name === "generate_report");
        return jsonResponse({
          answer: cleanResponse(choice.message.content),
          tool_calls: toolCallsLog,
          ...(reportResult ? { report: reportResult.result } : {}),
          model: MODEL,
        }, 200, corsHeaders);
      }

      // Execute tool calls — check for action tools that need confirmation
      // Strip reasoning_content (output-only field, causes 400 if sent back)
      const assistantMsg: Record<string, unknown> = {
        role: "assistant",
        content: choice.message.content ?? null,
      };
      if (choice.message.tool_calls) {
        assistantMsg.tool_calls = choice.message.tool_calls;
      }
      messages.push(assistantMsg as typeof messages[0]);

      const pendingActions: Array<{ tool_call_id: string; name: string; args: Record<string, unknown>; description: string }> = [];

      for (const toolCall of choice.message.tool_calls) {
        const fnName = toolCall.function.name;
        const fnArgs = JSON.parse(toolCall.function.arguments);

        // LLM-011: Action tools require user confirmation
        if (ACTION_TOOLS.has(fnName) && !confirm_action) {
          pendingActions.push({
            tool_call_id: toolCall.id,
            name: fnName,
            args: fnArgs,
            description: `${fnName}: ${JSON.stringify(fnArgs)}`,
          });
          continue;
        }

        let result: unknown;
        try {
          result = await executeTool(supabase, fnName, fnArgs);
        } catch (err) {
          result = { error: "Tool execution failed" };
          console.error(`Tool ${fnName} error:`, err);
        }

        toolCallsLog.push({ name: fnName, args: fnArgs, result });

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // If there are pending actions, return them for user confirmation
      if (pendingActions.length > 0) {
        const pendingReportResult = toolCallsLog.find(tc => tc.name === "generate_report");
        return jsonResponse({
          answer: null,
          tool_calls: toolCallsLog,
          pending_actions: pendingActions,
          ...(pendingReportResult ? { report: pendingReportResult.result } : {}),
          model: MODEL,
        }, 200, corsHeaders);
      }
    }

    // Max rounds reached — force final answer without tools
    const finalResponse = await callLLM(
      messages as Array<{ role: string; content: string }>,
    );
    // LLM-012: Include report data if generate_report was called
    const reportResult = toolCallsLog.find(tc => tc.name === "generate_report");
    return jsonResponse({
      answer: cleanResponse(finalResponse.choices[0].message.content),
      tool_calls: toolCallsLog,
      ...(reportResult ? { report: reportResult.result } : {}),
      model: MODEL,
    }, 200, corsHeaders);
  } catch (err) {
    console.error("llm-chat fatal:", err instanceof Error ? err.message : err);
    return jsonResponse({ error: sanitizeError(err) }, 500, corsHeaders);
  }
});
