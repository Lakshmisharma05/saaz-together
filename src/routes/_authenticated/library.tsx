import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { searchYouTube, type YtSearchResult } from "@/lib/youtube.functions";
import type { Tables } from "@/integrations/supabase/types";
import { Library as LibraryIcon, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type Playlist = Tables<"playlists">;
type Track = Tables<"playlist_tracks">;

export const Route = createFileRoute("/_authenticated/library")({
  component: LibraryPage,
});

function LibraryPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<YtSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  async function loadPlaylists(preferId?: string) {
    const { data } = await supabase
      .from("playlists")
      .select("*")
      .order("created_at", { ascending: false });
    setPlaylists(data ?? []);
    const next = preferId ?? selectedId ?? data?.[0]?.id ?? null;
    setSelectedId(next);
  }

  async function loadTracks(id: string) {
    const { data } = await supabase
      .from("playlist_tracks")
      .select("*")
      .eq("playlist_id", id)
      .order("position", { ascending: true });
    setTracks(data ?? []);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadPlaylists();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) loadTracks(selectedId);
  }, [selectedId]);

  const current = playlists.find((p) => p.id === selectedId);

  async function newPlaylist() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase
      .from("playlists")
      .insert({ owner_id: userData.user.id, name: "New Playlist" })
      .select()
      .single();
    if (error) return toast.error(error.message);
    await loadPlaylists(data.id);
    setEditingName(true);
    setNameDraft("New Playlist");
  }

  async function deletePlaylist(id: string) {
    if (!confirm("Delete this playlist?")) return;
    await supabase.from("playlists").delete().eq("id", id);
    setSelectedId(null);
    loadPlaylists();
  }

  async function renamePlaylist() {
    if (!current) return;
    await supabase.from("playlists").update({ name: nameDraft.trim() || "Untitled" }).eq("id", current.id);
    setEditingName(false);
    loadPlaylists();
  }

  async function addTrack(t: YtSearchResult) {
    if (!current) return;
    const nextPos = tracks.length;
    const { error } = await supabase.from("playlist_tracks").insert({
      playlist_id: current.id,
      video_id: t.video_id,
      title: t.title,
      channel: t.channel,
      thumbnail: t.thumbnail,
      position: nextPos,
    });
    if (error) return toast.error(error.message);
    toast.success("Added");
    loadTracks(current.id);
  }

  async function removeTrack(id: string) {
    await supabase.from("playlist_tracks").delete().eq("id", id);
    if (current) loadTracks(current.id);
  }

  async function doSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    try {
      const { results } = await searchYouTube({ data: { q } });
      setResults(results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Playlists</h2>
            <button
              onClick={newPlaylist}
              className="grid size-8 place-items-center rounded-full bg-brand text-brand-foreground shadow-brand-glow"
              aria-label="New playlist"
            >
              <Plus className="size-4" />
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : playlists.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
              No playlists yet.
            </p>
          ) : (
            <div className="space-y-1">
              {playlists.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    p.id === selectedId
                      ? "bg-brand/20 text-foreground"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <LibraryIcon className="size-4 shrink-0" />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Main */}
        <section className="min-w-0">
          {!current ? (
            <EmptyState
              icon={LibraryIcon}
              title="Pick a playlist"
              body="Create a playlist to start building your library."
            />
          ) : (
            <>
              <div className="mb-6 flex items-center gap-3">
                {editingName ? (
                  <>
                    <input
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value.slice(0, 80))}
                      className="rounded-lg border border-white/10 bg-background/60 px-3 py-2 font-display text-2xl font-bold outline-none focus:border-brand"
                    />
                    <button
                      onClick={renamePlaylist}
                      className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingName(false)}
                      className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-white/5"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <h1 className="font-display text-3xl font-bold">{current.name}</h1>
                    <button
                      onClick={() => {
                        setEditingName(true);
                        setNameDraft(current.name);
                      }}
                      className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      aria-label="Rename"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <span className="text-sm text-muted-foreground">{tracks.length} tracks</span>
                    <button
                      onClick={() => deletePlaylist(current.id)}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-hot/40 bg-hot/10 px-3 py-1.5 text-xs font-semibold text-hot hover:bg-hot/20"
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </button>
                  </>
                )}
              </div>

              <div className="mb-6 rounded-2xl border border-white/5 bg-surface/60 p-4">
                <form onSubmit={doSearch} className="flex gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-full border border-white/10 bg-background/60 px-3">
                    <Search className="size-4 text-muted-foreground" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search a song or paste a YouTube link"
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
                  <div className="mt-3 max-h-[300px] space-y-1 overflow-y-auto pr-1">
                    {results.map((r) => (
                      <div
                        key={r.video_id}
                        className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5"
                      >
                        <img
                          src={r.thumbnail}
                          className="h-12 w-20 rounded-md object-cover"
                          alt=""
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{r.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {r.channel}
                            {r.duration_text ? ` · ${r.duration_text}` : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => addTrack(r)}
                          className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="divide-y divide-white/5 rounded-2xl border border-white/5 bg-surface/60">
                {tracks.length === 0 && (
                  <p className="p-8 text-center text-sm text-muted-foreground">
                    No tracks yet. Search above to add some.
                  </p>
                )}
                {tracks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3">
                    <img
                      src={t.thumbnail ?? ""}
                      className="h-12 w-20 rounded-md object-cover"
                      alt=""
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.channel}</p>
                    </div>
                    <button
                      onClick={() => removeTrack(t.id)}
                      className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-hot/20 hover:text-hot"
                      aria-label="Remove"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
