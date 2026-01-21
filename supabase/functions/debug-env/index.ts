// =============================================================================
// Debug Env - Analyse der Edge Runtime Environment Variables
// Version: 1.0 - 2026-01-15
// =============================================================================
// Minimal-Function zur Diagnose von Secret-Injection in Edge Runtime.
// WICHTIG: Loggt NIEMALS echte Secrets, nur Metadaten!
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Helper: Safe metadata extraction (no actual secret values)
function getSecretMetadata(value: string | undefined): {
  exists: boolean;
  len: number;
  isJWT: boolean;
  prefix: string;
  suffix: string;
} {
  if (!value) {
    return { exists: false, len: 0, isJWT: false, prefix: "(none)", suffix: "(none)" };
  }

  return {
    exists: true,
    len: value.length,
    isJWT: value.startsWith("eyJ") && value.includes("."),
    prefix: value.substring(0, 3) + "***", // First 3 chars masked
    suffix: "***" + value.substring(Math.max(0, value.length - 4)), // Last 4 chars
  };
}

Deno.serve(async (req: Request) => {
  // Only allow GET - no auth required for this diagnostic endpoint
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Collect all relevant env var metadata
  const envAnalysis = {
    // Reserved Supabase secrets (auto-injected by Edge Runtime)
    SUPABASE_URL: {
      exists: !!Deno.env.get("SUPABASE_URL"),
      value: Deno.env.get("SUPABASE_URL") || "(not set)", // URL is safe to show
    },
    SUPABASE_ANON_KEY: getSecretMetadata(Deno.env.get("SUPABASE_ANON_KEY")),
    SUPABASE_SERVICE_ROLE_KEY: getSecretMetadata(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),

    // Our custom secret (workaround)
    SVC_ROLE_KEY: getSecretMetadata(Deno.env.get("SVC_ROLE_KEY")),

    // Other custom secrets for comparison
    INTERNAL_API_KEY: getSecretMetadata(Deno.env.get("INTERNAL_API_KEY")),
    AZURE_CLIENT_SECRET: getSecretMetadata(Deno.env.get("AZURE_CLIENT_SECRET")),
    OPENAI_API_KEY: getSecretMetadata(Deno.env.get("OPENAI_API_KEY")),
  };

  // Runtime info
  const runtimeInfo = {
    deno_version: Deno.version.deno,
    typescript_version: Deno.version.typescript,
    v8_version: Deno.version.v8,
  };

  // Analysis summary
  const analysis = {
    reserved_key_problem: false,
    diagnosis: "",
    recommendation: "",
  };

  const reservedKey = envAnalysis.SUPABASE_SERVICE_ROLE_KEY;
  const customKey = envAnalysis.SVC_ROLE_KEY;

  if (!reservedKey.exists) {
    analysis.reserved_key_problem = true;
    analysis.diagnosis = "SUPABASE_SERVICE_ROLE_KEY not injected at all";
  } else if (!reservedKey.isJWT) {
    analysis.reserved_key_problem = true;
    analysis.diagnosis = `SUPABASE_SERVICE_ROLE_KEY exists but is NOT a JWT (len=${reservedKey.len}, expected ~219)`;
  } else if (reservedKey.len < 100) {
    analysis.reserved_key_problem = true;
    analysis.diagnosis = `SUPABASE_SERVICE_ROLE_KEY too short (len=${reservedKey.len}, expected ~219)`;
  } else {
    analysis.diagnosis = "SUPABASE_SERVICE_ROLE_KEY appears valid";
  }

  if (customKey.exists && customKey.isJWT && customKey.len > 200) {
    analysis.recommendation = analysis.reserved_key_problem
      ? "Use SVC_ROLE_KEY as primary (reserved key is broken)"
      : "Can remove SVC_ROLE_KEY fallback (reserved key works)";
  } else if (analysis.reserved_key_problem) {
    analysis.recommendation = "CRITICAL: Neither key is valid - Storage uploads will fail";
  } else {
    analysis.recommendation = "Use SUPABASE_SERVICE_ROLE_KEY (no custom fallback needed)";
  }

  // Compare both keys (are they the same?)
  const svcKey = Deno.env.get("SVC_ROLE_KEY");
  const reservedKeyVal = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const keysMatch = svcKey && reservedKeyVal && svcKey === reservedKeyVal;

  return new Response(
    JSON.stringify({
      service: "debug-env",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      runtime: runtimeInfo,
      env_vars: envAnalysis,
      keys_comparison: {
        both_exist: reservedKey.exists && customKey.exists,
        keys_identical: keysMatch,
        reserved_is_jwt: reservedKey.isJWT,
        custom_is_jwt: customKey.isJWT,
        len_diff: customKey.len - reservedKey.len,
      },
      analysis,
    }, null, 2),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
