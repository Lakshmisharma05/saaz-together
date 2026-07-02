import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Radio, Send, Users } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const Route = createFileRoute("/_authenticated/live/$videoId")({
  component: LivePage,
});

type Presence = { user_id: string; display_name: string; avatar_url: string | null };
type Msg = { id: string; user_id: string; display_name: string; content: string; ts: number };

function LivePage() {
  const { videoId } = Route.useParams();
  const [me, setMe] = useState<{ id: string; name: string; avatar: string | null } | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [videoAuthor, setVideoAuthor] = useState<string>("");
  const [users, setUsers] = useState<Presence[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const chRef = useRef<RealtimeChannel | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", data.user.id)
        .maybeSingle();
      setMe({
        id: data.user.id,
        name: prof?.display_name ?? "Listener",
        avatar: prof?.avatar_url ?? null,
      });
    })();
  }, []);

  // Fetch video meta
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(
          `https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D${videoId}&format=json`,
        );
        if (resp.ok) {
          const meta = (await resp.json()) as { title?: string; author_name?: string };
          setVideoTitle(meta.title ?? "");
          setVideoAuthor(meta.author_name ?? "");
        }
      } catch {}
    })();
  }, [videoId]);

  // Realtime presence + chat
  useEffect(() => {
    if (!me) return;
    const ch = supabase.channel(`live-song-${videoId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: me.id },
      },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<Presence>();
      const flat: Presence[] = [];
      const seen = new Set<string>();
      for (const key of Object.keys(state)) {
        for (const entry of state[key]) {
          if (!seen.has(entry.user_id)) {
            seen.add(entry.user_id);
            flat.push(entry);
          }
        }
      }
      setUsers(flat);
    });

    ch.on("broadcast", { event: "chat" }, ({ payload }) => {
      setMsgs((prev) => [...prev, payload as Msg].slice(-200));
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          user_id: me.id,
          display_name: me.name,
          avatar_url: me.avatar,
        } satisfies Presence);
      }
    });

    chRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
    };
  }, [me, videoId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const send = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed || !me || !chRef.current) return;
      chRef.current.send({
        type: "broadcast",
        event: "chat",
        payload: {
          id: crypto.randomUUID(),
          user_id: me.id,
          display_name: me.name,
          content: trimmed.slice(0, 400),
          ts: Date.now(),
        } satisfies Msg,
      });
      setText("");
    },
    [text, me],
  );

  return (
    <AppShell>
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <Link
              to="/solo"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Back to solo
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-live">
              <Radio className="size-3 animate-pulse" /> Live song room
            </span>
          </div>
          <div className="rounded-3xl border border-white/5 bg-black/60 p-3 shadow-panel">
            <YouTubePlayer videoId={videoId} isPlaying={true} targetPosition={0} />
            <div className="mt-3 px-1">
              <p className="truncate font-display text-base font-semibold">
                {videoTitle || "Live listening"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{videoAuthor}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Chat is ephemeral — messages disappear when you leave the room.
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-white/5 bg-surface/60 p-4">
            <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
              <Users className="size-3.5" /> Listening now ({users.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {users.map((u) => (
                <div
                  key={u.user_id}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3"
                >
                  {u.avatar_url ? (
                    <img src={u.avatar_url} className="size-6 rounded-full object-cover" alt="" />
                  ) : (
                    <span className="grid size-6 place-items-center rounded-full bg-brand text-[10px] font-semibold text-brand-foreground">
                      {u.display_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-xs">{u.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-3xl border border-white/5 bg-surface/60">
          <div className="flex items-center justify-between border-b border-white/5 p-4">
            <h3 className="font-display text-sm font-bold">Live chat</h3>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              {users.length} here
            </span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.length === 0 && (
              <p className="pt-8 text-center text-sm text-muted-foreground">
                Say hi to everyone playing this track 👋
              </p>
            )}
            {msgs.map((m) => {
              const mine = m.user_id === me?.id;
              return (
                <div key={m.id} className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                  <div className={`min-w-0 max-w-[75%] ${mine ? "text-right" : ""}`}>
                    <p className="mb-1 text-[11px] font-bold text-muted-foreground">
                      {mine ? "You" : m.display_name}
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
          <form onSubmit={send} className="flex gap-2 border-t border-white/5 p-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Say something…"
              maxLength={400}
              className="flex-1 rounded-full border border-white/10 bg-background/60 px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-brand"
            />
            <button
              type="submit"
              className="grid size-9 place-items-center rounded-full bg-brand text-brand-foreground shadow-brand-glow"
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
