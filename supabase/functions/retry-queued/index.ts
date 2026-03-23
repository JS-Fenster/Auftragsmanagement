// =============================================================================
// Retry Queued - Process all queued emails
// Version: 1.0.0 - 2026-01-16
// =============================================================================
// Findet alle E-Mails mit processing_status='queued' und triggert process-email.
// Kann manuell oder als Cron-Job ausgefuehrt werden.
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { notify } from "../_shared/notify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SVC_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");

interface QueuedEmail {
  id: string;
  email_message_id: string;
  email_postfach: string;
  email_betreff: string;
}

interface ProcessResult {
  id: string;
  betreff: string;
  status: "success" | "error";
  message?: string;
}

async function getQueuedEmails(): Promise<QueuedEmail[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/documents?processing_status=eq.queued&dokument_typ=eq.email&select=id,email_message_id,email_postfach,email_betreff&order=created_at`,
    {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch queued emails: ${await response.text()}`);
  }

  return await response.json();
}

async function processEmail(email: QueuedEmail): Promise<ProcessResult> {
  const result: ProcessResult = {
    id: email.id,
    betreff: email.email_betreff || "(kein Betreff)",
    status: "error",
  };

  if (!email.email_message_id || !email.email_postfach) {
    result.message = "Missing email_message_id or email_postfach";
    return result;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/process-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": INTERNAL_API_KEY || "",
        },
        body: JSON.stringify({
          document_id: email.id,
          email_message_id: email.email_message_id,
          postfach: email.email_postfach,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      result.status = "success";
      result.message = `Kategorie: ${data.kategorie}, Attachments: ${data.attachments_processed || 0}`;
    } else {
      const errorText = await response.text();
      result.message = `HTTP ${response.status}: ${errorText.substring(0, 100)}`;
    }
  } catch (error) {
    result.message = String(error);
  }

  return result;
}

Deno.serve(async (req: Request) => {
  // Health check
  if (req.method === "GET") {
    const queued = await getQueuedEmails();
    return new Response(
      JSON.stringify({
        service: "retry-queued",
        version: "1.0.0",
        status: "ready",
        queued_count: queued.length,
        queued_emails: queued.map(e => ({ id: e.id, betreff: e.email_betreff })),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!INTERNAL_API_KEY) {
    return new Response(
      JSON.stringify({ error: "INTERNAL_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log("[RETRY] Starting retry-queued processing...");

  try {
    const queuedEmails = await getQueuedEmails();
    console.log(`[RETRY] Found ${queuedEmails.length} queued email(s)`);

    if (queuedEmails.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No queued emails found",
          processed: 0,
          results: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const results: ProcessResult[] = [];

    for (const email of queuedEmails) {
      console.log(`[RETRY] Processing: ${email.email_betreff?.substring(0, 50)}...`);
      const result = await processEmail(email);
      results.push(result);
      console.log(`[RETRY]   -> ${result.status}: ${result.message}`);

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.status === "success").length;
    const errorCount = results.filter(r => r.status === "error").length;

    console.log(`[RETRY] Completed: ${successCount} success, ${errorCount} errors`);

    if (errorCount > 0) {
      await notify({
        type: 'warning',
        severity: 'high',
        source: 'edge_function',
        title: 'Retry-Queued: Fehler bei Verarbeitung',
        body: `${errorCount} von ${queuedEmails.length} Emails konnten nicht verarbeitet werden.`,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: queuedEmails.length,
        success_count: successCount,
        error_count: errorCount,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[RETRY] Error: ${error}`);
    await notify({
      type: 'error',
      severity: 'high',
      source: 'edge_function',
      title: 'Retry-Queued fehlgeschlagen',
      body: String(error),
    });
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
