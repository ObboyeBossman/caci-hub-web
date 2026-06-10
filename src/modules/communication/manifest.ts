import type { Module } from '@/types/modules'

export const communicationManifest: Module = {
  id: 'communication',
  name: 'Communications',
  description: 'Multi-channel messaging, announcements, and audio broadcasts',
  icon: 'MessageSquare',
  version: '1.0.0',
  permissions: [
    'communications.broadcast.send',
    'communications.broadcast.schedule',
    'communications.direct.send',
    'communications.direct.send_pastoral',
    'communications.direct.moderate',
    'communications.audio.broadcast',
    'communications.announcements.manage',
    'communications.templates.manage',
    'communications.attachments.view_pastoral',
    'communications.attachments.manage',
    'communications.reports.view'
  ],
  features: {
    broadcasting: {
      enabled: true,
      description: 'Send broadcasts to assemblies or groups'
    },
    directMessaging: {
      enabled: true,
      description: 'Send direct messages and pastoral threads'
    },
    audioBroadcast: {
      enabled: true,
      description: 'Record and broadcast audio messages (pastor-only)',
      requiresPermission: 'communications.audio.broadcast'
    },
    announcements: {
      enabled: true,
      description: 'Create and manage assembly announcements'
    },
    templates: {
      enabled: true,
      description: 'Create reusable message templates'
    }
  },
  storage: {
    buckets: [
      {
        name: 'messages-media-public',
        description: 'Public media for announcements and broadcasts'
      },
      {
        name: 'messages-media-private',
        description: 'Private media including pastoral audio'
      }
    ]
  },
  edgeFunctions: [
    'comm-fanout',
    'comm-dispatch',
    'comm-webhook',
    'comm-archive',
    'comm-triggers',
    'storage-signed-url',
    'storage-cleanup'
  ]
}
