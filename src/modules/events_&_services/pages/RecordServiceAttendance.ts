// src/modules/services/pages/RecordServiceAttendance.ts
import type { PageModule } from '../../../types/module.types'
import { renderEmpty } from '@shared/utils/pageHelpers'

const RecordServiceAttendance: PageModule = {
  render: async (container: HTMLElement) => {
    container.innerHTML = '<div style="padding: 24px;"></div>'
    renderEmpty(container.firstElementChild as HTMLElement, {
      title: 'Record Attendance (Coming Soon)',
      message: 'The services module is currently under development.',
      icon: 'check2-square',
    })
  },
  destroy: () => {}
}
export default RecordServiceAttendance
