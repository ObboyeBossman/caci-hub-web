import { getCurrentUser } from '@core/auth'
import { can } from '@core/authorization/authorization-service'

export async function checkCanBroadcastAudio(): Promise<boolean> {
  const user = getCurrentUser()
  if (!user) return false
  
  return can(user, 'communications.audio.broadcast' as any)
}
