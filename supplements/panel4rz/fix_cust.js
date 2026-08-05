import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
const env = fs.readFileSync('/home/mohamed/Desktop/New Folder/bybensweb/supplements/panel4rz/.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
  const { error: e1 } = await supabase.from('customers').update({ wilaya: 'Alger' }).eq('id', '123');
  console.log('Update wilaya error:', e1?.message || 'Success/No error');
}
run();
