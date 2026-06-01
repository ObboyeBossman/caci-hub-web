// src/modules/services/manifest.ts
// Declares all platform-defined permissions for the Services module.
// Registered with permissionRegistry at module init.

import { register } from '../../core/authorization/permission-registry'
import { PERMISSIONS } from '../../core/authorization/permissions'

export function registerServicesPermissions(): void {
  register({
    moduleName: 'services',
    permissions: [
      {
        key:          PERMISSIONS.SERVICES_VIEW,
        label:        'View Services',
        description:  'Allows viewing service records and schedules',
        category:     'Services',
        isAssignable: true,
      },
      {
        key:          PERMISSIONS.SERVICES_CREATE,
        label:        'Create Services',
        description:  'Allows creating new service records',
        category:     'Services',
        isAssignable: true,
      },
      {
        key:          PERMISSIONS.SERVICES_EDIT,
        label:        'Edit Services',
        description:  'Allows editing existing service records (triggers audit log)',
        category:     'Services',
        isAssignable: true,
      },
      {
        key:          PERMISSIONS.SERVICES_DELETE,
        label:        'Delete Services',
        description:  'Allows soft-deleting service records',
        category:     'Services',
        isAssignable: true,
      },
      {
        key:          PERMISSIONS.SERVICES_TEMPLATES_MANAGE,
        label:        'Manage Service Templates',
        description:  'Allows creating and editing recurring service templates',
        category:     'Services',
        isAssignable: true,
      },
      {
        key:          PERMISSIONS.SERVICES_ATTENDANCE_MARK,
        label:        'Mark Attendance',
        description:  'Allows marking and updating service attendance records',
        category:     'Services',
        isAssignable: true,
      },
    ],
  })
}
