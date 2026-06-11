import type { PageModule }          from '../../types/module.types'
import { getCurrentUser }            from '@core/auth'
import { can }                       from '@core/authorization/authorization-service'
import { PERMISSIONS }               from '@core/authorization/permissions'
import { renderError }               from '@shared/utils/pageHelpers'
import { CommunicationWorkspaceShell } from './workspace/CommunicationWorkspaceShell'
import { HubTab }                    from './tabs/HubTab'
import { CampaignsTab }              from './tabs/CampaignsTab'

let _shell: CommunicationWorkspaceShell | null = null

const CommunicationPage: PageModule = {

  async render(container: HTMLElement): Promise<void> {
    const user = getCurrentUser()
    if (!user) { renderError(container, new Error('Not authenticated'), {}); return }

    if (!can(user, PERMISSIONS.COMMS_BROADCAST_SEND)) {
      renderError(container, new Error('Access denied'), {})
      return
    }

    _shell = new CommunicationWorkspaceShell(container, [
      new HubTab(),
      new CampaignsTab(),
    ])
  },

  destroy(): void {
    _shell?.destroy()
    _shell = null
  },
}

export default CommunicationPage
