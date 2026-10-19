import { createClient } from '@supabase/supabase-js'

// >>> Credentials come from the .env file in the project root. <<<
// Put your project URL and anon (public) key there — NOT in this file.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey || url.includes('YOUR-PROJECT-REF')) {
  throw new Error(
    'Missing Supabase credentials. Edit .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart `npm run dev`.'
  )
}

export const supabase = createClient(url, anonKey)
