import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Loader2, Music } from "lucide-react";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      throw redirect({ to: search.redirect ?? "/app" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.redirect) sessionStorage.setItem("ts_post_auth_redirect", search.redirect);
  }, [search.redirect]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created. You're in!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const dest = sessionStorage.getItem("ts_post_auth_redirect") ?? "/app";
      sessionStorage.removeItem("ts_post_auth_redirect");
      navigate({ to: dest });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    const dest = sessionStorage.getItem("ts_post_auth_redirect") ?? "/app";
    sessionStorage.removeItem("ts_post_auth_redirect");
    navigate({ to: dest });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-brand/25 blur-[140px]" />
      </div>

      <div className="w-full max-w-md rounded-3xl border border-white/5 bg-surface/70 p-8 shadow-panel backdrop-blur-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-brand font-display text-lg font-bold italic text-brand-foreground shadow-brand-glow">
            T
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">
              {mode === "signup" ? "Join Tuneshare" : "Welcome back"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {mode === "signup" ? "Start listening together." : "Sign in to keep the session going."}
            </p>
          </div>
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-white/10 disabled:opacity-60"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-white/10" />
          or with email
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "signup" && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="w-full rounded-xl border border-white/10 bg-background/60 px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-white/10 bg-background/60 px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border border-white/10 bg-background/60 px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand"
          />
          <button
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-brand-glow transition-transform hover:scale-[1.01] disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Music className="size-4" />}
            {mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {mode === "signup" ? "Already have an account? " : "New to Tuneshare? "}
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="font-semibold text-brand hover:underline"
          >
            {mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </p>
      </div>
    </div>
  );
}
