import { createClient } from '@supabase/supabase-js'

// ใส่ค่า URL และ Anon Key ของคุณลงไปตรงๆ เพื่อความชัวร์และไม่ให้หลุด
const supabaseUrl = 'https://gdnnpvydimltpofkhwvc.supabase.co'
const supabaseKey = 'sb_publishable_zBCeeeue9PB9PbB07Ib7CQ_wBknFGcU'

export const supabase = createClient(supabaseUrl, supabaseKey)
