"use client";

import { Suspense } from "react";
import MatchDetailInner from "./MatchDetailInner";

export default function MatchDetailPage() {
  return (
    <Suspense fallback={<div className="card skeleton" style={{ height: 200 }} />}>
      <MatchDetailInner />
    </Suspense>
  );
}
