// src/modules/services/pages/ServiceDetail.ts
import type { PageModule } from '../../../types/module.types'
import { renderEmpty } from '@shared/utils/pageHelpers'

const ServiceDetail: PageModule = {
  render: async (container: HTMLElement) => {
    container.innerHTML = '<div style="padding: 24px;"></div>'
    renderEmpty(container.firstElementChild as HTMLElement, {
      title: 'Service Detail (Coming Soon)',
      message: 'The services module is currently under development.',
      icon: 'calendar',
    })
  },
  destroy: () => {}
}
export default ServiceDetail
