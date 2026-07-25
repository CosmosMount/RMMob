"use client";

import { useMemo, useState } from "react";
import logos from "@/data/college_logos.json";

type Props = {
  school: string;
  size?: number;
  className?: string;
  tone?: "neutral" | "red" | "blue";
};

const LOGO_MAP = logos as Record<string, string>;

function initials(school: string): string {
  const s = school.replace(/[（(].*$/, "").trim();
  if (s.length <= 2) return s;
  return s.slice(0, 2);
}

function resolveLogo(school: string): string | null {
  if (LOGO_MAP[school]) return LOGO_MAP[school];
  // fuzzy: longest key contained in school or vice versa
  let best: string | null = null;
  let bestLen = 0;
  for (const key of Object.keys(LOGO_MAP)) {
    if (school.includes(key) || key.includes(school)) {
      if (key.length > bestLen) {
        best = LOGO_MAP[key];
        bestLen = key.length;
      }
    }
  }
  return best;
}

export function SchoolCrest({
  school,
  size = 40,
  className = "",
  tone = "neutral",
}: Props) {
  const src = useMemo(() => resolveLogo(school), [school]);
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(src) && !failed;

  return (
    <span
      className={`school-crest tone-${tone} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      title={school}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src!} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className="school-crest-fallback">{initials(school)}</span>
      )}
    </span>
  );
}
