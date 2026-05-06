"use server";

import { revalidatePath } from "next/cache";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
} from "@/lib/validators/employees";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission, PermissionError } from "@/lib/rbac/permissions";
import { routes } from "@/lib/constants/routes";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function audit(
  action: string,
  recordId: string,
  message: string,
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();
  const orgId = (profile as { org_id: string | null } | null)?.org_id;
  if (!orgId) return;
  await supabase.from("audit_log").insert({
    org_id: orgId,
    user_id: user.id,
    action,
    table_name: "employees",
    record_id: recordId,
    after: { message, meta: "via WebApp" },
  });
}

export async function createEmployeeAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("employee.create");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof PermissionError ? err.message : "Forbidden",
    };
  }
  const parsed = createEmployeeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const input = parsed.data;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const orgId = (profile as { org_id: string | null } | null)?.org_id;
  if (!orgId) return { ok: false, error: "Profile not attached to org" };

  const { data, error } = await supabase
    .from("employees")
    .insert({
      org_id: orgId,
      full_name: input.full_name,
      email: input.email || null,
      phone: input.phone || null,
      hire_date: input.hire_date || null,
      weekly_hours: input.weekly_hours,
      hourly_rate_eur:
        typeof input.hourly_rate_eur === "number" ? input.hourly_rate_eur : null,
      status: input.status,
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const newId = (data as { id: string }).id;
  await audit("create", newId, `Mitarbeiter <strong>${input.full_name}</strong> hinzugefügt.`);
  revalidatePath(routes.employees);
  revalidatePath(routes.dashboard);
  return { ok: true, data: { id: newId } };
}

export async function updateEmployeeAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("employee.update");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof PermissionError ? err.message : "Forbidden",
    };
  }
  const parsed = updateEmployeeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const input = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("employees")
    .update({
      full_name: input.full_name,
      email: input.email || null,
      phone: input.phone || null,
      hire_date: input.hire_date || null,
      weekly_hours: input.weekly_hours,
      hourly_rate_eur:
        typeof input.hourly_rate_eur === "number" ? input.hourly_rate_eur : null,
      status: input.status,
      notes: input.notes || null,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  await audit("update", input.id, `Mitarbeiter <strong>${input.full_name}</strong> aktualisiert.`);
  revalidatePath(routes.employee(input.id));
  revalidatePath(routes.employees);
  return { ok: true, data: { id: input.id } };
}

export async function archiveEmployeeAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("employee.archive");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof PermissionError ? err.message : "Forbidden",
    };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("employees")
    .update({ deleted_at: new Date().toISOString(), status: "inactive" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  await audit("archive", id, "Mitarbeiter archiviert.");
  revalidatePath(routes.employees);
  return { ok: true, data: { id } };
}
