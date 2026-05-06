"use server";

import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Mint (or reuse) an opaque iCal subscription token for the current user.
 * One token per user; calling this again returns the existing one.
 */
export async function ensureCalendarTokenAction(): Promise<
  ActionResult<{ token: string }>
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();
  const orgId = (profile as { org_id: string | null } | null)?.org_id;
  if (!orgId) return { ok: false, error: "Profile not attached to org" };

  const { data: existing } = await supabase
    .from("calendar_tokens")
    .select("token")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return { ok: true, data: { token: (existing as { token: string }).token } };
  }

  const token = `ct_${randomUUID().replace(/-/g, "")}`;
  const { error } = await supabase.from("calendar_tokens").insert({
    token,
    profile_id: user.id,
    org_id: orgId,
    label: "Schedule subscription",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { token } };
}

export async function revokeCalendarTokenAction(): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase
    .from("calendar_tokens")
    .delete()
    .eq("profile_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
