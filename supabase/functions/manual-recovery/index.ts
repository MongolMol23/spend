import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}

function reply(body: object, status = 200) {
  return Response.json(body, { status, headers })
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers })
  if (request.method !== 'POST') return reply({}, 405)
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return reply({}, 401)
  const body = await request.json().catch(() => null)
  if (typeof body?.targetId !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(body.targetId)) {
    return reply({}, 400)
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const auth = { persistSession: false, autoRefreshToken: false }
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth, global: { headers: { Authorization: authorization } },
  })
  // PostgREST verifies the caller's JWT and the RPC checks the private admin allowlist.
  const { data: email, error: denied } = await caller.rpc('spend_recovery_target', { target_id: body.targetId })
  if (denied) return reply({}, 403)
  if (!email) return reply({}, 404)

  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth })
  const { data, error } = await service.auth.admin.generateLink({ type: 'recovery', email })
  if (error || !data.properties.hashed_token) return reply({}, 502)
  return reply({ token: data.properties.hashed_token })
})
