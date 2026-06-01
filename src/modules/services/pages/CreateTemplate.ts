// src/modules/services/pages/CreateTemplate.ts
import type { PageModule } from '../../../types/module.types'
import { renderEmpty } from '@shared/utils/pageHelpers'

const CreateTemplate: PageModule = {
  render: async (container: HTMLElement) => {
    container.innerHTML = '<div style="padding: 24px;"></div>'
    renderEmpty(container.firstElementChild as HTMLElement, {
      title: 'Create Template (Coming Soon)',
      message: 'The services templates functionality is currently under development.',
      icon: 'journal-plus',
    })
  },
  destroy: () => {}
}
export default CreateTemplate
