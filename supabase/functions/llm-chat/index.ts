// llm-chat: LLM Orchestrator with tool execution
// Receives user message, calls GPT-5.x with tools, executes tool calls, returns answer
//
// POST /functions/v1/llm-chat
// Body: { message: string, history?: Array<{role, content}>, context?: string }
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
const MODEL = "gpt-5.4"; // Testing 5.4 with debug error output
const REASONING_EFFORT = "low";
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
    reasoning_effort: REASONING_EFFORT,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
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
    throw new Error(`LLM request failed (${resp.status}): ${err.substring(0, 300)}`);
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
    const systemContent = context
      ? `${systemWithDate}\n\nZusaetzlicher Kontext:\n${context}`
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
        return jsonResponse({
          answer: cleanResponse(choice.message.content),
          tool_calls: toolCallsLog,
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
        return jsonResponse({
          answer: null,
          tool_calls: toolCallsLog,
          pending_actions: pendingActions,
          model: MODEL,
        }, 200, corsHeaders);
      }
    }

    // Max rounds reached — force final answer without tools
    const finalResponse = await callLLM(
      messages as Array<{ role: string; content: string }>,
    );
    return jsonResponse({
      answer: cleanResponse(finalResponse.choices[0].message.content),
      tool_calls: toolCallsLog,
      model: MODEL,
    }, 200, corsHeaders);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("llm-chat fatal:", errMsg);
    // Temporarily expose LLM errors for debugging (remove after 5.4 test)
    if (errMsg.includes("LLM request failed")) {
      return jsonResponse({ error: errMsg }, 500, corsHeaders);
    }
    return jsonResponse({ error: sanitizeError(err) }, 500, corsHeaders);
  }
});
