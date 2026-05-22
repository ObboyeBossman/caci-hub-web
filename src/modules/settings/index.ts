// src/modules/settings/index.ts
import type { ModuleManifest } from '../../types/module.types';

const SettingsModule: ModuleManifest = {
  name: 'settings',
  version: '1.0.0',
  description: 'User settings and preferences',
  icon: 'gear-fill',
  enabled: true,
  routes: [],
  sidebar: [],

  async init() {
    console.info('[settings] Module initialized');
  }
};

export default SettingsModule;