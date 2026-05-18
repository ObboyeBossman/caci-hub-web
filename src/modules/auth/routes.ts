// src/modules/auth/routes.ts

import type { RouteDefinition } from '../../types/module.types'

export const routes: RouteDefinition[] = [
  {
    path: '/login',
    page: () => import('./pages/Login'),
    presentation: 'fullscreen',
  },
  {
    path: '/forgot-password',
    page: () => import('./pages/ForgotPassword'),
    presentation: 'fullscreen',
  },
  {
    path: '/reset-password',
    page: () => import('./pages/ResetPassword'),
    presentation: 'fullscreen',
  },
  {
    path: '/totp-enroll',
    page: () => import('./pages/Totp'),
    presentation: 'fullscreen',
  },
  {
    path: '/totp-verify',
    page: () => import('./pages/Totp'),
    presentation: 'fullscreen',
  }
]
