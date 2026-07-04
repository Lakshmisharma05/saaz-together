import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const trackSchema = z.object({
  video_id: z.string().min(1).max(32),
  title: z.string().min(1).max(300),
  channel: z.string().max(300).nullable().optional(),
  thumbnail: z.string().max(600).nullable().optional(),
});

/** Create a new listening room owned by the caller and add them as participant. */
export const createRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { name?: string; mode?: "listen" | "jam"; display_name?: string }) => ({
      name: input?.name?.trim().slice(0, 80),
      mode: input?.mode === "jam" ? "jam" : "listen",
      display_name: input?.display_name?.trim().slice(0, 40) || undefined,
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const genCode = () => {
      let c = "";
      for (let i = 0; i < 8; i++) c += chars[Math.floor(Math.random() * chars.length)];
      return c;
    };
    let inviteCode = "";
    for (let i = 0; i < 5; i++) {
      inviteCode = genCode();
      const { data: existing } = await supabaseAdmin
        .from("rooms")
        .select("id")
        .eq("invite_code", inviteCode)
        .maybeSingle();
      if (!existing) break;
    }

    const { data: room, error } = await supabaseAdmin
      .from("rooms")
      .insert({
        host_id: context.userId,
        invite_code: inviteCode,
        name: data.name || (data.mode === "jam" ? "Jam Session" : "Listening Session"),
        mode: data.mode,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("room_participants")
      .insert({ room_id: room.id, user_id: context.userId, display_name: data.display_name ?? null });

    return { room };
  });

/** Join a room by invite code. Also records mutual friendship + adds system chat message. */
export const joinRoomByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; display_name?: string }) => ({
    code: input.code.trim().toUpperCase().slice(0, 12),
    display_name: input.display_name?.trim().slice(0, 40) || undefined,
  }))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room, error } = await supabaseAdmin
      .from("rooms")
      .select("*")
      .eq("invite_code", data.code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!room) throw new Error("Invite code not found");
    if (!room.is_active) throw new Error("This session has ended");

    const { data: existing } = await supabaseAdmin
      .from("room_participants")
      .select("id")
      .eq("room_id", room.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin
        .from("room_participants")
        .insert({
          room_id: room.id,
          user_id: context.userId,
          display_name: data.display_name ?? null,
        });

      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("id", context.userId)
        .maybeSingle();
      const shown = data.display_name || prof?.display_name || "A listener";
      await supabaseAdmin.from("chat_messages").insert({
        room_id: room.id,
        user_id: null,
        content: `${shown} joined the session`,
        kind: "system",
      });
    } else if (data.display_name) {
      await supabaseAdmin
        .from("room_participants")
        .update({ display_name: data.display_name })
        .eq("id", existing.id);
    }

    const { data: others } = await supabaseAdmin
      .from("room_participants")
      .select("user_id")
      .eq("room_id", room.id)
      .neq("user_id", context.userId);

    if (others && others.length > 0) {
      const rows: { owner_id: string; friend_id: string }[] = [];
      for (const o of others) {
        rows.push({ owner_id: context.userId, friend_id: o.user_id });
        rows.push({ owner_id: o.user_id, friend_id: context.userId });
      }
      await supabaseAdmin.from("friends").upsert(rows, {
        onConflict: "owner_id,friend_id",
        ignoreDuplicates: true,
      });
    }

    return { room };
  });

/** Update playback for a room (any participant can). */
export const updateRoomPlayback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      room_id: string;
      is_playing?: boolean;
      position_seconds?: number;
      track?: z.infer<typeof trackSchema> | null;
    }) => ({
      room_id: z.string().uuid().parse(input.room_id),
      is_playing: typeof input.is_playing === "boolean" ? input.is_playing : undefined,
      position_seconds:
        typeof input.position_seconds === "number" ? Math.max(0, input.position_seconds) : undefined,
      track: input.track ? trackSchema.parse(input.track) : input.track === null ? null : undefined,
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    type RoomPatch = {
      last_state_change: string;
      is_playing?: boolean;
      position_seconds?: number;
      current_video_id?: string | null;
      current_video_title?: string | null;
      current_video_channel?: string | null;
      current_video_thumbnail?: string | null;
    };
    const patch: RoomPatch = { last_state_change: new Date().toISOString() };
    if (data.is_playing !== undefined) patch.is_playing = data.is_playing;
    if (data.position_seconds !== undefined) patch.position_seconds = data.position_seconds;
    if (data.track) {
      patch.current_video_id = data.track.video_id;
      patch.current_video_title = data.track.title;
      patch.current_video_channel = data.track.channel ?? null;
      patch.current_video_thumbnail = data.track.thumbnail ?? null;
      patch.position_seconds = 0;
      patch.is_playing = true;
      await supabase.from("play_history").insert({
        user_id: context.userId,
        room_id: data.room_id,
        video_id: data.track.video_id,
        title: data.track.title,
        channel: data.track.channel ?? null,
        thumbnail: data.track.thumbnail ?? null,
      });
    }
    const { error } = await supabase.from("rooms").update(patch).eq("id", data.room_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** End a room (host only). */
export const endRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { room_id: string }) => ({
    room_id: z.string().uuid().parse(input.room_id),
  }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("rooms")
      .update({ is_active: false, is_playing: false, ended_at: new Date().toISOString() })
      .eq("id", data.room_id)
      .eq("host_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Add a track to a jam room's shared queue. */
export const addToQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { room_id: string; track: z.infer<typeof trackSchema> }) => ({
      room_id: z.string().uuid().parse(input.room_id),
      track: trackSchema.parse(input.track),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    // Append at the end
    const { data: last } = await supabase
      .from("room_queue")
      .select("position")
      .eq("room_id", data.room_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPos = (last?.position ?? -1) + 1;
    const { error } = await supabase.from("room_queue").insert({
      room_id: data.room_id,
      video_id: data.track.video_id,
      title: data.track.title,
      channel: data.track.channel ?? null,
      thumbnail: data.track.thumbnail ?? null,
      position: nextPos,
      added_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove a queue item (adder or host). */
export const removeFromQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: z.string().uuid().parse(input.id) }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("room_queue").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Pop the next queue item and set it as the current track for a jam room. */
export const playNextFromQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { room_id: string }) => ({
    room_id: z.string().uuid().parse(input.room_id),
  }))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: next } = await supabase
      .from("room_queue")
      .select("*")
      .eq("room_id", data.room_id)
      .order("position", { ascending: true })
      .order("added_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!next) return { ok: true, empty: true };

    await supabase
      .from("rooms")
      .update({
        current_video_id: next.video_id,
        current_video_title: next.title,
        current_video_channel: next.channel,
        current_video_thumbnail: next.thumbnail,
        position_seconds: 0,
        is_playing: true,
        last_state_change: new Date().toISOString(),
      })
      .eq("id", data.room_id);

    await supabase.from("play_history").insert({
      user_id: context.userId,
      room_id: data.room_id,
      video_id: next.video_id,
      title: next.title,
      channel: next.channel,
      thumbnail: next.thumbnail,
    });

    await supabase.from("room_queue").delete().eq("id", next.id);
    return { ok: true, empty: false };
  });

/** Log a solo listen to play_history (no room). */
export const logSoloPlay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { track: z.infer<typeof trackSchema> }) => ({
    track: trackSchema.parse(input.track),
  }))
  .handler(async ({ context, data }) => {
    await context.supabase.from("play_history").insert({
      user_id: context.userId,
      room_id: null,
      video_id: data.track.video_id,
      title: data.track.title,
      channel: data.track.channel ?? null,
      thumbnail: data.track.thumbnail ?? null,
    });
    return { ok: true };
  });
