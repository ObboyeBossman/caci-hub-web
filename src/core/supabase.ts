// core/supabase.ts
// Typed Supabase client singleton.

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

console.log('[supabase] Initializing with URL:', url ? 'Defined' : 'MISSING');

if (!url || url.trim() === '') {
  console.error('[supabase] VITE_SUPABASE_URL is missing!');
  // Instead of throwing immediately, which kills module evaluation, we can log and continue
  // But createClient will fail if these are missing anyway.
}

if (!key || key.trim() === '') {
  console.error('[supabase] VITE_SUPABASE_ANON_KEY is missing!');
}

// We still have to export something. If url/key are missing, createClient will throw.
// Let's wrap it to avoid killing the whole app if we just want to show an error UI.

let supabaseInstance: any;

try {
  if (!url || !key) {
    throw new Error('Supabase credentials missing. Check your .env file.')
  }
  supabaseInstance = createClient<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
} catch (err) {
  console.error('[supabase] Client creation failed:', err)
  // We'll export a proxy or something that throws when used,
  // or just let the error propagate if we're okay with it.
  // For now, let's let it throw but at least we have the log.
  throw err;
}

export const supabase = supabaseInstance;

// Expose to window for debugging in console
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}
