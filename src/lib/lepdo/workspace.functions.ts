import { createServerFn } from "@tanstack/react-start";

const WORKSPACE_ID = "lepdo-main";

/** Reads the shared LEPDO workspace snapshot as a JSON string. */
export const loadWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("workspace")
    .select("data")
    .eq("id", WORKSPACE_ID)
    .maybeSingle();
  if (error) throw error;
  const row = data?.data ?? null;
  return { json: row ? JSON.stringify(row) : null };
});

/** Writes the shared LEPDO workspace snapshot from a JSON string. */
export const saveWorkspace = createServerFn({ method: "POST" })
  .inputValidator((input: { json: string }) => {
    if (!input || typeof input.json !== "string") throw new Error("Invalid workspace payload");
    return input;
  })
  .handler(async ({ data: payload }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("workspace").upsert({
      id: WORKSPACE_ID,
      data: JSON.parse(payload.json) as never,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return { ok: true };
  });
