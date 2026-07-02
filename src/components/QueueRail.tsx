import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addToQueue, removeFromQueue, playNextFromQueue } from "@/lib/rooms.functions";
import { searchYouTube, type YtSearchResult } from "@/lib/youtube.functions";
import { Loader2, Plus, Search, SkipForward, Trash2, ListMusic } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type QueueRow = Tables<"room_queue">;

export function QueueRail({
  roomId,
  currentUserId,
  hostId,
  canControl,
}: {
  roomId: string;
  currentUserId: string | null;
  hostId: string;
  canControl: boolean;
}) {
  const [items, setItems] = useState<QueueRow[]>([]);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<YtSearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("room_queue")
      .select("*")
      .eq("room_id", roomId)
      .order("position", { ascending: true })
      .order("added_at", { ascending: true });
    setItems(data ?? []);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`queue-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_queue", filter: `room_id=eq.${roomId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    try {
      const { results } = await searchYouTube({ data: { q } });
      setResults(results);
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd(t: YtSearchResult) {
    try {
      await addToQueue({
        data: {
          room_id: roomId,
          track: {
            video_id: t.video_id,
            title: t.title,
            channel: t.channel,
            thumbnail: t.thumbnail,
          },
        },
      });
      toast.success("Added to queue");
      setResults([]);
      setQ("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add");
    }
  }

  async function handleRemove(id: string) {
    await removeFromQueue({ data: { id } });
  }

  async function handleSkip() {
    const res = await playNextFromQueue({ data: { room_id: roomId } });
    if (res.empty) toast.info("Queue is empty");
  }

  return (
    <div className="rounded-3xl border border-white/5 bg-surface/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          <ListMusic className="size-3.5" /> Up next ({items.length})
        </h3>
        <div className="flex gap-1">
          {canControl && items.length > 0 && (
            <button
              onClick={handleSkip}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/20"
              title="Play next in queue"
            >
              <SkipForward className="size-3" /> Next
            </button>
          )}
          <button
            onClick={() => setShowSearch((s) => !s)}
            className="inline-flex items-center gap-1 rounded-full bg-brand/20 px-2.5 py-1 text-[11px] font-semibold text-brand-glow hover:bg-brand/30"
          >
            <Plus className="size-3" /> Add
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="mb-3 space-y-2">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-full border border-white/10 bg-background/60 px-3">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Add a song…"
                className="flex-1 bg-transparent py-1.5 text-xs outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              disabled={searching}
              className="rounded-full bg-brand px-3 text-[11px] font-semibold text-brand-foreground disabled:opacity-60"
            >
              {searching ? <Loader2 className="size-3 animate-spin" /> : "Go"}
            </button>
          </form>
          {results.length > 0 && (
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {results.map((r) => (
                <button
                  key={r.video_id}
                  onClick={() => handleAdd(r)}
                  className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-white/5"
                >
                  <img src={r.thumbnail} className="h-9 w-14 rounded object-cover" alt="" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{r.title}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{r.channel}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Queue is empty. Anyone in the jam can add tracks.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((it, idx) => {
            const canDelete =
              currentUserId && (it.added_by === currentUserId || hostId === currentUserId);
            return (
              <li
                key={it.id}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-white/5"
              >
                <span className="grid size-6 place-items-center rounded-md bg-white/10 text-[10px] font-bold text-muted-foreground">
                  {idx + 1}
                </span>
                <img
                  src={it.thumbnail ?? ""}
                  className="h-9 w-14 rounded object-cover"
                  alt=""
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{it.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{it.channel}</p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => handleRemove(it.id)}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-hot/20 hover:text-hot"
                    aria-label="Remove"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
