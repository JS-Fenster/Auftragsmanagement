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
const MODEL = "gpt-5.2"; // GPT-5.x: only reasoning_effort, no temperature/top_p/max_tokens
const REASONING_EFFORT = "high"; // "medium" struggles with multi-turn tool use
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_KEY = Deno.env.get("VOYAGE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonResponse(body: unknown, status = 200, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Embed query for search_knowledge (Voyage AI)
async function embedQuery(text: string): Promise<number[]> {
  const resp = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VOYAGE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "voyage-3-large",
      input: [text],
      input_type: "query",
      output_dimension: 2048,
    }),
  });
  if (!resp.ok) throw new Error(`Voyage API error: ${resp.status}`);
  const data = await resp.json();
  return data.data[0].embedding;
}

// Execute a tool call against DB
async function executeTool(
  supabase: ReturnType<typeof createClient>,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "search_knowledge": {
      const embedding = await embedQuery(args.query as string);
      const vecStr = `[${embedding.join(",")}]`;
      const { data, error } = await supabase.rpc("search_kb_chunks", {
        query_embedding: vecStr,
        match_count: (args.top_k as number) || 5,
        filter_path: (args.filter_path as string) || null,
      });
      if (error) throw new Error(`search_knowledge failed`);
      return data;
    }
    case "search_contacts": {
      const { data, error } = await supabase.rpc("search_contacts", {
        search_query: args.query as string,
        filter_typ: (args.typ as string) || null,
        max_results: Math.min((args.limit as number) || 10, 50),
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

// Call OpenAI API (GPT-5.x rules: only reasoning_effort, no temperature/top_p/max_tokens)
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

    // Build message array
    const systemContent = context
      ? `${SYSTEM_PROMPT}\n\nZusaetzlicher Kontext:\n${context}`
      : SYSTEM_PROMPT;

    const messages: Array<{ role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }> = [
      { role: "system", content: systemContent },
      ...history.slice(-20), // Keep last 20 messages for context
      { role: "user", content: message },
    ];

    // Tool execution loop (max 3 rounds to prevent infinite loops)
    const MAX_ROUNDS = 3;
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
          answer: choice.message.content,
          tool_calls: toolCallsLog,
          model: MODEL,
        }, 200, corsHeaders);
      }

      // Execute tool calls — check for action tools that need confirmation
      messages.push(choice.message);

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
      answer: finalResponse.choices[0].message.content,
      tool_calls: toolCallsLog,
      model: MODEL,
    }, 200, corsHeaders);
  } catch (err) {
    return jsonResponse({ error: sanitizeError(err) }, 500, corsHeaders);
  }
});
