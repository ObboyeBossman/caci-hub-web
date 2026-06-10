import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useAudioAttachment(attachmentId: string | null) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!attachmentId) return

    async function fetchSignedUrl() {
      setLoading(true)
      setError(null)

      try {
        const session = (await supabase.auth.getSession()).data.session
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storage-signed-url`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({
              attachment_id: attachmentId,
              requester_id: session?.user.id
            })
          }
        )

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.message ?? 'Failed to load audio')
        }

        const { url: signedUrl } = await res.json()
        setUrl(signedUrl)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchSignedUrl()
  }, [attachmentId])

  return { url, loading, error }
}
