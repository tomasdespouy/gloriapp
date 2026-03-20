import { createAdminClient } from "@/lib/supabase/admin";

export async function logAdminAction(params: {
  adminId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  await supabase.from("admin_audit_log").insert({
    admin_id: params.adminId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId || null,
    details: params.details || {},
  });
}
