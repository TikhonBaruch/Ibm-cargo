"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/lbm-bro/components/icon";

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

function SpeechCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function joinParts(base: string, spoken: string) {
  const a = base.trim();
  const b = spoken.trim();
  if (!b) return a;
  if (!a) return b;
  const gap = /[.!?…]$/.test(a) ? " " : a.endsWith(",") ? " " : " ";
  return `${a}${gap}${b}`;
}

export function VoiceTextarea({
  value,
  onChange,
  placeholder,
  rows = 5,
  onToast,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  onToast?: (msg: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<SpeechRec | null>(null);
  const baseRef = useRef(value);
  const stopIntent = useRef(false);

  useEffect(() => {
    if (!listening) baseRef.current = value;
  }, [value, listening]);

  useEffect(() => {
    return () => {
      stopIntent.current = true;
      recRef.current?.abort();
    };
  }, []);

  function toggle() {
    const Ctor = SpeechCtor();
    if (!Ctor) {
      onToast?.("Голосовой набор доступен в Chrome, Edge или Safari");
      return;
    }

    if (listening) {
      stopIntent.current = true;
      recRef.current?.stop();
      setListening(false);
      setInterim("");
      return;
    }

    const rec = new Ctor();
    rec.lang = "ru-RU";
    rec.continuous = true;
    rec.interimResults = true;
    recRef.current = rec;
    stopIntent.current = false;
    baseRef.current = value;
    setListening(true);
    setInterim("");

    rec.onresult = (ev) => {
      let finals = "";
      let live = "";
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const chunk = ev.results[i][0]?.transcript || "";
        if (ev.results[i].isFinal) finals += `${chunk} `;
        else live += chunk;
      }
      if (finals.trim()) {
        const next = joinParts(baseRef.current, finals);
        baseRef.current = next;
        onChange(next);
      }
      setInterim(live);
    };

    rec.onerror = (ev) => {
      if (ev.error === "not-allowed") onToast?.("Разрешите доступ к микрофону в браузере");
      else if (ev.error === "no-speech") onToast?.("Речь не распознана — попробуйте ещё раз");
      else if (ev.error !== "aborted") onToast?.("Не удалось записать голос");
      stopIntent.current = true;
      setListening(false);
      setInterim("");
    };

    rec.onend = () => {
      if (!stopIntent.current) {
        try { rec.start(); return; } catch { /* fall through */ }
      }
      setListening(false);
      setInterim("");
    };

    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  const shown = interim ? joinParts(value, interim) : value;

  return (
    <div className={`voice-field${listening ? " on" : ""}`}>
      <textarea
        rows={rows}
        placeholder={placeholder}
        value={shown}
        onChange={(e) => {
          if (listening) return;
          onChange(e.target.value);
        }}
      />
      <button
        type="button"
        className={`voice-mic${listening ? " on" : ""}`}
        onClick={toggle}
        aria-pressed={listening}
        aria-label={listening ? "Остановить запись" : "Голосовой набор"}
        title={listening ? "Стоп" : "Надиктовать описание"}
      >
        <Icon name="mic" />
      </button>
      {listening ? <span className="voice-hint">Слушаю… нажмите микрофон, чтобы закончить</span> : null}
    </div>
  );
}
