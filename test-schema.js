const { createClient } = require('@supabase/supabase-js');
const supabase = createClient("https://uogwlzuiemxwsnpigydg.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ3dsenVpZW14d3NucGlneWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTA3MDMsImV4cCI6MjA5ODgyNjcwM30.3IrYmHPKPUwki-hmkysLw3EAEcr_h8wLHZmRphDiOpI");
async function run() {
  const { data } = await supabase.from('products').select('*').limit(1);
  console.log(JSON.stringify(data[0].variants, null, 2));
}
run();
