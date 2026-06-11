import { supabase } from '@core/supabase'

export async function checkCanBroadcastAudio(): Promise<boolean> {
  // @ts-expect-error - Types might not include auth_has_permission yet
  const { data } = await supabase.rpc('auth_has_permission', {
    perm_key: 'communications.audio.broadcast'
  })
  return !!data
}
