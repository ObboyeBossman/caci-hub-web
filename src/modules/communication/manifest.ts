import { register } from '../../core/authorization/permission-registry'

export const CommunicationModule = {
  name: 'communication',
  permissions: [
    {
      key:          'communications.broadcast.send',
      label:        'Send Broadcasts',
      description:  'Allows sending broadcast messages to assemblies or groups',
      category:     'Broadcasting',
      isAssignable: true,
    },
    {
      key:          'communications.broadcast.schedule',
      label:        'Schedule Broadcasts',
      description:  'Allows scheduling broadcast messages for future delivery',
      category:     'Broadcasting',
      isAssignable: true,
    },
    {
      key:          'communications.direct.send',
      label:        'Send Direct Messages',
      description:  'Allows sending direct messages to members',
      category:     'Messaging',
      isAssignable: true,
    },
    {
      key:          'communications.direct.send_pastoral',
      label:        'Send Pastoral Messages',
      description:  'Allows sending pastoral care messages via direct messaging',
      category:     'Messaging',
      isAssignable: true,
    },
    {
      key:          'communications.direct.moderate',
      label:        'Moderate Messages',
      description:  'Allows moderating and flagging message threads',
      category:     'Messaging',
      isAssignable: true,
    },
    {
      key:          'communications.audio.broadcast',
      label:        'Audio Broadcast',
      description:  'Allows recording and broadcasting audio messages',
      category:     'Audio',
      isAssignable: true,
    },
    {
      key:          'communications.announcements.manage',
      label:        'Manage Announcements',
      description:  'Allows creating and managing assembly announcements',
      category:     'Announcements',
      isAssignable: true,
    },
    {
      key:          'communications.templates.manage',
      label:        'Manage Templates',
      description:  'Allows creating and managing message templates',
      category:     'Templates',
      isAssignable: true,
    },
    {
      key:          'communications.attachments.view_pastoral',
      label:        'View Pastoral Attachments',
      description:  'Allows viewing sensitive pastoral attachments',
      category:     'Attachments',
      isAssignable: true,
    },
    {
      key:          'communications.attachments.manage',
      label:        'Manage Attachments',
      description:  'Allows managing message attachments',
      category:     'Attachments',
      isAssignable: true,
    },
    {
      key:          'communications.reports.view',
      label:        'View Communication Reports',
      description:  'Allows viewing communication analytics and reports',
      category:     'Reports',
      isAssignable: true,
    },
  ],
}

export function registerCommunicationPermissions(): void {
  register({ moduleName: CommunicationModule.name, permissions: CommunicationModule.permissions })
}
