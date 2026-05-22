// src/modules/settings/pages/utils/settingsTypes.ts

export interface SettingsContext {
  el: HTMLElement;
  toast: (msg: string, type?: 'check' | 'error' | 'warn') => void;
}