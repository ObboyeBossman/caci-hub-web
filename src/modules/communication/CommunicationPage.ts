// src/modules/communication/CommunicationPage.ts
// Single routed PageModule. The ONLY file the router ever touches.
// Instantiates the shared WorkspaceShell with Communication-specific config.

import type { PageModule }      from '../../types/module.types'
import { getCurrentUser }        from '@core/auth'
import { can }                   from '@core/authorization/authorization-service'
import { renderError }           from '@shared/utils/pageHelpers'
import { WorkspaceShell }        from '@shell/WorkspaceShell'
import type { ShellConfig }      from '@shell/WorkspaceShell'
import { injectWidgetCSS }       from './widgets/communicationWidgets'
import { HubTab }                from './tabs/HubTab'
import { CampaignsTab }          from './tabs/CampaignsTab'
import { MessagesTab }           from './tabs/MessagesTab'
import { AnnouncementsTab }      from './tabs/AnnouncementsTab'
import { TemplatesTab }          from './tabs/TemplatesTab'
import { AudioBroadcastTab }     from './tabs/AudioBroadcastTab'

const COMM_CONFIG: ShellConfig = {
  sessionKey: 'comm_active_tab',
  icon:       'megaphone-fill',
  title:      'Communications Hub',
  subtitle:   'Manage broadcasts, announcements, and direct messaging',
  badgeLabel: 'Live',
  badgeIcon:  'broadcast',
  badgeColor: '#22c55e',
  buildUrl:   (tabId) => `#/communications/${tabId}`,
}

let _shell: WorkspaceShell | null = null

const CommunicationPage: PageModule = {

  async render(container: HTMLElement): Promise<void> {
    const user = getCurrentUser()
    if (!user) { renderError(container, new Error('Not authenticated'), {}); return }

    const hasPerm =
      can(user, 'communications.broadcast.send'       as any) ||
      can(user, 'communications.direct.send'          as any) ||
      can(user, 'communications.announcements.manage' as any) ||
      can(user, 'communications.reports.view'         as any)

    if (!hasPerm) {
      renderError(container, new Error('You do not have access to Communications.'), {})
      return
    }

    injectWidgetCSS()

    const initialTabId = container.dataset['tab']

    _shell = new WorkspaceShell(container, [
      new HubTab(),
      new CampaignsTab(),
      new MessagesTab(),
      new AnnouncementsTab(),
      new TemplatesTab(),
      new AudioBroadcastTab(),
    ], COMM_CONFIG, initialTabId)
  },

  destroy(): void {
    _shell?.destroy()
    _shell = null
  },
}

export default CommunicationPage