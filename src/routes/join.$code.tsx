import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { joinRoomByCode } from "@/lib/rooms.functions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/join/$code")({
  ssr: false,
  beforeLoad: async ({ params, location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { code: params.code };
  },
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const { room } = await joinRoomByCode({ data: { code } });
        toast.success("Joined the session!");
        navigate({ to: "/room/$roomId", params: { roomId: room.id } });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not join");
        navigate({ to: "/app" });
      }
    })();
  }, [code, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span>Joining session {code}…</span>
      </div>
    </div>
  );
}
