// src/modules/communication/CommunicationPage.ts
// Single routed PageModule. The ONLY file the router ever touches.
// Instantiates the workspace shell with all permission-filtered tabs.

import type { PageModule }               from '../../types/module.types'
import { getCurrentUser }                from '@core/auth'
import { can }                           from '@core/authorization/authorization-service'
import { renderError }                   from '@shared/utils/pageHelpers'
import { CommunicationWorkspaceShell }   from './workspace/CommunicationWorkspaceShell'
import { HubTab }                        from './tabs/HubTab'
import { CampaignsTab }                  from './tabs/CampaignsTab'
import { MessagesTab }                   from './tabs/MessagesTab'
import { AnnouncementsTab }              from './tabs/AnnouncementsTab'
import { TemplatesTab }                  from './tabs/TemplatesTab'
import { AudioBroadcastTab }             from './tabs/AudioBroadcastTab'

let _shell: CommunicationWorkspaceShell | null = null

const CommunicationPage: PageModule = {

  async render(container: HTMLElement): Promise<void> {
    const user = getCurrentUser()
    if (!user) { renderError(container, new Error('Not authenticated'), {}); return }

    const hasPerm =
      can(user, 'communications.broadcast.send'      as any) ||
      can(user, 'communications.direct.send'         as any) ||
      can(user, 'communications.announcements.manage' as any) ||
      can(user, 'communications.reports.view'        as any)

    if (!hasPerm) {
      renderError(container, new Error('You do not have access to Communications.'), {})
      return
    }

    const initialTabId = container.dataset['tab']

    _shell = new CommunicationWorkspaceShell(container, [
      new HubTab(),
      new CampaignsTab(),
      new MessagesTab(),
      new AnnouncementsTab(),
      new TemplatesTab(),
      new AudioBroadcastTab(),
    ], initialTabId)
  },

  destroy(): void {
    _shell?.destroy()
    _shell = null
  },
}

export default CommunicationPage