"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { routes } from "@/lib/constants/routes";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const reactSchema = z.object({
  message_id: z.string().uuid(),
  emoji: z.string().min(1).max(8),
});

/**
 * Toggle a reaction on a message: if the (user, message, emoji) row exists
 * already we delete it (un-react), otherwise we insert it (react).
 *
 * RLS already restricts inserts/deletes to `user_id = auth.uid()`, so the
 * action just routes the call.
 */
export async function toggleChatReactionAction(
  raw: unknown,
): Promise<ActionResult<{ reacted: boolean }>> {
  const parsed = reactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Validation failed" };
  const input = parsed.data;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: existing } = await supabase
    .from("chat_message_reactions")
    .select("user_id")
    .eq("message_id", input.message_id)
    .eq("user_id", user.id)
    .eq("emoji", input.emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("chat_message_reactions")
      .delete()
      .eq("message_id", input.message_id)
      .eq("user_id", user.id)
      .eq("emoji", input.emoji);
    if (error) return { ok: false, error: error.message };
    revalidatePath(routes.chat);
    return { ok: true, data: { reacted: false } };
  }

  const { error } = await supabase.from("chat_message_reactions").insert({
    message_id: input.message_id,
    user_id: user.id,
    emoji: input.emoji,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(routes.chat);
  return { ok: true, data: { reacted: true } };
}
