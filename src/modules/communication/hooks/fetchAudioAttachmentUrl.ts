import { supabase } from '@core/supabase'

export async function fetchAudioAttachmentUrl(attachmentId: string): Promise<string> {
  const session = (await supabase.auth.getSession()).data.session
  if (!session) throw new Error('Not authenticated')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storage-signed-url`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        attachment_id: attachmentId,
        requester_id: session.user.id
      })
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.message ?? 'Failed to load audio')
  }

  const { url: signedUrl } = await res.json()
  return signedUrl
}
