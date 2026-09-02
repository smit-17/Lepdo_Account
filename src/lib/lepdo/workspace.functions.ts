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

type SaveResult =
  | { ok: true; updatedAt: string }
  | { ok: false; conflict: true; json: string | null; updatedAt: string | null };

/**
 * Writes the shared LEPDO workspace snapshot with optimistic concurrency.
 * `version` is the `updated_at` the client last read; the write only lands when
 * the row still carries that version, so a stale snapshot can never silently
 * replace newer data. On conflict the current row is returned for merging.
 */
export const saveWorkspace = createServerFn({ method: "POST" })
  .inputValidator((input: { json: string; version?: string | null }) => {
    if (!input || typeof input.json !== "string") throw new Error("Invalid workspace payload");
    return { json: input.json, version: input.version ?? null };
  })
  .handler(async ({ data: payload }): Promise<SaveResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const updatedAt = new Date().toISOString();
    const body = JSON.parse(payload.json) as never;

    const conflict = async (): Promise<SaveResult> => {
      const { data } = await supabaseAdmin
        .from("workspace")
        .select("data, updated_at")
        .eq("id", WORKSPACE_ID)
        .maybeSingle();
      return {
        ok: false,
        conflict: true,
        json: data?.data ? JSON.stringify(data.data) : null,
        updatedAt: data?.updated_at ?? null,
      };
    };

    if (payload.version) {
      // Conditional update: only when the row is still at the version we read.
      const { data, error } = await supabaseAdmin
        .from("workspace")
        .update({ data: body, updated_at: updatedAt })
        .eq("id", WORKSPACE_ID)
        .eq("updated_at", payload.version)
        .select("updated_at");
      if (error) throw error;
      if (!data || data.length === 0) return conflict();
      return { ok: true, updatedAt };
    }

    // No version yet: this client believes the row does not exist.
    const { error } = await supabaseAdmin
      .from("workspace")
      .insert({ id: WORKSPACE_ID, data: body, updated_at: updatedAt });
    if (error) {
      if (error.code === "23505") return conflict();
      throw error;
    }
    return { ok: true, updatedAt };
  });
