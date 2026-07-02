import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mic, MicOff, PhoneOff, Video, VideoOff, Loader2 } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Peer-to-peer WebRTC mesh call. Uses Supabase Realtime as the signaling channel.
 * Best for small groups (≤4 participants).
 */

type Peer = {
  id: string;
  pc: RTCPeerConnection;
  stream: MediaStream;
};

type SignalPayload =
  | { type: "hello"; from: string }
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: "bye"; from: string };

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function VideoCall({
  roomId,
  userId,
  onLeave,
}: {
  roomId: string;
  userId: string;
  onLeave: () => void;
}) {
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [, forceRender] = useState(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());

  const rerender = () => forceRender((n) => n + 1);

  const attachStream = useCallback((peerId: string, stream: MediaStream) => {
    const el = videoRefs.current.get(peerId);
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, []);

  const createPeerConnection = useCallback(
    (remoteId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(RTC_CONFIG);

      const local = localStreamRef.current;
      if (local) {
        for (const track of local.getTracks()) pc.addTrack(track, local);
      }

      const remoteStream = new MediaStream();
      pc.ontrack = (e) => {
        const tracks = e.streams[0]?.getTracks() ?? [e.track];
        for (const track of tracks) {
          if (!remoteStream.getTracks().find((t) => t.id === track.id)) {
            remoteStream.addTrack(track);
          }
        }
        attachStream(remoteId, remoteStream);
        rerender();
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "signal",
            payload: {
              type: "ice",
              from: userId,
              to: remoteId,
              candidate: e.candidate.toJSON(),
            } satisfies SignalPayload,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          const existing = peersRef.current.get(remoteId);
          if (existing) {
            try { existing.pc.close(); } catch {}
            peersRef.current.delete(remoteId);
            rerender();
          }
        }
      };

      const peer: Peer = { id: remoteId, pc, stream: remoteStream };
      peersRef.current.set(remoteId, peer);
      return pc;
    },
    [attachStream, userId],
  );

  const send = useCallback((payload: SignalPayload) => {
    channelRef.current?.send({ type: "broadcast", event: "signal", payload });
  }, []);

  const cleanupPeer = (id: string) => {
    const p = peersRef.current.get(id);
    if (p) {
      try { p.pc.close(); } catch {}
      peersRef.current.delete(id);
      videoRefs.current.delete(id);
      rerender();
    }
  };

  const teardown = useCallback(() => {
    try {
      send({ type: "bye", from: userId });
    } catch {}
    peersRef.current.forEach((p) => {
      try { p.pc.close(); } catch {}
    });
    peersRef.current.clear();
    videoRefs.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = null;
  }, [send, userId]);

  useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: true,
        });
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const ch = supabase.channel(`rtc-${roomId}`, {
          config: { broadcast: { self: false } },
        });

        ch.on("broadcast", { event: "signal" }, async ({ payload }) => {
          const msg = payload as SignalPayload;
          if (msg.from === userId) return;
          // Only care about targeted messages or global hello/bye
          if ("to" in msg && msg.to !== userId) return;

          if (msg.type === "hello") {
            // Existing peer greeted a newcomer; the newcomer initiates offer.
            // We use tie-breaker: the lower userId string sends the offer.
            const iInitiate = userId < msg.from;
            if (!peersRef.current.has(msg.from) && iInitiate) {
              const pc = createPeerConnection(msg.from);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              send({ type: "offer", from: userId, to: msg.from, sdp: offer });
            } else if (!peersRef.current.has(msg.from)) {
              // Prepare so we can receive an offer soon
              createPeerConnection(msg.from);
            }
          } else if (msg.type === "offer") {
            let pc = peersRef.current.get(msg.from)?.pc;
            if (!pc) pc = createPeerConnection(msg.from);
            await pc.setRemoteDescription(msg.sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send({ type: "answer", from: userId, to: msg.from, sdp: answer });
          } else if (msg.type === "answer") {
            const pc = peersRef.current.get(msg.from)?.pc;
            if (pc) await pc.setRemoteDescription(msg.sdp);
          } else if (msg.type === "ice") {
            const pc = peersRef.current.get(msg.from)?.pc;
            if (pc) {
              try { await pc.addIceCandidate(msg.candidate); } catch {}
            }
          } else if (msg.type === "bye") {
            cleanupPeer(msg.from);
          }
        });

        await new Promise<void>((resolve, reject) => {
          ch.subscribe((status) => {
            if (status === "SUBSCRIBED") resolve();
            else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(status));
          });
        });

        channelRef.current = ch;
        // Announce presence
        ch.send({
          type: "broadcast",
          event: "signal",
          payload: { type: "hello", from: userId } satisfies SignalPayload,
        });
        setStarting(false);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Camera/microphone permission denied",
        );
        setStarting(false);
      }
    })();

    return () => {
      disposed = true;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !micOn;
    stream.getAudioTracks().forEach((t) => (t.enabled = enabled));
    setMicOn(enabled);
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !camOn;
    stream.getVideoTracks().forEach((t) => (t.enabled = enabled));
    setCamOn(enabled);
  };

  const handleLeave = () => {
    teardown();
    onLeave();
  };

  const peerList = Array.from(peersRef.current.values());

  return (
    <div className="rounded-3xl border border-white/5 bg-black/60 p-3 shadow-panel">
      {error ? (
        <div className="p-4 text-sm text-hot">
          Video call failed: {error}
        </div>
      ) : (
        <>
          <div
            className={`grid gap-2 ${
              peerList.length === 0
                ? "grid-cols-1"
                : peerList.length === 1
                  ? "grid-cols-2"
                  : "grid-cols-2 md:grid-cols-3"
            }`}
          >
            <div className="relative aspect-video overflow-hidden rounded-xl bg-surface">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold">
                You {micOn ? "" : "· muted"}
              </span>
              {starting && (
                <div className="absolute inset-0 grid place-items-center bg-black/60 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              )}
            </div>
            {peerList.map((p) => (
              <div key={p.id} className="relative aspect-video overflow-hidden rounded-xl bg-surface">
                <video
                  ref={(el) => {
                    videoRefs.current.set(p.id, el);
                    if (el && p.stream) el.srcObject = p.stream;
                  }}
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold">
                  Friend
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              onClick={toggleMic}
              className={`grid size-9 place-items-center rounded-full ${
                micOn ? "bg-white/10 hover:bg-white/20" : "bg-hot/20 text-hot"
              }`}
              aria-label="Toggle microphone"
            >
              {micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
            </button>
            <button
              onClick={toggleCam}
              className={`grid size-9 place-items-center rounded-full ${
                camOn ? "bg-white/10 hover:bg-white/20" : "bg-hot/20 text-hot"
              }`}
              aria-label="Toggle camera"
            >
              {camOn ? <Video className="size-4" /> : <VideoOff className="size-4" />}
            </button>
            <button
              onClick={handleLeave}
              className="inline-flex items-center gap-1.5 rounded-full bg-hot/20 px-3 py-1.5 text-xs font-semibold text-hot hover:bg-hot/30"
            >
              <PhoneOff className="size-3.5" /> End call
            </button>
          </div>
        </>
      )}
    </div>
  );
}
