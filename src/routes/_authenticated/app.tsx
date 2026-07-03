import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { createRoom, joinRoomByCode } from "@/lib/rooms.functions";
import { toast } from "sonner";
import { Copy, Headphones, Link2, Loader2, Music, Pencil, Users, Clock, User as UserIcon, Sparkles } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { formatDistanceToNow } from "date-fns";

type Room = Tables<"rooms">;
type Friend = Tables<"friends"> & { profile?: { display_name: string; avatar_url: string | null } };
type HistoryRow = Tables<"play_history">;

export const Route = createFileRoute("/_authenticated/app")({
  component: Dashboard,
});

type CreateForm = { mode: "listen" | "jam"; name: string; username: string };

function Dashboard() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [editingFriend, setEditingFriend] = useState<string | null>(null);
  const [nickDraft, setNickDraft] = useState("");

  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;

    const [{ data: myRooms }, { data: participantRows }] = await Promise.all([
      supabase.from("rooms").select("*").eq("host_id", uid).order("created_at", { ascending: false }),
      supabase.from("room_participants").select("room_id").eq("user_id", uid),
    ]);
    const roomIds = new Set<string>();
    (myRooms ?? []).forEach((r) => roomIds.add(r.id));
    (participantRows ?? []).forEach((r) => roomIds.add(r.room_id));
    let allRooms: Room[] = myRooms ?? [];
    if (roomIds.size > 0) {
      const { data: joined } = await supabase
        .from("rooms")
        .select("*")
        .in("id", Array.from(roomIds))
        .order("created_at", { ascending: false });
      allRooms = joined ?? [];
    }

    const { data: friendRows } = await supabase
      .from("friends")
      .select("*")
      .eq("owner_id", uid)
      .order("last_shared_at", { ascending: false });
    const friendIds = (friendRows ?? []).map((f) => f.friend_id);
    let profiles: Record<string, { display_name: string; avatar_url: string | null }> = {};
    if (friendIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", friendIds);
      profiles = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
    }

    const { data: hist } = await supabase
      .from("play_history")
      .select("*")
      .eq("user_id", uid)
      .order("played_at", { ascending: false })
      .limit(20);

    setRooms(allRooms);
    setFriends((friendRows ?? []).map((f) => ({ ...f, profile: profiles[f.friend_id] })));
    setHistory(hist ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate(mode: "listen" | "jam") {
    setCreateForm({
      mode,
      name: mode === "jam" ? "Jam Room" : "Listening Room",
      username: "",
    });
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm) return;
    setCreating(true);
    try {
      const { room } = await createRoom({
        data: {
          name: createForm.name,
          mode: createForm.mode,
          display_name: createForm.username || undefined,
        },
      });
      toast.success(createForm.mode === "jam" ? "Jam room ready" : "Room ready");
      setCreateForm(null);
      navigate({ to: "/room/$roomId", params: { roomId: room.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const { room } = await joinRoomByCode({
        data: { code: joinCode, display_name: joinName || undefined },
      });
      navigate({ to: "/room/$roomId", params: { roomId: room.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setJoining(false);
    }
  }

  async function saveNickname(friend: Friend) {
    await supabase.from("friends").update({ nickname: nickDraft || null }).eq("id", friend.id);
    setEditingFriend(null);
    load();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Hero action bar */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-linear-to-br from-brand/25 via-brand/10 to-transparent p-6">
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-glow">
              Listen together
            </div>
            <h2 className="font-display text-xl font-bold">Create a listening room</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Name your room, pick a username, share the code — you pick the tracks.
            </p>
            <button
              onClick={() => openCreate("listen")}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-brand-glow transition-transform hover:scale-105"
            >
              <Headphones className="size-4" />
              New room
            </button>
          </div>
          <div className="rounded-3xl border border-white/10 bg-linear-to-br from-hot/25 via-hot/10 to-transparent p-6">
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-hot">
              Jam room
            </div>
            <h2 className="font-display text-xl font-bold">Build a queue together</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Everyone adds songs to a shared up-next list. Take turns as DJ.
            </p>
            <button
              onClick={() => openCreate("jam")}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-hot px-4 py-2.5 text-sm font-semibold text-white shadow-panel transition-transform hover:scale-105"
            >
              <Sparkles className="size-4" />
              Start a jam
            </button>
          </div>
          <div className="rounded-3xl border border-white/10 bg-surface/60 p-6">
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Just me
            </div>
            <h2 className="font-display text-xl font-bold">Listen solo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Play anything, save it to history, hop into a live song room anytime.
            </p>
            <Link
              to="/solo"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-white/20"
            >
              <UserIcon className="size-4" />
              Listen solo
            </Link>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-surface/60 p-4">
          <form onSubmit={handleJoin} className="flex flex-col gap-2 md:flex-row md:items-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground md:w-40">
              Got an entry code?
            </span>
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ENTRY CODE"
                maxLength={12}
                className="flex-1 rounded-full border border-white/10 bg-background/60 px-4 py-2 font-mono text-sm uppercase tracking-widest outline-none placeholder:text-muted-foreground focus:border-brand"
              />
              <input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value.slice(0, 40))}
                placeholder="Your username in this room (optional)"
                className="flex-1 rounded-full border border-white/10 bg-background/60 px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-brand"
              />
              <button
                disabled={joining}
                className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold hover:bg-white/20 disabled:opacity-60"
              >
                {joining ? <Loader2 className="size-4 animate-spin" /> : "Join"}
              </button>
            </div>
          </form>
        </div>

        {/* Create-room modal */}
        {createForm && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
            onClick={() => !creating && setCreateForm(null)}
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={submitCreate}
              className="w-full max-w-md rounded-3xl border border-white/10 bg-surface p-6 shadow-panel"
            >
              <div
                className={`mb-1 text-xs font-semibold uppercase tracking-widest ${
                  createForm.mode === "jam" ? "text-hot" : "text-brand-glow"
                }`}
              >
                {createForm.mode === "jam" ? "New jam room" : "New listening room"}
              </div>
              <h3 className="font-display text-xl font-bold">Set up your room</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick a room name and the username your friends will see.
              </p>

              <label className="mt-5 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Room name
              </label>
              <input
                autoFocus
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value.slice(0, 80) })}
                placeholder="Sunday night vibes"
                className="mt-1 w-full rounded-xl border border-white/10 bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-brand"
              />

              <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Your username in this room
              </label>
              <input
                value={createForm.username}
                onChange={(e) =>
                  setCreateForm({ ...createForm, username: e.target.value.slice(0, 40) })
                }
                placeholder="DJ Nova (optional)"
                className="mt-1 w-full rounded-xl border border-white/10 bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-brand"
              />

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateForm(null)}
                  disabled={creating}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-white/5 hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createForm.name.trim()}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60 ${
                    createForm.mode === "jam"
                      ? "bg-hot text-white shadow-panel"
                      : "bg-brand text-brand-foreground shadow-brand-glow"
                  }`}
                >
                  {creating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : createForm.mode === "jam" ? (
                    <Sparkles className="size-4" />
                  ) : (
                    <Headphones className="size-4" />
                  )}
                  Create room
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Sessions */}
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Your sessions</h2>
            <span className="text-xs text-muted-foreground">Chats and songs persist forever</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : rooms.length === 0 ? (
            <EmptyState
              icon={Music}
              title="No sessions yet"
              body="Start a new session or join one with an invite code to begin listening together."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {rooms.map((r) => (
                <Link
                  key={r.id}
                  to="/room/$roomId"
                  params={{ roomId: r.id }}
                  className="group rounded-2xl border border-white/5 bg-surface/60 p-4 transition-colors hover:border-white/15"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                        r.is_active
                          ? "bg-live/15 text-live"
                          : "bg-white/5 text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${r.is_active ? "animate-pulse bg-live" : "bg-muted-foreground"}`}
                      />
                      {r.is_active ? "Live" : "Ended"}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                      {r.invite_code}
                    </span>
                  </div>
                  <h3 className="font-display text-base font-semibold group-hover:text-brand-glow">
                    {r.name}
                  </h3>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {r.current_video_title ? `Last played: ${r.current_video_title}` : "No tracks yet"}
                  </p>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Friends + History */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
              <Users className="size-4 text-brand" />
              Friends
            </h2>
            {friends.length === 0 ? (
              <EmptyState
                icon={Link2}
                title="No listening buddies yet"
                body="Share an invite link. Anyone who joins your session becomes a friend automatically."
              />
            ) : (
              <div className="divide-y divide-white/5 rounded-2xl border border-white/5 bg-surface/60">
                {friends.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 p-4">
                    {f.profile?.avatar_url ? (
                      <img src={f.profile.avatar_url} className="size-10 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="grid size-10 place-items-center rounded-full bg-brand/20 font-display font-bold text-brand">
                        {(f.nickname || f.profile?.display_name || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      {editingFriend === f.id ? (
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            value={nickDraft}
                            onChange={(e) => setNickDraft(e.target.value.slice(0, 40))}
                            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-background/60 px-2 py-1 text-sm outline-none focus:border-brand"
                          />
                          <button
                            onClick={() => saveNickname(f)}
                            className="rounded-lg bg-brand px-2 py-1 text-xs font-semibold text-brand-foreground"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="truncate text-sm font-semibold">
                            {f.nickname || f.profile?.display_name || "Friend"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Last shared{" "}
                            {formatDistanceToNow(new Date(f.last_shared_at), { addSuffix: true })}
                          </p>
                        </>
                      )}
                    </div>
                    {editingFriend !== f.id && (
                      <button
                        onClick={() => {
                          setEditingFriend(f.id);
                          setNickDraft(f.nickname ?? "");
                        }}
                        className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                        aria-label="Edit nickname"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
              <Clock className="size-4 text-brand" />
              Recently played
            </h2>
            {history.length === 0 ? (
              <EmptyState
                icon={Music}
                title="No listening history"
                body="Play something in a session and it'll show up here forever."
              />
            ) : (
              <div className="divide-y divide-white/5 rounded-2xl border border-white/5 bg-surface/60">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 p-3">
                    <img
                      src={h.thumbnail ?? ""}
                      className="size-12 rounded-lg object-cover"
                      alt=""
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{h.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {h.channel} ·{" "}
                        {formatDistanceToNow(new Date(h.played_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

// Unused import silencer for lint
void Copy;
