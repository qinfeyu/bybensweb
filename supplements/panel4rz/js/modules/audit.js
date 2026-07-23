// ByBen's Audit Logger Module

export async function logAdminAuditAction(sb, action, targetId = "", details = {}) {
  try {
    const adminEmail = localStorage.getItem("bb_admin_name") || "admin@bybens.com";
    await sb.from("audit_logs").insert({
      user_email: adminEmail,
      action: action,
      target_id: String(targetId),
      details: details,
      created_at: new Date().toISOString()
    });
    console.log(`[Audit Log] ${action} on ${targetId}`);
  } catch (e) {
    console.warn("Audit log notice:", e);
  }
}
