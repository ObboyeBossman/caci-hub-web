// src/modules/services/pages/TemplateList.ts
import type { PageModule } from '../../../types/module.types'
import { renderEmpty } from '@shared/utils/pageHelpers'

const TemplateList: PageModule = {
  render: async (container: HTMLElement) => {
    container.innerHTML = '<div style="padding: 24px;"></div>'
    renderEmpty(container.firstElementChild as HTMLElement, {
      title: 'Service Templates (Coming Soon)',
      message: 'The services templates functionality is currently under development.',
      icon: 'journal-album',
    })
  },
  destroy: () => {}
}
export default TemplateList
