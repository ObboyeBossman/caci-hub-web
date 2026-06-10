import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ message: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json()
  const { mime_type, is_public_broadcast, storage_path, storage_bucket } = body

  // Server-side permission check
  if (mime_type?.startsWith('audio/') || is_public_broadcast) {
    const { data: hasPerm } = await supabase.rpc('auth_has_permission', {
      perm_key: 'communications.audio.broadcast'
    })

    if (!hasPerm) {
      // Delete the already-uploaded file
      await supabase.storage
        .from(storage_bucket)
        .remove([storage_path])

      return NextResponse.json(
        { message: 'Only pastors can upload audio broadcasts' },
        { status: 403 }
      )
    }
  }

  // Validate required fields
  const required = ['assembly_id', 'storage_bucket', 'storage_path', 'mime_type', 'file_size_bytes']
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ message: `Missing field: ${field}` }, { status: 400 })
    }
  }

  // Confirm object actually exists in storage
  const { data: storageList } = await supabase.storage
    .from(storage_bucket)
    .list(storage_path.split('/').slice(0, -1).join('/'), {
      search: storage_path.split('/').at(-1)
    })

  if (!storageList?.length) {
    return NextResponse.json(
      { message: 'Storage object not found — upload may have failed' },
      { status: 422 }
    )
  }

  // Set archive_after and purge_after
  const archiveAfter = new Date()
  archiveAfter.setDate(archiveAfter.getDate() + 60)

  const purgeAfter = new Date()
  purgeAfter.setFullYear(purgeAfter.getFullYear() + 3)

  // Insert attachment record
  const { data: attachment, error } = await supabase
    .from('communication_attachments')
    .insert({
      assembly_id: body.assembly_id,
      campaign_id: body.campaign_id,
      thread_message_id: body.thread_message_id,
      storage_tier: 'hot',
      storage_provider: 'supabase',
      storage_bucket: body.storage_bucket,
      storage_path: body.storage_path,
      mime_type: body.mime_type,
      file_size_bytes: body.file_size_bytes,
      checksum: body.checksum,
      duration_seconds: body.duration_seconds,
      waveform_data: body.waveform_data,
      is_sensitive: body.is_sensitive ?? false,
      virus_scan_status: 'skipped',
      transcription_status: 'skipped',
      uploaded_by: session.user.id,
      archive_after: archiveAfter.toISOString(),
      purge_after: purgeAfter.toISOString()
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  // Update assembly storage usage
  await supabase.rpc('increment_storage_usage', {
    p_assembly_id: body.assembly_id,
    p_bytes: body.file_size_bytes
  })

  return NextResponse.json({ attachmentId: attachment.id }, { status: 201 })
}
