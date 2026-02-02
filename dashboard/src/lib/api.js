import { supabaseAnonKey, supabaseUrl } from './supabase'

const BASE = `${supabaseUrl}/functions/v1`

export async function apiFetch(path, options = {}) {
  const { method = 'GET', body, headers: extraHeaders = {} } = options

  const headers = {
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'apikey': supabaseAnonKey,
    ...extraHeaders,
  }

  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || err.message || `HTTP ${res.status}`)
  }

  return res.json()
}
