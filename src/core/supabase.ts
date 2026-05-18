// core/supabase.ts
// Typed Supabase client singleton.
// Mirrors: supabase_client.dart (Flutter) — same project URL + anon key.
// Both the Flutter app and this web app point at the same Supabase project:
//   Project ID: cyjkjzcthbpkufbsyosz

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

export const supabase = createClient<Database>(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
