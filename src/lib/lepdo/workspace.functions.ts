import { createServerFn } from "@tanstack/react-start";

export const WORKSPACE_ID = "lepdo-main";

/** Reads the shared LEPDO workspace snapshot as a JSON string. */
export const loadWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("workspace")
    .select("data, updated_at")
    .eq("id", WORKSPACE_ID)
    .maybeSingle();
  if (error) throw error;
  const row = data?.data ?? null;
  return {
    json: row ? JSON.stringify(row) : null,
    updatedAt: data?.updated_at ?? null,
  };
});

/** Writes the shared LEPDO workspace snapshot from a JSON string. */
export const saveWorkspace = createServerFn({ method: "POST" })
  .inputValidator((input: { json: string }) => {
    if (!input || typeof input.json !== "string") throw new Error("Invalid workspace payload");
    return input;
  })
  .handler(async ({ data: payload }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const updatedAt = new Date().toISOString();
    const { error } = await supabaseAdmin.from("workspace").upsert({
      id: WORKSPACE_ID,
      data: JSON.parse(payload.json) as never,
      updated_at: updatedAt,
    });
    if (error) throw error;
    return { ok: true, updatedAt };
  });
