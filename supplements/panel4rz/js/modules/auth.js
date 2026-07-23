// ByBen's Admin Auth & Session Module

export function checkAdminSession(sb) {
  const authSession = localStorage.getItem("bb_admin_auth");
  if (!authSession) {
    window.location.href = "/supplements/mgmt9kx";
    return false;
  }
  return true;
}

export async function doAdminLogout(sb) {
  try {
    await sb.auth.signOut();
  } catch(e){}
  localStorage.removeItem("bb_admin_auth");
  localStorage.removeItem("bb_admin_name");
  window.location.href = "/supplements/mgmt9kx";
}
