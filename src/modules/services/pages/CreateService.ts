// src/modules/services/pages/CreateService.ts
import type { PageModule } from '../../../types/module.types'
import { renderEmpty } from '@shared/utils/pageHelpers'

const CreateService: PageModule = {
  render: async (container: HTMLElement) => {
    container.innerHTML = '<div style="padding: 24px;"></div>'
    renderEmpty(container.firstElementChild as HTMLElement, {
      title: 'Create Service (Coming Soon)',
      message: 'The services module is currently under development.',
      icon: 'calendar-plus',
    })
  },
  destroy: () => {}
}
export default CreateService
