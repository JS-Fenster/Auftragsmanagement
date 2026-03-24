// Shared security utilities for Edge Functions (v1.2)

// CORS: Only allow requests from our dashboard origin
const ALLOWED_ORIGINS = [
  "http://localhost:3000",       // Dashboard dev server
  "http://localhost:5173",       // Vite dev server
  "http://localhost:4173",       // Vite preview
  "https://js-fenster.de",
  "https://www.js-fenster.de",
  // Cloudflare Pages (AM-078)
  "https://auftragsmanagement.pages.dev",
  "https://am.js-fenster-intern.org",
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  // If origin matches allowlist, echo it back. Otherwise use first allowed origin.
  // Note: requests without Origin header (server-to-server, curl) get default origin.
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  // Log rejected origins for debugging
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    console.warn(`[CORS] Rejected origin: ${origin}`);
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// Simple in-memory rate limiter (per function instance, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute per IP

export function checkRateLimit(req: Request): { allowed: boolean; remaining: number } {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";

  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// Validate string input length
export function validateQueryLength(query: string, maxLength = 500): string | null {
  if (query.length > maxLength) {
    return `Query too long (max ${maxLength} characters)`;
  }
  return null;
}

// Validate ISO date format
export function validateISODate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

// Sanitize error messages (don't leak DB internals)
export function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;
    // Hide DB-internal details
    if (msg.includes("relation") || msg.includes("column") || msg.includes("schema")) {
      console.error("DB Error:", msg);
      return "Database query failed";
    }
    if (msg.includes("timeout") || msg.includes("TIMEOUT")) {
      return "Request timed out";
    }
    // Keep generic messages
    if (msg.startsWith("Search failed") || msg.startsWith("query")) {
      return msg;
    }
  }
  console.error("Unknown error:", err);
  return "Internal server error";
}
