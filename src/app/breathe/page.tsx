'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Phase = 'inhale' | 'hold' | 'exhale';

const PHASES: { phase: Phase; label: string; duration: number }[] = [
  { phase: 'inhale', label: 'BREATHE IN', duration: 4 },
  { phase: 'hold', label: 'HOLD', duration: 7 },
  { phase: 'exhale', label: 'BREATHE OUT', duration: 8 },
];

const TOTAL_CYCLES = 5;

export default function BreathePage() {
  const router = useRouter();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [countdown, setCountdown] = useState(PHASES[0].duration);
  const [cycle, setCycle] = useState(1);
  const [active, setActive] = useState(true);

  const currentPhase = PHASES[phaseIndex];

  const advance = useCallback(() => {
    const nextPhaseIndex = (phaseIndex + 1) % PHASES.length;
    if (nextPhaseIndex === 0) {
      if (cycle >= TOTAL_CYCLES) {
        setActive(false);
        return;
      }
      setCycle((c) => c + 1);
    }
    setPhaseIndex(nextPhaseIndex);
    setCountdown(PHASES[nextPhaseIndex].duration);
  }, [phaseIndex, cycle]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          advance();
          return prev;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [active, advance]);

  const animDuration = currentPhase.phase === 'inhale' ? '4s' : currentPhase.phase === 'hold' ? '7s' : '8s';

  return (
    <div className="fixed inset-0 z-[3000] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center scanlines">
      {/* Close button */}
      <button
        onClick={() => router.back()}
        className="absolute top-6 right-6 border border-border-green text-green text-[11px] px-3 py-1.5 hover:bg-green/10 transition-colors"
      >
        X CLOSE
      </button>

      {/* Breathing Circle */}
      <div
        className="w-64 h-64 md:w-80 md:h-80 rounded-full border-2 border-green flex flex-col items-center justify-center transition-all"
        style={{
          boxShadow: active
            ? `0 0 30px rgba(0,255,65,0.2), 0 0 60px rgba(0,255,65,0.1), inset 0 0 20px rgba(0,255,65,0.05)`
            : 'none',
          animation: active ? `breathePulse ${animDuration} ease-in-out infinite` : 'none',
        }}
      >
        <div className="text-green text-xl md:text-2xl font-bold tracking-wider crt-glow">
          {active ? currentPhase.label : 'COMPLETE'}
        </div>
        {active && (
          <div className="text-green text-5xl md:text-6xl font-bold mt-2 crt-glow">
            {countdown}
          </div>
        )}
        {!active && (
          <div className="text-green-dim text-sm mt-2">Well done.</div>
        )}
      </div>

      {/* Pattern Guide */}
      <div className="mt-8 text-muted text-[11px] tracking-wider">
        INHALE 4s | HOLD 7s | EXHALE 8s
      </div>

      {/* Encouragement */}
      <p className="mt-4 text-text-secondary text-[12px] text-center max-w-xs">
        You&apos;re safe here. Stay with this breath.
      </p>

      {/* Stress Guide */}
      <div className="mt-8 flex flex-col gap-1.5 text-[10px] text-muted max-w-xs">
        <div>1. Find a comfortable position</div>
        <div>2. Focus on the circle and follow the rhythm</div>
        <div>3. Let thoughts pass without judgment</div>
      </div>

      {/* Cycle counter */}
      <div className="mt-6 text-[10px] text-muted">
        Cycle {cycle} of {TOTAL_CYCLES}
      </div>

      {/* Restart if done */}
      {!active && (
        <button
          onClick={() => {
            setPhaseIndex(0);
            setCountdown(PHASES[0].duration);
            setCycle(1);
            setActive(true);
          }}
          className="mt-4 border border-green text-green text-[11px] px-4 py-2 hover:bg-green/10 transition-colors"
        >
          RESTART
        </button>
      )}
    </div>
  );
}
