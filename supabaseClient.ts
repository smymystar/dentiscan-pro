import { createClient } from '@supabase/supabase-js'

// ใส่ URL และ Anon Key ของ Supabase ของคุณตรงนี้
const supabaseUrl = 'https://gdnnpvydimltpofkhwvc.supabase.co'
const supabaseKey = 'sb_publishable_zBCeeeue9PB9PbB07Ib7CQ_wBknFGcU'

export const supabase = createClient(supabaseUrl, supabaseKey)
