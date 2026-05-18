// core/supabase.ts
// Typed Supabase client singleton.
// Mirrors: supabase_client.dart (Flutter) — same project URL + anon key.
// Both the Flutter app and this web app point at the same Supabase project:
//   Project ID: cyjkjzcthbpkufbsyosz
//
// RULES:
//   - NEVER call createClient() anywhere else in the codebase.
//   - NEVER import supabase-js directly in modules — always import from here.
//   - NEVER hardcode the URL or key — always read from import.meta.env.

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || url.trim() === '') {
  throw new Error(
    '[supabase] VITE_SUPABASE_URL is missing. ' +
    'Copy .env.example to .env and add your Supabase project URL.'
  )
}

if (!key || key.trim() === '') {
  throw new Error(
    '[supabase] VITE_SUPABASE_ANON_KEY is missing. ' +
    'Copy .env.example to .env and add your Supabase anon key.'
  )
}

// Passing Database to createClient types every .from() call.
// Querying a non-existent column or table name becomes a compile-time error.
// This is the same guarantee the Flutter app gets from generated Dart types.
export const supabase = createClient<Database>(url, key, {
  auth: {
    // Persist session across page reloads — matches Flutter default behaviour.
    // Supabase stores the JWT in localStorage under 'sb-<project>-auth-token'.
    persistSession: true,

    // Auto-refresh the JWT 60 seconds before expiry.
    // Prevents mid-session 401s without requiring a full re-login.
    autoRefreshToken: true,

    // Detect session from URL hash after magic link / password-reset redirects.
    // Required for ResetPassword.ts to pick up the token from the hash.
    detectSessionInUrl: true,
  },
})
