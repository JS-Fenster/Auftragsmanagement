import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { action, mitarbeiter_id, email, vorname, nachname } = await req.json();

    // CREATE: Invite user by email → sends password setup link
    if (action === 'create') {
      if (!email || !mitarbeiter_id) {
        return new Response(JSON.stringify({ error: 'email and mitarbeiter_id required' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }

      const { data: authUser, error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: {
          mitarbeiter_id,
          vorname: vorname || '',
          nachname: nachname || '',
          rolle: 'mitarbeiter',
        },
        redirectTo: 'https://am.js-fenster-intern.org/',
      });

      if (authError) {
        console.error('Auth create error:', authError);
        return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }

      // Link auth user to mitarbeiter
      await supabase.from('mitarbeiter').update({ auth_user_id: authUser.user.id }).eq('id', mitarbeiter_id);

      return new Response(JSON.stringify({ success: true, auth_user_id: authUser.user.id }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // DISABLE: Ban user (no login possible)
    if (action === 'disable') {
      if (!mitarbeiter_id) {
        return new Response(JSON.stringify({ error: 'mitarbeiter_id required' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }

      const { data: ma } = await supabase.from('mitarbeiter').select('auth_user_id').eq('id', mitarbeiter_id).single();
      if (!ma?.auth_user_id) {
        return new Response(JSON.stringify({ error: 'Kein Auth-User verknuepft' }), { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }

      const { error } = await supabase.auth.admin.updateUserById(ma.auth_user_id, { ban_duration: '876000h' });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

      return new Response(JSON.stringify({ success: true, action: 'disabled' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ENABLE: Unban user (login possible again)
    if (action === 'enable') {
      if (!mitarbeiter_id) {
        return new Response(JSON.stringify({ error: 'mitarbeiter_id required' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }

      const { data: ma } = await supabase.from('mitarbeiter').select('auth_user_id').eq('id', mitarbeiter_id).single();
      if (!ma?.auth_user_id) {
        return new Response(JSON.stringify({ error: 'Kein Auth-User verknuepft' }), { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }

      const { error } = await supabase.auth.admin.updateUserById(ma.auth_user_id, { ban_duration: 'none' });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

      return new Response(JSON.stringify({ success: true, action: 'enabled' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action. Use: create, disable, enable' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('manage-auth error:', err);
    return new Response(JSON.stringify({ error: 'Interner Fehler' }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
