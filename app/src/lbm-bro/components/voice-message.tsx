"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/lbm-bro/components/icon";
import type { ChatMsg } from "@/lbm-bro/lib/types";

export function formatVoiceTime(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function pickAudioMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return opts.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

export function VoiceBubble({ msg, mine }: { msg: ChatMsg; mine?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const dur = msg.durationSec || 0;
  const bars = useMemo(() => {
    const n = 18;
    const seed = Math.max(1, Math.round((dur || 1) * 17));
    return Array.from({ length: n }, (_, i) => 28 + ((seed * (i + 3) * 13) % 72));
  }, [dur]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrent(el.currentTime);
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
    };
  }, [msg.audioUrl]);

  if (!msg.audioUrl) return <div className="im-bubble">{msg.text}</div>;

  const progress = dur > 0 ? Math.min(1, current / dur) : 0;

  return (
    <div className={`im-voice${mine ? " me" : ""}`}>
      <button
        type="button"
        className="im-voice-play"
        aria-label={playing ? "Пауза" : "Слушать"}
        onClick={() => {
          const el = audioRef.current;
          if (!el) return;
          if (playing) { el.pause(); setPlaying(false); }
          else { void el.play(); setPlaying(true); }
        }}
      >
        <Icon name={playing ? "pause" : "play"} />
      </button>
      <div className="im-wave" aria-hidden>
        {bars.map((h, i) => (
          <i
            key={i}
            className={i / bars.length <= progress ? "on" : ""}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <span className="im-voice-time">{formatVoiceTime(playing ? current : dur)}</span>
      <audio ref={audioRef} src={msg.audioUrl} preload="metadata" />
    </div>
  );
}
