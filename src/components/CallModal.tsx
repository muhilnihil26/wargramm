import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CallModalProps {
  selfId: string;
  peerId: string;
  peerName: string;
  peerAvatar: string;
  conversationId: string;
  mode: "audio" | "video";
  initiator: boolean;
  onClose: () => void;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

/**
 * Lightweight WebRTC call over a Supabase realtime channel used as the signalling layer.
 * The conversation id is the shared room name so both peers join the same channel.
 */
export function CallModal({ selfId, peerId, peerName, peerAvatar, conversationId, mode, initiator, onClose }: CallModalProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"connecting" | "ringing" | "connected" | "ended">(initiator ? "ringing" : "connecting");
  const [muted, setMuted] = useState(false);
  const [effectiveMode, setEffectiveMode] = useState<"audio" | "video">(mode);
  const [camOff, setCamOff] = useState(mode === "audio");
  const [duration, setDuration] = useState(0);

  // Tick duration once connected
  useEffect(() => {
    if (status !== "connected") return;
    const start = Date.now();
    const t = setInterval(() => setDuration(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    const pendingIce: RTCIceCandidateInit[] = [];

    const init = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Calling is not available in this browser.");
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: effectiveMode === "video" ? { width: 640, height: 480, facingMode: "user" } : false,
          });
        } catch (mediaErr) {
          if (mode !== "video") throw mediaErr;
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          setEffectiveMode("audio");
          setCamOff(true);
          toast.info("Camera is blocked, starting voice call instead.");
        }
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current && effectiveMode === "video" && stream.getVideoTracks().length > 0) localVideoRef.current.srcObject = stream;

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        pc.ontrack = (ev) => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = ev.streams[0];
          setStatus("connected");
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") setStatus("connected");
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            toast.error("Call connection lost");
            handleHangup(true);
          }
        };

        // Signaling channel
        const channel = supabase.channel(`call:${conversationId}`, { config: { broadcast: { self: false } } });
        channelRef.current = channel;

        pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            channel.send({ type: "broadcast", event: "ice", payload: { from: selfId, candidate: ev.candidate.toJSON() } });
          }
        };

        const flushIce = async () => {
          while (pendingIce.length) {
            const c = pendingIce.shift()!;
            try { await pc.addIceCandidate(c); } catch (e) { console.warn("ICE add failed", e); }
          }
        };

        channel
          .on("broadcast", { event: "offer" }, async ({ payload }) => {
            if (payload.from === selfId) return;
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({ type: "broadcast", event: "answer", payload: { from: selfId, sdp: answer } });
            await flushIce();
          })
          .on("broadcast", { event: "answer" }, async ({ payload }) => {
            if (payload.from === selfId) return;
            if (!pc.currentRemoteDescription) {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              await flushIce();
            }
          })
          .on("broadcast", { event: "ice" }, async ({ payload }) => {
            if (payload.from === selfId) return;
            if (pc.remoteDescription && pc.remoteDescription.type) {
              try { await pc.addIceCandidate(payload.candidate); } catch (e) { console.warn("ICE failed", e); }
            } else {
              pendingIce.push(payload.candidate);
            }
          })
          .on("broadcast", { event: "hangup" }, ({ payload }) => {
            if (payload.from === selfId) return;
            toast.info("Call ended");
            handleHangup(false);
          })
          .on("broadcast", { event: "ring-ack" }, () => {
            if (initiator) sendOffer();
          })
          .subscribe(async (s) => {
            if (s !== "SUBSCRIBED") return;
            if (!initiator) {
              channel.send({ type: "broadcast", event: "ring-ack", payload: { from: selfId } });
            }
          });

        const sendOffer = async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({ type: "broadcast", event: "offer", payload: { from: selfId, sdp: offer } });
          setStatus("connecting");
        };
      } catch (err: any) {
        const denied = err?.name === "NotAllowedError" || /permission|denied/i.test(err?.message || "");
        toast.error(denied ? "Allow microphone/camera permission, then try the call again." : (err.message || "Could not start call."));
        onClose();
      }
    };
    init();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
  };

  const handleHangup = (notify = true) => {
    if (notify && channelRef.current) {
      channelRef.current.send({ type: "broadcast", event: "hangup", payload: { from: selfId } });
    }
    setStatus("ended");
    cleanup();
    onClose();
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
  };

  const toggleCam = () => {
    const next = !camOff;
    setCamOff(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black text-white">
      {/* Remote stream (full bg) */}
      <video ref={remoteVideoRef} autoPlay playsInline className={`absolute inset-0 h-full w-full object-cover ${effectiveMode === "audio" ? "hidden" : ""}`} />

      {effectiveMode === "audio" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <img src={peerAvatar} alt="" className="h-32 w-32 rounded-full object-cover ring-4 ring-white/10" />
          <p className="text-2xl font-semibold">{peerName}</p>
          <p className="text-sm text-white/70">
            {status === "connected" ? fmt(duration) : status === "ringing" ? "Ringing…" : "Connecting…"}
          </p>
        </div>
      )}

      {/* Local self preview */}
      {effectiveMode === "video" && (
        <video ref={localVideoRef} autoPlay playsInline muted className="absolute right-4 top-16 h-40 w-28 rounded-xl object-cover border border-white/30 z-10" />
      )}

      {/* Top bar */}
      <header className="relative z-20 flex items-center gap-3 p-4 bg-gradient-to-b from-black/60 to-transparent">
        <img src={peerAvatar} alt="" className="h-10 w-10 rounded-full object-cover" />
        <div className="flex-1">
          <p className="font-semibold">{peerName}</p>
          <p className="text-xs text-white/70">
            {status === "connected" ? `${effectiveMode === "video" ? "Video" : "Voice"} · ${fmt(duration)}` : status === "ringing" ? "Ringing…" : "Connecting…"}
          </p>
        </div>
      </header>

      <div className="flex-1" />

      {/* Controls */}
      <div className="relative z-20 flex items-center justify-center gap-4 pb-10 pt-4 bg-gradient-to-t from-black/80 to-transparent">
        <button onClick={toggleMute} className={`flex h-14 w-14 items-center justify-center rounded-full ${muted ? "bg-white text-black" : "bg-white/20"}`}>
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        {effectiveMode === "video" && (
          <button onClick={toggleCam} className={`flex h-14 w-14 items-center justify-center rounded-full ${camOff ? "bg-white text-black" : "bg-white/20"}`}>
            {camOff ? <VideoOff className="h-6 w-6" /> : <VideoIcon className="h-6 w-6" />}
          </button>
        )}
        <button onClick={() => handleHangup(true)} className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 hover:bg-red-600">
          <PhoneOff className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}

/** Tiny floating presence to show an incoming call invite — used in chat header. */
export function CallButton({
  icon: Icon,
  onClick,
  label,
}: {
  icon: typeof Phone;
  onClick: () => void;
  label: string;
}) {
  return (
    <button onClick={onClick} aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-secondary">
      <Icon className="h-5 w-5" />
    </button>
  );
}
