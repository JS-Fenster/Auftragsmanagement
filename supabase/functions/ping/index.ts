import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response('{"status":"ok"}', {
  headers: { "Content-Type": "application/json" },
}));
