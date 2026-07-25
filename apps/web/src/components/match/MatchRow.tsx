import Link from "next/link";
import { SchoolCrest } from "@/components/match/SchoolCrest";
import type { MatchGroup } from "@/lib/types";

export function MatchRow({ match }: { match: MatchGroup }) {
  return (
    <Link href={`/matches/${encodeURIComponent(match.match_key)}`} className="match-row">
      <div className="match-row-meta muted">
        <span>{match.region}</span>
        <span>·</span>
        <span>{match.schedule}</span>
      </div>
      <div className="match-row-main">
        <div className="match-side left">
          <SchoolCrest school={match.red_school} size={36} tone="red" />
          <span className="match-school">{match.red_school}</span>
        </div>
        <div className="match-score">
          <span className="team-red">{match.red_wins}</span>
          <span className="score-sep">-</span>
          <span className="team-blue">{match.blue_wins}</span>
        </div>
        <div className="match-side right">
          <span className="match-school">{match.blue_school}</span>
          <SchoolCrest school={match.blue_school} size={36} tone="blue" />
        </div>
      </div>
    </Link>
  );
}
