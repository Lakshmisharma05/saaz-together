import { createFileRoute, Link } from "@tanstack/react-router";
import { Headphones, Link2, MessageCircle, History } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-brand/25 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-hot/15 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/5 bg-background/70 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-brand font-display text-lg font-bold italic text-brand-foreground shadow-brand-glow">
            T
          </div>
          <span className="font-display text-xl font-bold tracking-tight">Tuneshare</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/auth"
            className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-brand-foreground shadow-brand-glow transition-transform hover:scale-105"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-20 pb-24">
        <section className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-live" />
            Now in beta
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-balance md:text-7xl">
            Listen to music{" "}
            <span className="bg-linear-to-r from-brand via-brand-glow to-hot bg-clip-text text-transparent">
              together
            </span>
            , wherever you are.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
            Share an invite link, sync to the exact same second, chat while the beat drops. Every
            song and message stays after the session ends.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-brand-glow transition-transform hover:scale-105"
            >
              <Headphones className="size-4" />
              Start a session
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
            >
              I already have an account
            </Link>
          </div>
        </section>

        <section className="mt-24 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Link2,
              title: "One link. One session.",
              body: "Send a friend an invite link and you're in the same room, on the same song, at the same second.",
            },
            {
              icon: MessageCircle,
              title: "Chat as you listen",
              body: "Live chat sits next to the player. Nickname your friends, react to drops, keep every message forever.",
            },
            {
              icon: History,
              title: "Never lose a moment",
              body: "Playlists, chats, and shared listening history stick around long after the invite link expires.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-3xl border border-white/5 bg-surface/60 p-6 backdrop-blur-sm transition-colors hover:border-white/10"
            >
              <div className="mb-4 grid size-10 place-items-center rounded-xl bg-brand/15 text-brand">
                <Icon className="size-5" />
              </div>
              <h3 className="font-display text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-muted-foreground">
        Built with love for music and the friends who share it.
      </footer>
    </div>
  );
}
