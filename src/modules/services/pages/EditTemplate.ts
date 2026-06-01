// src/modules/services/pages/EditTemplate.ts
import type { PageModule } from '../../../types/module.types'
import { renderEmpty } from '@shared/utils/pageHelpers'

const EditTemplate: PageModule = {
  render: async (container: HTMLElement) => {
    container.innerHTML = '<div style="padding: 24px;"></div>'
    renderEmpty(container.firstElementChild as HTMLElement, {
      title: 'Edit Template (Coming Soon)',
      message: 'The services templates functionality is currently under development.',
      icon: 'journal-text',
    })
  },
  destroy: () => {}
}
export default EditTemplate
