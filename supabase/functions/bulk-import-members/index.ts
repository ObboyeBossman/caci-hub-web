import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile, error: profileError } = await supabaseUser
      .from('user_profiles')
      .select('role, assembly_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !['admin', 'secretary'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const assemblyId = profile.assembly_id as string

    const { members } = await req.json()
    if (!Array.isArray(members)) {
      return new Response(JSON.stringify({ error: 'Members array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Fetch existing phone numbers in the assembly to deduplicate
    const { data: existingMembers, error: fetchErr } = await supabaseAdmin
      .from('members')
      .select('primary_phone, secondary_phone, first_name, last_name')
      .eq('assembly_id', assemblyId)
      .not('primary_phone', 'is', null)

    if (fetchErr) throw fetchErr

    const existingPhones = new Map(
      existingMembers.map(m => [m.primary_phone, `${m.first_name} ${m.last_name}`])
    )

    const validRows: any[] = []
    const errors: { row: number, reason: string }[] = []

    members.forEach((m, index) => {
      const rowIndex = index + 1
      
      // Basic validation (Zod validation should have happened on client, but safety first)
      if (!m.first_name || !m.last_name) {
        errors.push({ row: rowIndex, reason: 'Missing required field: first_name or last_name' })
        return
      }

      if (m.primary_phone && existingPhones.has(m.primary_phone)) {
        errors.push({ 
          row: rowIndex, 
          reason: `Duplicate phone: ${m.primary_phone} (exists for ${existingPhones.get(m.primary_phone)})` 
        })
        return
      }

      validRows.push({
        ...m,
        assembly_id: assemblyId,
        created_by: user.id
      })
    })

    let imported = 0
    const numberingErrors: { reason: string }[] = []

    if (validRows.length > 0) {
      const { data: insertedRows, error: insErr } = await supabaseAdmin
        .from('members')
        .insert(validRows)
        .select('id')
      if (insErr) throw insErr
      imported = insertedRows?.length ?? 0

      // Assign membership numbers sequentially (atomic DB lock per row)
      for (const row of (insertedRows ?? [])) {
        try {
          await supabaseAdmin.rpc('assign_membership_number', {
            p_member_id: row.id,
            p_assembly_id: assemblyId,
          })
        } catch (numErr) {
          const msg = numErr instanceof Error ? numErr.message : String(numErr)
          numberingErrors.push({ reason: `Failed to assign number for member ${row.id}: ${msg}` })
        }
      }
    }

    return new Response(JSON.stringify({
      imported,
      skipped: errors.length,
      errors,
      numberingErrors,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bulk import failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
