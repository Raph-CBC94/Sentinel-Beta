import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBotConfig } from "./config";

export type SanctionType = "warning" | "timeout";
export type SanctionStatus = "pending" | "applied" | "failed" | "removed";

export type Sanction = {
  id: string;
  guild_id: string;
  member_id: string;
  member_tag: string;
  type: SanctionType;
  reason: string;
  moderator_id: string;
  moderator_tag: string;
  created_at: string;
  duration_seconds: number | null;
  expires_at: string | null;
  status: SanctionStatus;
  dm_sent: boolean | null;
  dm_error: string | null;
  removed_at: string | null;
  removed_by: string | null;
};

type NewSanction = Omit<
  Sanction,
  "id" | "created_at" | "dm_sent" | "dm_error" | "removed_at" | "removed_by"
>;

let client: SupabaseClient | undefined;

function getDatabase(): SupabaseClient {
  if (!client) {
    const config = getBotConfig();
    client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return client;
}

function throwIfError(error: { message: string } | null): void {
  if (error) {
    throw new Error(`Supabase request failed: ${error.message}`);
  }
}

export async function createSanction(input: NewSanction): Promise<Sanction> {
  const { data, error } = await getDatabase()
    .from("sanctions")
    .insert(input)
    .select("*")
    .single<Sanction>();

  throwIfError(error);
  if (!data) {
    throw new Error("Supabase did not return the created sanction.");
  }

  return data;
}

export async function updateSanction(
  id: string,
  patch: Partial<Pick<Sanction, "status" | "dm_sent" | "dm_error">>,
): Promise<void> {
  const { error } = await getDatabase().from("sanctions").update(patch).eq("id", id);
  throwIfError(error);
}

export async function removeWarning(id: string, _moderatorId: string): Promise<Sanction> {
  const { data, error } = await getDatabase()
    .from("sanctions")
    .delete()
    .eq("id", id)
    .eq("type", "warning")
    .eq("status", "applied")
    .select("*")
    .single<Sanction>();

  throwIfError(error);
  if (!data) {
    throw new Error("Warning not found or already removed.");
  }

  return data;
}

export async function removeActiveTimeouts(
  guildId: string,
  memberId: string,
): Promise<Sanction[]> {
  const { data, error } = await getDatabase()
    .from("sanctions")
    .delete()
    .eq("guild_id", guildId)
    .eq("member_id", memberId)
    .eq("type", "timeout")
    .eq("status", "applied")
    .gt("expires_at", new Date().toISOString())
    .select("*")
    .returns<Sanction[]>();

  throwIfError(error);
  return data ?? [];
}

export async function findWarningByReference(
  guildId: string,
  memberId: string,
  reference: string,
): Promise<Sanction | null> {
  const normalizedReference = reference.trim().replace(/^#/, "").toLowerCase();
  const { data, error } = await getDatabase()
    .from("sanctions")
    .select("*")
    .eq("guild_id", guildId)
    .eq("member_id", memberId)
    .eq("type", "warning")
    .ilike("id", `${normalizedReference}%`)
    .limit(2)
    .returns<Sanction[]>();

  throwIfError(error);
  if (!data || data.length === 0) {
    return null;
  }
  if (data.length > 1) {
    throw new Error("Reference is ambiguous. Use the full warning ID.");
  }

  return data[0] ?? null;
}

export async function getMemberHistory(
  guildId: string,
  memberId: string,
): Promise<Sanction[]> {
  const { data, error } = await getDatabase()
    .from("sanctions")
    .select("*")
    .eq("guild_id", guildId)
    .eq("member_id", memberId)
    .neq("status", "failed")
    .neq("status", "removed")
    .order("created_at", { ascending: false })
    .returns<Sanction[]>();

  throwIfError(error);
  return data ?? [];
}

export async function recordEvent(input: {
  guildId: string;
  memberId: string;
  moderatorId: string;
  action: "untimeout";
  reason: string;
}): Promise<void> {
  const { error } = await getDatabase().from("sanction_events").insert({
    guild_id: input.guildId,
    member_id: input.memberId,
    moderator_id: input.moderatorId,
    action: input.action,
    reason: input.reason,
  });

  throwIfError(error);
}