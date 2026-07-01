const { createClient } = require('@supabase/supabase-js')
const supabaseUrl = 'https://cyjkjzcthbpkufbsyosz.supabase.co'
const supabaseKey = 'sb_publishable_Ba8Zjw6KnLYttRgR14I_ww_t8ACDpsW'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'obboyebossman@gmail.com',
    password: 'Boss1520..'
  })
  if (authError) {
    console.error('Auth error:', authError)
    return
  }
  console.log('Logged in as uid:', auth.user.id)
  
  const { data: memberId, error: rpcError } = await supabase.rpc('auth_member_id')
  if (rpcError) {
    console.error('RPC error:', rpcError)
  } else {
    console.log('auth_member_id returned:', memberId)
  }
  
  const { data: members, error: memErr } = await supabase.from('members').select('id, auth_user_id, is_active')
  if (memErr) console.error('Member query err:', memErr)
  console.log('Members table result:', members)
}
test()
