const SUPABASE_URL = "https://uogwlzuiemxwsnpigydg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ3dsenVpZW14d3NucGlneWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTA3MDMsImV4cCI6MjA5ODgyNjcwM30.3IrYmHPKPUwki-hmkysLw3EAEcr_h8wLHZmRphDiOpI";

const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

function sf(path) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SB_HEADERS }).then((r) => r.json());
}

async function run() {
    try {
        const p = await sf("products?select=id,name,brand,category_ids,sub_category_ids,description,image_url,variants,flavors,stock,discount,allow_promo,promo_code_ids,status,created_at,hidden,bundle_items&hidden=not.is.true&order=created_at.asc");
        console.log("Products: ", p);
    } catch(e) {
        console.error(e);
    }
}
run();
