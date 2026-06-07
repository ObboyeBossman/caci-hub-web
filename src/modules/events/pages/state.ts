// src/modules/events_&_services/pages/state.ts

import type { ServicesPageState } from '../types'

export const state: ServicesPageState = {
  services: [], filtered: [],
  search: '', statusFilter: 'all', typeFilter: 'all', groupFilter: 'all',
  statFilter: null, view: 'list',
  calYear: new Date().getFullYear(), calMonth: new Date().getMonth(),
  openServiceId: null,
  attServices: [], attServiceId: null, attRecords: [], attFiltered: [],
  attSearch: '', attStatusFilter: 'all', attChanged: new Set(), attCurrentStatus: new Map(),
  templates: [], tmplFiltered: [], tmplSearch: '',
  reportRange: '30d',
  loading: false, saving: false,
}

export const shared = {
  container: null as HTMLElement | null,
  destroyed: false,
  activeTab: 'schedule',
  tabContent: null as HTMLElement | null,
  ctxTarget: null as string | null,
}
