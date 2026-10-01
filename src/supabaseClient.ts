import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://placeholder.supabase.co'
const supabaseKey = 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseKey)
