// src/modules/settings/index.ts
// Settings module manifest.

import type { ModuleManifest } from '../../types/module.types';

const SettingsModule: ModuleManifest = {
  name: 'settings',
  version: '1.0.0',
  description: 'User settings and preferences',
  icon: 'gear-fill',
  enabled: true,

  // Settings is opened programmatically via the profile popup,
  // so it doesn't need its own sidebar item or routes for now.
  routes: [],
  sidebar: [],

  async init() {
    console.info('[settings] Module initialized');
  }
};

export default SettingsModule;
