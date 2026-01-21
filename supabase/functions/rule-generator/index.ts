// =============================================================================
// Rule Generator - KI-generierte Klassifizierungsregeln
// Version: 1.0.0 - 2026-01-21
// =============================================================================
// Endpoints:
//   POST /rule-generator/generate    - Generate rule from evidence cluster
//   POST /rule-generator/backtest    - Run backtest for a rule
//   GET  /rule-generator/clusters    - Get ready clusters for rule generation
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Environment
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SVC_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =============================================================================
// CORS & Auth
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function validateApiKey(req: Request): boolean {
  if (!INTERNAL_API_KEY) return false;
  const apiKeyHeader = req.headers.get("x-api-key");
  if (apiKeyHeader === INTERNAL_API_KEY) return true;
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1] === INTERNAL_API_KEY) return true;
  }
  return false;
}

// =============================================================================
// Types
// =============================================================================

interface RuleConditions {
  OR?: Array<Record<string, unknown>>;
  AND?: Array<Record<string, unknown>>;
  domain?: { equals?: string; contains?: string };
  subject?: { contains?: string[]; pattern?: string };
  body_keywords?: { any_of?: string[] };
  attachment_type?: { any_of?: string[] };
  source?: { equals?: string };
}

interface DocumentFeatures {
  domain?: string;
  subject_tokens?: string[];
  body_keywords?: string[];
  ocr_keywords?: string[];
  attachment_types?: string[];
  has_attachments?: boolean;
  source?: string;
}

interface BacktestResult {
  match_count: number;
  true_positives: number;
  false_positives: number;
  precision: number;
  coverage: number;
  false_positive_ids: string[];
  tested_at: string;
  time_window_days: number;
  total_docs_tested: number;
}

// =============================================================================
// GPT Rule Generation
// =============================================================================

async function generateRuleWithGPT(
  evidenceDocs: Array<{
    id: string;
    email_betreff: string | null;
    email_von_email: string | null;
    email_body_text: string | null;
    rule_features: DocumentFeatures;
    target_email_kategorie: string | null;
    target_kategorie: string | null;
  }>,
  counterExamples: Array<{
    id: string;
    email_betreff: string | null;
    email_von_email: string | null;
    rule_features: DocumentFeatures;
    email_kategorie: string | null;
    kategorie: string | null;
  }>
): Promise<{
  conditions: RuleConditions;
  name: string;
  description: string;
  risk_notes: string;
}> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // Build examples for GPT (sanitized - no full body text)
  const positiveExamples = evidenceDocs.map(doc => ({
    betreff: doc.email_betreff?.substring(0, 100),
    absender: doc.email_von_email,
    domain: doc.rule_features?.domain,
    subject_tokens: doc.rule_features?.subject_tokens?.slice(0, 10),
    body_keywords: doc.rule_features?.body_keywords?.slice(0, 10),
    attachment_types: doc.rule_features?.attachment_types,
    target: doc.target_email_kategorie || doc.target_kategorie,
  }));

  const negativeExamples = counterExamples.map(doc => ({
    betreff: doc.email_betreff?.substring(0, 100),
    absender: doc.email_von_email,
    domain: doc.rule_features?.domain,
    subject_tokens: doc.rule_features?.subject_tokens?.slice(0, 10),
    current_kategorie: doc.email_kategorie || doc.kategorie,
  }));

  const targetKategorie = evidenceDocs[0]?.target_email_kategorie || evidenceDocs[0]?.target_kategorie;

  const systemPrompt = `Du bist ein Experte fuer Dokumentenklassifizierung.
Deine Aufgabe ist es, Klassifizierungsregeln zu erstellen, die aehnliche Dokumente erkennen.

WICHTIG:
- Regeln muessen ROBUST sein (nicht zu spezifisch auf einzelne Beispiele)
- Regeln duerfen NICHT zu breit sein (sonst viele False Positives)
- Bevorzuge Domain-Patterns und Schluesselwoerter im Betreff
- Vermeide Regeln die NUR auf einzelne Woerter matchen

OUTPUT FORMAT (JSON):
{
  "name": "Kurzer Name der Regel (max 50 Zeichen)",
  "description": "Beschreibung was diese Regel erkennt",
  "conditions": {
    // Verwende OR fuer alternative Bedingungen, AND fuer kombinierte
    // Moegliche Felder:
    // - domain: { equals: "example.com" } oder { contains: "example" }
    // - subject: { contains: ["wort1", "wort2"] } oder { pattern: "regex" }
    // - body_keywords: { any_of: ["keyword1", "keyword2"] }
    // - attachment_type: { any_of: ["pdf", "image"] }
    // - source: { equals: "email" | "scanner" }
  },
  "risk_notes": "Potentielle Risiken oder Edge Cases dieser Regel"
}`;

  const userPrompt = `Erstelle eine Klassifizierungsregel fuer die Kategorie "${targetKategorie}".

POSITIVE BEISPIELE (sollen matchen):
${JSON.stringify(positiveExamples, null, 2)}

NEGATIVE BEISPIELE (sollen NICHT matchen):
${JSON.stringify(negativeExamples, null, 2)}

Analysiere die Gemeinsamkeiten der positiven Beispiele und erstelle eine robuste Regel.
Die Regel soll die positiven Beispiele matchen, aber die negativen ausschliessen.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from GPT");
  }

  const parsed = JSON.parse(content);

  return {
    conditions: parsed.conditions || {},
    name: parsed.name || "Unnamed Rule",
    description: parsed.description || "",
    risk_notes: parsed.risk_notes || "",
  };
}

// =============================================================================
// Rule Matcher (for backtest)
// =============================================================================

function matchesCondition(
  features: DocumentFeatures,
  doc: { email_betreff?: string | null; email_body_text?: string | null },
  condition: Record<string, unknown>
): boolean {
  for (const [field, check] of Object.entries(condition)) {
    if (field === "OR") {
      const orConditions = check as Array<Record<string, unknown>>;
      const anyMatch = orConditions.some(c => matchesCondition(features, doc, c));
      if (!anyMatch) return false;
    } else if (field === "AND") {
      const andConditions = check as Array<Record<string, unknown>>;
      const allMatch = andConditions.every(c => matchesCondition(features, doc, c));
      if (!allMatch) return false;
    } else if (field === "domain") {
      const domainCheck = check as { equals?: string; contains?: string };
      const domain = features.domain?.toLowerCase() || "";
      if (domainCheck.equals && domain !== domainCheck.equals.toLowerCase()) return false;
      if (domainCheck.contains && !domain.includes(domainCheck.contains.toLowerCase())) return false;
    } else if (field === "subject") {
      const subjectCheck = check as { contains?: string[]; pattern?: string };
      const subject = doc.email_betreff?.toLowerCase() || "";
      if (subjectCheck.contains) {
        const anyContains = subjectCheck.contains.some(w => subject.includes(w.toLowerCase()));
        if (!anyContains) return false;
      }
      if (subjectCheck.pattern) {
        try {
          const regex = new RegExp(subjectCheck.pattern, "i");
          if (!regex.test(subject)) return false;
        } catch {
          return false;
        }
      }
    } else if (field === "body_keywords") {
      const bodyCheck = check as { any_of?: string[] };
      const bodyKeywords = features.body_keywords || [];
      if (bodyCheck.any_of) {
        const anyMatch = bodyCheck.any_of.some(k =>
          bodyKeywords.includes(k.toLowerCase()) ||
          (doc.email_body_text?.toLowerCase().includes(k.toLowerCase()) ?? false)
        );
        if (!anyMatch) return false;
      }
    } else if (field === "attachment_type") {
      const attachCheck = check as { any_of?: string[] };
      const attachTypes = features.attachment_types || [];
      if (attachCheck.any_of) {
        const anyMatch = attachCheck.any_of.some(t => attachTypes.includes(t));
        if (!anyMatch) return false;
      }
    } else if (field === "source") {
      const sourceCheck = check as { equals?: string };
      if (sourceCheck.equals && features.source !== sourceCheck.equals) return false;
    }
  }
  return true;
}

function matchesRule(
  conditions: RuleConditions,
  features: DocumentFeatures,
  doc: { email_betreff?: string | null; email_body_text?: string | null }
): boolean {
  // Handle top-level OR/AND
  if (conditions.OR) {
    return conditions.OR.some(c => matchesCondition(features, doc, c));
  }
  if (conditions.AND) {
    return conditions.AND.every(c => matchesCondition(features, doc, c));
  }
  // Direct conditions
  return matchesCondition(features, doc, conditions as Record<string, unknown>);
}

// =============================================================================
// Backtest Function
// =============================================================================

async function runBacktest(
  conditions: RuleConditions,
  targetEmailKategorie: string | null,
  targetKategorie: string | null,
  evidenceDocIds: string[],
  timeWindowDays: number = 30
): Promise<BacktestResult> {
  const since = new Date(Date.now() - timeWindowDays * 24 * 60 * 60 * 1000).toISOString();

  // Get historical documents (exclude evidence docs)
  const { data: docs, error } = await supabase
    .from("documents")
    .select(`
      id,
      email_betreff,
      email_body_text,
      rule_features,
      email_kategorie,
      email_kategorie_manual,
      kategorie,
      kategorie_manual,
      review_status
    `)
    .gte("created_at", since)
    .not("id", "in", `(${evidenceDocIds.join(",")})`)
    .limit(1000);

  if (error) {
    throw new Error(`Backtest query failed: ${error.message}`);
  }

  let matchCount = 0;
  let truePositives = 0;
  let falsePositives = 0;
  const falsePositiveIds: string[] = [];

  for (const doc of docs || []) {
    const features = (doc.rule_features || {}) as DocumentFeatures;

    if (matchesRule(conditions, features, doc)) {
      matchCount++;

      // Check if this is a true positive or false positive
      const actualEmailKat = doc.email_kategorie_manual || doc.email_kategorie;
      const actualKat = doc.kategorie_manual || doc.kategorie;

      const isCorrectEmail = !targetEmailKategorie || actualEmailKat === targetEmailKategorie;
      const isCorrectKat = !targetKategorie || actualKat === targetKategorie;

      if (isCorrectEmail && isCorrectKat) {
        truePositives++;
      } else {
        falsePositives++;
        if (falsePositiveIds.length < 10) {
          falsePositiveIds.push(doc.id);
        }
      }
    }
  }

  const totalDocs = docs?.length || 1;
  const precision = matchCount > 0 ? truePositives / matchCount : 0;
  const coverage = matchCount / totalDocs;

  return {
    match_count: matchCount,
    true_positives: truePositives,
    false_positives: falsePositives,
    precision: Math.round(precision * 1000) / 1000,
    coverage: Math.round(coverage * 1000) / 1000,
    false_positive_ids: falsePositiveIds,
    tested_at: new Date().toISOString(),
    time_window_days: timeWindowDays,
    total_docs_tested: totalDocs,
  };
}

// =============================================================================
// Generate Rule from Cluster
// =============================================================================

async function generateRuleFromCluster(clusterId: string): Promise<{
  rule_id: string;
  backtest_results: BacktestResult;
}> {
  // Get cluster
  const { data: cluster, error: clusterError } = await supabase
    .from("rule_evidence_clusters")
    .select("*")
    .eq("id", clusterId)
    .single();

  if (clusterError || !cluster) {
    throw new Error(`Cluster not found: ${clusterId}`);
  }

  if (cluster.status === "generated" && cluster.generated_rule_id) {
    throw new Error(`Cluster already has a generated rule: ${cluster.generated_rule_id}`);
  }

  // Mark cluster as generating
  await supabase
    .from("rule_evidence_clusters")
    .update({ status: "generating", updated_at: new Date().toISOString() })
    .eq("id", clusterId);

  try {
    // Get evidence documents
    const { data: evidenceDocs, error: evidenceError } = await supabase
      .from("documents")
      .select(`
        id,
        email_betreff,
        email_von_email,
        email_body_text,
        rule_features,
        email_kategorie_manual,
        kategorie_manual
      `)
      .in("id", cluster.evidence_document_ids || [])
      .limit(20);

    if (evidenceError || !evidenceDocs?.length) {
      throw new Error("Failed to load evidence documents");
    }

    // Map to include target categories
    const evidenceWithTargets = evidenceDocs.map(doc => ({
      ...doc,
      target_email_kategorie: doc.email_kategorie_manual || cluster.target_email_kategorie,
      target_kategorie: doc.kategorie_manual || cluster.target_kategorie,
    }));

    // Get counter-examples (different categories, similar timeframe)
    const { data: counterDocs } = await supabase
      .from("documents")
      .select(`
        id,
        email_betreff,
        email_von_email,
        rule_features,
        email_kategorie,
        kategorie
      `)
      .neq("email_kategorie", cluster.target_email_kategorie || "")
      .neq("kategorie", cluster.target_kategorie || "")
      .not("id", "in", `(${cluster.evidence_document_ids.join(",")})`)
      .limit(10);

    // Generate rule with GPT
    const { conditions, name, description, risk_notes } = await generateRuleWithGPT(
      evidenceWithTargets,
      counterDocs || []
    );

    // Run backtest
    const backtestResults = await runBacktest(
      conditions,
      cluster.target_email_kategorie,
      cluster.target_kategorie,
      cluster.evidence_document_ids
    );

    // Create draft rule
    const { data: rule, error: ruleError } = await supabase
      .from("classification_rules")
      .insert({
        name,
        description,
        conditions,
        target_email_kategorie: cluster.target_email_kategorie,
        target_kategorie: cluster.target_kategorie,
        status: "draft",
        evidence_count: cluster.evidence_count,
        evidence_document_ids: cluster.evidence_document_ids,
        backtest_matches: backtestResults.match_count,
        precision_estimate: backtestResults.precision,
        backtest_results: backtestResults,
        false_positive_ids: backtestResults.false_positive_ids,
        risk_notes,
        generation_model: "gpt-4o-mini",
        validation_metrics: {
          backtest_precision: backtestResults.precision,
          backtest_coverage: backtestResults.coverage,
          false_positive_count: backtestResults.false_positives,
        },
        created_by: "rule-generator",
      })
      .select()
      .single();

    if (ruleError) {
      throw new Error(`Failed to create rule: ${ruleError.message}`);
    }

    // Update cluster
    await supabase
      .from("rule_evidence_clusters")
      .update({
        status: "generated",
        generated_rule_id: rule.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clusterId);

    return {
      rule_id: rule.id,
      backtest_results: backtestResults,
    };
  } catch (error) {
    // Mark cluster as failed
    await supabase
      .from("rule_evidence_clusters")
      .update({
        status: "failed",
        generation_error: error instanceof Error ? error.message : String(error),
        updated_at: new Date().toISOString(),
      })
      .eq("id", clusterId);

    throw error;
  }
}

// =============================================================================
// Get Ready Clusters
// =============================================================================

async function getReadyClusters() {
  const { data, error } = await supabase
    .from("rule_evidence_clusters")
    .select(`
      id,
      created_at,
      cluster_key,
      target_email_kategorie,
      target_kategorie,
      evidence_count,
      status,
      cluster_features,
      last_evidence_at
    `)
    .in("status", ["ready", "collecting"])
    .gte("evidence_count", 5)
    .order("evidence_count", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Failed to load clusters: ${error.message}`);
  }

  return {
    clusters: data || [],
    count: data?.length || 0,
  };
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  try {
    // Health check
    if (req.method === "GET" && url.searchParams.get("health") === "1") {
      return new Response(
        JSON.stringify({
          service: "rule-generator",
          version: "1.0.0",
          status: "ready",
          configured: {
            supabase: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
            openai: !!OPENAI_API_KEY,
            internalApiKey: !!INTERNAL_API_KEY,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth required for all other endpoints
    if (!validateApiKey(req)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /rule-generator/generate
    if (req.method === "POST" && pathParts[1] === "generate") {
      const body = await req.json();
      const clusterId = body.cluster_id;

      if (!clusterId) {
        return new Response(
          JSON.stringify({ error: "cluster_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await generateRuleFromCluster(clusterId);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /rule-generator/backtest
    if (req.method === "POST" && pathParts[1] === "backtest") {
      const body = await req.json();
      const { rule_id, conditions, target_email_kategorie, target_kategorie, evidence_doc_ids } = body;

      if (!conditions) {
        return new Response(
          JSON.stringify({ error: "conditions required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await runBacktest(
        conditions,
        target_email_kategorie,
        target_kategorie,
        evidence_doc_ids || []
      );

      // Optionally update rule with backtest results
      if (rule_id) {
        await supabase
          .from("classification_rules")
          .update({
            backtest_results: result,
            backtest_matches: result.match_count,
            precision_estimate: result.precision,
            false_positive_ids: result.false_positive_ids,
            validation_metrics: {
              backtest_precision: result.precision,
              backtest_coverage: result.coverage,
              false_positive_count: result.false_positives,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", rule_id);
      }

      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /rule-generator/clusters
    if (req.method === "GET" && pathParts[1] === "clusters") {
      const result = await getReadyClusters();
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[ERROR] ${error}`);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
