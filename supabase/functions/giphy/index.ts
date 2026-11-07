// Supabase Edge Function: "giphy"
// Searches Giphy on behalf of the signed-in couple so the Giphy API key never reaches the browser.
//
//   - The key lives only in the function secret  GIPHY_KEY  (Supabase dashboard > Edge Functions > Secrets).
//   - Only a signed-in user who is a row in couple_members can use it (checked with their own token, so row-level
//     security does the work). Anonymous visitors and other accounts get 401/403.
//   - Only a tiny, validated request is forwarded (search words, offset, limit) and only id/title/thumb/url come back.
//
// Deploy: dashboard > Edge Functions > Deploy a new function > "Via Editor", paste this file, Deploy. Supabase assigns the URL name
// itself (e.g. dynamic-endpoint); the app's GIF_FN constant in app.js must match it.
// Then add the GIPHY_KEY secret. (CLI alternative: supabase functions deploy giphy)
// "Verify JWT": this function checks the signed-in user itself (below), so it is safe either way. If searches fail with
// "Invalid JWT" (newer Supabase projects sign tokens in a way the platform's legacy check can't read), switch Verify JWT OFF.
//
// Optional secret ALLOWED_ORIGINS: comma-separated list of sites allowed to call this from a browser.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://2xchary.github.io,http://localhost:5173').split(',').map((s) => s.trim());

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});
const reply = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405, origin);

  const key = Deno.env.get('GIPHY_KEY');
  if (!key) return reply({ error: 'The GIPHY_KEY secret is not set on this function.' }, 500, origin);

  // Who is asking? Their own token must be a real signed-in user AND be allowed to see a couple_members row.
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  // SUPABASE_ANON_KEY is provided to every function automatically. If your project has turned the older keys off,
  // add a secret named OWLERY_PUBLISHABLE_KEY holding your sb_publishable_... key instead.
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('OWLERY_PUBLISHABLE_KEY');
  if (!anon) return reply({ error: 'No Supabase key available to this function (add the OWLERY_PUBLISHABLE_KEY secret).' }, 500, origin);
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, anon, { global: { headers: { Authorization: auth } } });
  const { data: who } = await supa.auth.getUser(token);
  if (!who?.user) return reply({ error: 'Sign in first.' }, 401, origin);
  const { data: member } = await supa.from('couple_members').select('slot').limit(1);
  if (!member?.length) return reply({ error: 'Not allowed.' }, 403, origin);

  // Validate the request; never forward anything else to Giphy.
  let body: { q?: unknown; offset?: unknown; limit?: unknown } = {};
  try { body = await req.json(); } catch { /* empty body = trending */ }
  const q = typeof body.q === 'string' ? body.q.trim().slice(0, 60) : '';
  const offset = Math.min(Math.max(Number.isFinite(Number(body.offset)) ? Math.floor(Number(body.offset)) : 0, 0), 150);
  const limit = Math.min(Math.max(Number.isFinite(Number(body.limit)) ? Math.floor(Number(body.limit)) : 6, 1), 12);

  const url = new URL(`https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}`);
  url.searchParams.set('api_key', key);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('rating', 'pg-13');
  if (q) url.searchParams.set('q', q);

  let upstream: Response;
  try { upstream = await fetch(url); } catch { return reply({ error: 'Giphy could not be reached.' }, 502, origin); }
  if (!upstream.ok) return reply({ error: 'Giphy said no.', status: upstream.status }, 502, origin);

  const j = await upstream.json();
  const results = (j.data ?? []).map((g: any) => ({
    id: g.id,
    title: g.title ?? '',
    thumb: g.images?.fixed_width_small?.url ?? g.images?.fixed_width?.url ?? '',
    url: g.images?.fixed_width?.url ?? '',
  })).filter((r: { url: string }) => r.url);
  return reply({ results }, 200, origin);
});
