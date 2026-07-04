import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Headphones, Library, LogOut, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import saazLogo from "@/assets/saaz-logo.png.asset.json";

export function AppShell({ children }: { children: ReactNode }) {
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", data.user.id)
        .maybeSingle();
      setDisplayName(prof?.display_name ?? data.user.email?.split("@")[0] ?? "You");
      setAvatarUrl(prof?.avatar_url ?? null);
    })();
  }, []);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-60 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-brand/15 blur-[160px]" />
      </div>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/5 bg-background/70 px-6 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <Link to="/app" className="flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-lg bg-brand font-display text-base font-bold italic text-brand-foreground shadow-brand-glow">
              T
            </div>
            <span className="font-display text-xl font-bold tracking-tight">Saaz</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Link
              to="/app"
              activeProps={{ className: "bg-white/10 text-foreground" }}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Headphones className="size-4" />
              Sessions
            </Link>
            <Link
              to="/library"
              activeProps={{ className: "bg-white/10 text-foreground" }}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Library className="size-4" />
              Library
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm md:flex">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-6 rounded-full object-cover" />
            ) : (
              <span className="grid size-6 place-items-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-foreground">{displayName}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof User;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-white/10 bg-surface/40 p-10 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-brand/15 text-brand">
        <Icon className="size-5" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
