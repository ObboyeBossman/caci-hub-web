import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/** DB column name → CSV header (stable order for `columns` query). */
const COLUMN_ORDER = [
  'membership_number',
  'first_name',
  'last_name',
  'gender',
  'date_of_birth',
  'primary_phone',
  'secondary_phone',
  'email',
  'physical_address',
  'occupation',
  'marital_status',
  'membership_status',
  'join_date',
  'created_at',
  'updated_at',
] as const

const HEADER_LABEL: Record<string, string> = {
  membership_number: 'Membership Number',
  first_name: 'First Name',
  last_name: 'Last Name',
  gender: 'Gender',
  date_of_birth: 'Date of Birth',
  primary_phone: 'Primary Phone',
  secondary_phone: 'Secondary Phone',
  email: 'Email',
  physical_address: 'Physical Address',
  occupation: 'Occupation',
  marital_status: 'Marital Status',
  membership_status: 'Membership Status',
  join_date: 'Join Date',
  created_at: 'Created At',
  updated_at: 'Updated At',
}

const ALLOWED = new Set<string>(COLUMN_ORDER)

function escapeCell(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

function resolveColumns(columnsParam: string | null): string[] | Response {
  if (columnsParam == null || columnsParam.trim() === '') {
    return [...COLUMN_ORDER]
  }
  const requested = [...new Set(columnsParam.split(',').map((s) => s.trim()).filter(Boolean))]
  if (requested.length === 0) {
    return [...COLUMN_ORDER]
  }
  for (const key of requested) {
    if (!ALLOWED.has(key)) {
      return new Response(JSON.stringify({ error: `Invalid column: ${key}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }
  return COLUMN_ORDER.filter((k) => requested.includes(k))
}

/**
 * Column selection from the client.
 * Supabase’s gateway often does NOT forward `?columns=` on the request URL to the
 * worker, so GET query params are unreliable. POST JSON body is the supported path.
 */
async function readColumnsParam(req: Request): Promise<string | null> {
  if (req.method === 'POST') {
    const ct = req.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      try {
        const raw = await req.text()
        if (!raw.trim()) return null
        const body = JSON.parse(raw) as { columns?: unknown }
        if (body.columns != null) {
          if (typeof body.columns === 'string') return body.columns
          if (Array.isArray(body.columns)) {
            return body.columns.map(String).filter(Boolean).join(',')
          }
        }
      } catch {
        return null
      }
    }
  }
  try {
    return new URL(req.url).searchParams.get('columns')
  } catch {
    return null
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    // ── 2. Role check (Admin ONLY) ───────────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, assembly_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    if (profile.role !== 'admin') {
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    const columnsParam = await readColumnsParam(req)
    const columnsResolved = resolveColumns(columnsParam)
    if (columnsResolved instanceof Response) return columnsResolved

    // ── 3. Fetch active members ──────────────────────────────────────────────
    // CRITICAL: Do NOT include pastoral_notes in the SELECT (IMR-06)
    const { data: members, error: fetchError } = await supabase
      .from('members')
      .select(`
        membership_number, first_name, last_name, gender,
        date_of_birth, primary_phone, secondary_phone, email, physical_address,
        occupation, marital_status, membership_status, join_date,
        created_at, updated_at
      `)
      .eq('assembly_id', profile.assembly_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('last_name')

    if (fetchError || !members) {
      return new Response(JSON.stringify({ error: 'Failed to fetch members' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 4. Build CSV string ──────────────────────────────────────────────────
    const headers = columnsResolved.map((k) => HEADER_LABEL[k])

    const rows = members.map((m) =>
      columnsResolved
        .map((k) => escapeCell((m as Record<string, unknown>)[k]))
        .join(','),
    )

    const csv = [headers.map(escapeCell).join(','), ...rows].join('\n')

    const today = new Date().toISOString().split('T')[0]
    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="CACI_Members_Export_${today}.csv"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
