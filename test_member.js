global.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://cyjkjzcthbpkufbsyosz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5amtqemN0aGJwa3VmYnN5b3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxODE4MjQsImV4cCI6MjA5Mjc1NzgyNH0.MJnEU1UF0V6RLhBjyjrnO6NkaJ32L2XtWJUY_WRvQvc');

async function testMemberRegistration() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    phone: '+233509107165',
    password: '02J2004abW.'
  });

  if (authError || !authData.user) {
    console.error('Login failed', authError);
    return;
  }

  // Get user profile to get assembly ID
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('assembly_id')
    .eq('id', authData.user.id)
    .single();

  const assemblyId = profile?.assembly_id;
  if (!assemblyId) {
    console.error('No assembly ID found');
    return;
  }
  
  console.log('Got assembly_id:', assemblyId);

  // Try creating a member with a valid payload
  const payload = {
    assembly_id: assemblyId,
    first_name: 'Test',
    last_name: 'User',
    gender: 'male',
    membership_status: 'visitor',
  };

  console.log('Sending insert...', payload);
  const { data, error: insertError } = await supabase
    .from('members')
    .insert(payload)
    .select('id')
    .single();

  if (insertError) {
    console.error('Insert Failed:', insertError);
  } else {
    console.log('Insert Success:', data);
  }
}

testMemberRegistration();
