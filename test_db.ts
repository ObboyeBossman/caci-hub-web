import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)
async function test() {
  const { data, count, error } = await supabase.from('members_view').select('*', { count: 'exact' }).limit(500)
  console.log('Error:', error)
  console.log('Returned rows:', data?.length)
  console.log('Count header:', count)
}
test()
