import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// The browser uses only the public key. PostgreSQL authorizes each profile operation.
export const supabase = url && key ? createClient<Database>(url, key, {
  auth: { detectSessionInUrl: false },
}) : null

