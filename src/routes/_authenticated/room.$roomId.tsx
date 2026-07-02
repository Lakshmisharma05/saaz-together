import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { QueueRail } from "@/components/QueueRail";
import { VideoCall } from "@/components/VideoCall";
import { endRoom, playNextFromQueue, updateRoomPlayback } from "@/lib/rooms.functions";
import { searchYouTube, type YtSearchResult } from "@/lib/youtube.functions";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Loader2,
  MessageCircle,
  Music,
  PowerOff,
  Radio,
  Search,
  Send,
  Users,
  Video,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { formatDistanceToNow } from "date-fns";

type Room = Tables<"rooms">;
type ChatMessage = Tables<"chat_messages">;
type Participant = Tables<"room_participants">;
type Profile = Tables<"profiles">;

export const Route = createFileRoute("/_authenticated/room/$roomId")({
  component: RoomPage,
});

function RoomPage() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<YtSearchResult[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Load current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: r }, { data: chat }, { data: parts }] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
        supabase
          .from("chat_messages")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true })
          .limit(500),
        supabase.from("room_participants").select("*").eq("room_id", roomId),
      ]);
      if (!r) {
        toast.error("Session not found");
        navigate({ to: "/app" });
        return;
      }
      setRoom(r);
      setMessages(chat ?? []);
      setParticipants(parts ?? []);
      const ids = Array.from(new Set([r.host_id, ...(parts ?? []).map((p) => p.user_id)]));
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
      setProfiles(Object.fromEntries((profs ?? []).map((p) => [p.id, p])));
      setLoading(false);
    })();
  }, [roomId, navigate]);

  // Realtime subscriptions
  useEffect(() => {
    const ch = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new as Room),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as ChatMessage]),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_participants", filter: `room_id=eq.${roomId}` },
        (payload) => setParticipants((prev) => [...prev, payload.new as Participant]),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Compute target position with playback drift
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const targetPosition = useMemo(() => {
    if (!room) return 0;
    if (!room.is_playing) return Number(room.position_seconds ?? 0);
    const elapsed = (Date.now() - new Date(room.last_state_change).getTime()) / 1000;
    return Number(room.position_seconds ?? 0) + Math.max(0, elapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, tick]);

  const canControl = !!room && room.is_active;
  const isHost = !!me && !!room && me === room.host_id;

  const handleTogglePlay = useCallback(async () => {
    if (!room) return;
    const now = new Date();
    // Recompute current authoritative position from server timestamps
    const elapsed = room.is_playing
      ? (Date.now() - new Date(room.last_state_change).getTime()) / 1000
      : 0;
    const pos = Number(room.position_seconds ?? 0) + elapsed;
    await updateRoomPlayback({
      data: {
        room_id: room.id,
        is_playing: !room.is_playing,
        position_seconds: pos,
      },
    });
    void now;
  }, [room]);

  const handlePickTrack = useCallback(
    async (t: YtSearchResult) => {
      if (!room) return;
      await updateRoomPlayback({
        data: {
          room_id: room.id,
          track: {
            video_id: t.video_id,
            title: t.title,
            channel: t.channel,
            thumbnail: t.thumbnail,
          },
        },
      });
      setSearchResults([]);
      setQuery("");
    },
    [room],
  );

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const { results } = await searchYouTube({ data: { q: query } });
      setSearchResults(results);
      if (results.length === 0) toast.info("No results — try different keywords");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!msg.trim() || !me) return;
    const text = msg.trim().slice(0, 500);
    setMsg("");
    const { error } = await supabase
      .from("chat_messages")
      .insert({ room_id: roomId, user_id: me, content: text, kind: "text" });
    if (error) toast.error(error.message);
  }

  async function handleEndSession() {
    if (!room) return;
    if (!confirm("End this session? Chat and history will stay saved.")) return;
    await endRoom({ data: { room_id: room.id } });
    toast.success("Session ended");
  }

  const inviteUrl = room ? `${window.location.origin}/join/${room.invite_code}` : "";

  if (loading || !room) {
    return (
      <AppShell>
        <div className="flex h-[70vh] items-center justify-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
        {/* Left: player + search */}
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/app"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              All sessions
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs">
                <span className="font-semibold text-muted-foreground">Invite:</span>
                <span className="font-mono uppercase tracking-widest">{room.invite_code}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl);
                    toast.success("Link copied");
                  }}
                  className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  aria-label="Copy invite link"
                >
                  <Copy className="size-3" />
                </button>
              </div>
              {isHost && room.is_active && (
                <button
                  onClick={handleEndSession}
                  className="inline-flex items-center gap-1.5 rounded-full border border-hot/40 bg-hot/10 px-3 py-1.5 text-xs font-semibold text-hot hover:bg-hot/20"
                >
                  <PowerOff className="size-3.5" />
                  End session
                </button>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-black/60 p-3 shadow-panel">
            {room.current_video_id ? (
              <YouTubePlayer
                videoId={room.current_video_id}
                isPlaying={!!room.is_playing && !!room.is_active}
                targetPosition={targetPosition}
              />
            ) : (
              <div className="grid aspect-video place-items-center rounded-2xl bg-linear-to-br from-brand/20 via-surface to-surface-2 text-center">
                <div>
                  <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-brand/20 text-brand">
                    <Music className="size-6" />
                  </div>
                  <p className="font-display text-lg font-semibold">No track playing</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Search below and pick a song to start.
                  </p>
                </div>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <p className="truncate font-display text-base font-semibold">
                  {room.current_video_title ?? "Nothing playing"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {room.current_video_channel ?? " "}
                </p>
              </div>
              {room.current_video_id && canControl && (
                <button
                  onClick={handleTogglePlay}
                  className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-white/20"
                >
                  {room.is_playing ? "Pause for everyone" : "Play for everyone"}
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wider">
              {room.is_active ? (
                <>
                  <span className="size-1.5 animate-pulse rounded-full bg-live" />
                  <span className="text-live">Synced in real-time</span>
                </>
              ) : (
                <span className="text-muted-foreground">Session ended · chat and history saved</span>
              )}
            </div>
          </div>

          {canControl && (
            <div className="rounded-3xl border border-white/5 bg-surface/60 p-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-full border border-white/10 bg-background/60 px-3">
                  <Search className="size-4 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search a song, artist, or paste a YouTube link"
                    className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <button
                  disabled={searching}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand-glow disabled:opacity-60"
                >
                  {searching ? <Loader2 className="size-4 animate-spin" /> : "Search"}
                </button>
              </form>
              {searchResults.length > 0 && (
                <div className="mt-3 max-h-[380px] space-y-1 overflow-y-auto pr-1">
                  {searchResults.map((r) => (
                    <button
                      key={r.video_id}
                      onClick={() => handlePickTrack(r)}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/5"
                    >
                      <img src={r.thumbnail} className="h-12 w-20 rounded-md object-cover" alt="" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.channel}
                          {r.duration_text ? ` · ${r.duration_text}` : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-3xl border border-white/5 bg-surface/60 p-4">
            <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
              <Users className="size-3.5" /> Listening now ({participants.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => {
                const prof = profiles[p.user_id];
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3"
                  >
                    {prof?.avatar_url ? (
                      <img
                        src={prof.avatar_url}
                        className="size-6 rounded-full object-cover"
                        alt=""
                      />
                    ) : (
                      <span className="grid size-6 place-items-center rounded-full bg-brand text-[10px] font-semibold text-brand-foreground">
                        {(prof?.display_name ?? "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-xs">{prof?.display_name ?? "Listener"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: chat */}
        <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-3xl border border-white/5 bg-surface/60">
          <div className="flex items-center justify-between border-b border-white/5 p-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold">
              <MessageCircle className="size-4 text-brand" /> Session chat
            </h3>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              {participants.length} online
            </span>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="pt-8 text-center text-sm text-muted-foreground">
                No messages yet. Say hi 👋
              </p>
            )}
            {messages.map((m) => {
              if (m.kind === "system") {
                return (
                  <div key={m.id} className="text-center">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {m.content}
                    </span>
                  </div>
                );
              }
              const mine = m.user_id === me;
              const author = m.user_id ? profiles[m.user_id] : null;
              return (
                <div key={m.id} className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                  <div className={`min-w-0 max-w-[75%] ${mine ? "text-right" : ""}`}>
                    <p className="mb-1 text-[11px] font-bold text-muted-foreground">
                      {mine ? "You" : author?.display_name ?? "Listener"}
                      <span className="ml-2 font-normal opacity-60">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </span>
                    </p>
                    <div
                      className={`inline-block break-words rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? "rounded-tr-none bg-brand text-brand-foreground"
                          : "rounded-tl-none bg-white/5 text-foreground"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <form
            onSubmit={sendMessage}
            className="flex gap-2 border-t border-white/5 p-3"
          >
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Say something…"
              maxLength={500}
              className="flex-1 rounded-full border border-white/10 bg-background/60 px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-brand"
            />
            <button
              disabled={!msg.trim()}
              className="grid size-9 place-items-center rounded-full bg-brand text-brand-foreground shadow-brand-glow disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
