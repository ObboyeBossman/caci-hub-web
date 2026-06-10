import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useCanBroadcastAudio() {
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function check() {
      const { data } = await supabase.rpc('auth_has_permission', {
        perm_key: 'communications.audio.broadcast'
      })
      setAllowed(!!data)
      setLoading(false)
    }
    check()
  }, [])

  return { allowed, loading }
}
