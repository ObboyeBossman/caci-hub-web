// src/modules/settings/index.ts
import type { ModuleManifest } from '../../types/module.types';

const SettingsModule: ModuleManifest = {
  name: 'settings',
  version: '1.0.0',
  description: 'User settings and preferences',
  icon: 'gear-fill',
  enabled: true,
  routes: [
    {
      path: '/change-password',
      page: () => import('./pages/ChangePassword'),
      middleware: ['auth'], // intentional no mustChangePassword
      presentation: 'fullscreen',
    }
  ],
  sidebar: [],

  async init() {
    console.info('[settings] Module initialized');
  }
};

export default SettingsModule;