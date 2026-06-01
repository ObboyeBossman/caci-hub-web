// src/modules/services/pages/EditService.ts
import type { PageModule } from '../../../types/module.types'
import { renderEmpty } from '@shared/utils/pageHelpers'

const EditService: PageModule = {
  render: async (container: HTMLElement) => {
    container.innerHTML = '<div style="padding: 24px;"></div>'
    renderEmpty(container.firstElementChild as HTMLElement, {
      title: 'Edit Service (Coming Soon)',
      message: 'The services module is currently under development.',
      icon: 'pencil',
    })
  },
  destroy: () => {}
}
export default EditService
