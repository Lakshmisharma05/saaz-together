import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { ThemedBackground } from "@/components/ThemedBackground";
import { searchYouTube, type YtSearchResult } from "@/lib/youtube.functions";
import { logSoloPlay } from "@/lib/rooms.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Music, Radio, Search } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type HistoryRow = Tables<"play_history">;

export const Route = createFileRoute("/_authenticated/solo")({
  component: SoloPage,
});

function SoloPage() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<YtSearchResult[]>([]);
  const [current, setCurrent] = useState<YtSearchResult | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const loadHistory = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from("play_history")
      .select("*")
      .eq("user_id", uid)
      .order("played_at", { ascending: false })
      .limit(15);
    setHistory(data ?? []);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const { results } = await searchYouTube({ data: { q: query } });
      setResults(results);
      if (results.length === 0) toast.info("No results");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function playTrack(t: YtSearchResult) {
    setCurrent(t);
    setIsPlaying(true);
    setResults([]);
    setQuery("");
    try {
      await logSoloPlay({
        data: {
          track: {
            video_id: t.video_id,
            title: t.title,
            channel: t.channel,
            thumbnail: t.thumbnail,
          },
        },
      });
      loadHistory();
    } catch {}
  }

  function replayHistory(h: HistoryRow) {
    playTrack({
      video_id: h.video_id,
      title: h.title,
      channel: h.channel,
      thumbnail: h.thumbnail ?? `https://i.ytimg.com/vi/${h.video_id}/hqdefault.jpg`,
    });
  }

  return (
    <AppShell>
      <ThemedBackground thumbnail={current?.thumbnail ?? null} />
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <Link
              to="/app"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Dashboard
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-brand-glow">
              <Music className="size-3" /> Solo mode
            </span>
          </div>

          <div className="rounded-3xl border border-white/5 bg-black/60 p-3 shadow-panel">
            {current ? (
              <YouTubePlayer
                videoId={current.video_id}
                isPlaying={isPlaying}
                targetPosition={0}
                onLocalStateChange={(s) => {
                  if (s === "paused") setIsPlaying(false);
                  else if (s === "playing") setIsPlaying(true);
                }}
              />
            ) : (
              <div className="grid aspect-video place-items-center rounded-2xl bg-linear-to-br from-brand/20 via-surface to-surface-2 text-center">
                <div>
                  <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-brand/20 text-brand">
                    <Music className="size-6" />
                  </div>
                  <p className="font-display text-lg font-semibold">Play anything</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Search a song and hit play. Just you, the music.
                  </p>
                </div>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <p className="truncate font-display text-base font-semibold">
                  {current?.title ?? "Nothing playing"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {current?.channel ?? " "}
                </p>
              </div>
              {current && (
                <Link
                  to="/live/$videoId"
                  params={{ videoId: current.video_id }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-3 py-1.5 text-xs font-semibold text-live hover:bg-live/25"
                >
                  <Radio className="size-3.5" /> Live chat
                </Link>
              )}
            </div>
          </div>

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
            {results.length > 0 && (
              <div className="mt-3 max-h-[380px] space-y-1 overflow-y-auto pr-1">
                {results.map((r) => (
                  <button
                    key={r.video_id}
                    onClick={() => playTrack(r)}
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
        </div>

        <div className="rounded-3xl border border-white/5 bg-surface/60 p-4">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Your recent plays
          </h3>
          {history.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nothing yet — pick a song to get started.
            </p>
          ) : (
            <ul className="space-y-1">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => replayHistory(h)}
                    className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-white/5"
                  >
                    <img
                      src={h.thumbnail ?? ""}
                      className="h-10 w-16 rounded object-cover"
                      alt=""
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{h.title}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{h.channel}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
