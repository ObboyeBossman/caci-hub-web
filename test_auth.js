const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://cyjkjzcthbpkufbsyosz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5amtqemN0aGJwa3VmYnN5b3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxODE4MjQsImV4cCI6MjA5Mjc1NzgyNH0.MJnEU1UF0V6RLhBjyjrnO6NkaJ32L2XtWJUY_WRvQvc');

async function testSignIn() {
  const res = await supabase.auth.signInWithPassword({
    phone: '+233509107165',
    password: '02J2004abW.'
  });
  console.log('Result:', res);
}
testSignIn();
