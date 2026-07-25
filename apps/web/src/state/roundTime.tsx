"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type RoundTimeState = {
  gameId: string;
  currentSecond: number;
  durationSeconds: number;
  isPlaying: boolean;
  playbackRate: number;
  selectedTimeRange: [number, number] | null;
};

type Ctx = RoundTimeState & {
  setSecond: (s: number) => void;
  setPlaying: (v: boolean) => void;
  setPlaybackRate: (r: number) => void;
  setRange: (r: [number, number] | null) => void;
  reset: (gameId: string, duration: number) => void;
};

const RoundTimeContext = createContext<Ctx | null>(null);

export function RoundTimeProvider({
  gameId,
  durationSeconds,
  children,
}: {
  gameId: string;
  durationSeconds: number;
  children: ReactNode;
}) {
  const duration = Math.max(0, durationSeconds || 0);
  const [currentSecond, setCurrentSecond] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedTimeRange, setSelectedTimeRange] = useState<[number, number] | null>(null);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);
  const acc = useRef(0);
  const durationRef = useRef(duration);
  durationRef.current = duration;

  const reset = useCallback((gid: string, dur: number) => {
    setCurrentSecond(0);
    setIsPlaying(false);
    setSelectedTimeRange(null);
    void gid;
    void dur;
  }, []);

  useEffect(() => {
    setCurrentSecond(0);
    setIsPlaying(false);
  }, [gameId, duration]);

  useEffect(() => {
    if (!isPlaying || duration <= 0) {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
      return;
    }
    last.current = performance.now();
    acc.current = 0;
    const tick = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      acc.current += dt * playbackRate;
      if (acc.current >= 1) {
        const steps = Math.floor(acc.current);
        acc.current -= steps;
        setCurrentSecond((s) => {
          const next = s + steps;
          const dur = durationRef.current;
          if (next >= dur) {
            // Stop outside updater to avoid React anti-pattern
            queueMicrotask(() => setIsPlaying(false));
            return dur;
          }
          return next;
        });
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [isPlaying, playbackRate, duration]);

  const value = useMemo<Ctx>(
    () => ({
      gameId,
      currentSecond,
      durationSeconds: duration,
      isPlaying,
      playbackRate,
      selectedTimeRange,
      setSecond: (s) => setCurrentSecond(Math.max(0, Math.min(duration, Math.round(s)))),
      setPlaying: (v) => {
        if (v && duration <= 0) return;
        setIsPlaying(v);
      },
      setPlaybackRate,
      setRange: setSelectedTimeRange,
      reset,
    }),
    [
      gameId,
      currentSecond,
      duration,
      isPlaying,
      playbackRate,
      selectedTimeRange,
      reset,
    ]
  );

  return <RoundTimeContext.Provider value={value}>{children}</RoundTimeContext.Provider>;
}

export function useRoundTime() {
  const ctx = useContext(RoundTimeContext);
  if (!ctx) throw new Error("useRoundTime requires RoundTimeProvider");
  return ctx;
}
