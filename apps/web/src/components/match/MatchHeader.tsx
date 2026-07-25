import Link from "next/link";
import { SchoolCrest } from "@/components/match/SchoolCrest";
import type { RoundDetail } from "@/lib/types";

export function MatchHeader({
  detail,
  matchKey,
}: {
  detail: RoundDetail;
  matchKey?: string;
}) {
  return (
    <section className="panel match-header">
      <div className="match-header-meta muted">
        <span>{detail.region}</span>
        <span>·</span>
        <span>{detail.schedule}</span>
        {detail.start_time ? (
          <>
            <span>·</span>
            <span>{detail.start_time}</span>
          </>
        ) : null}
      </div>

      <div className="match-header-scoreboard">
        <div className="mh-team">
          <SchoolCrest school={detail.red_school} size={56} tone="red" />
          <div className="mh-name">{detail.red_school}</div>
        </div>

        <div className="mh-score">
          <div className="mh-score-num">
            <span className="team-red">{detail.red_wins}</span>
            <span className="score-sep">-</span>
            <span className="team-blue">{detail.blue_wins}</span>
          </div>
          <div className="muted mh-round-label">
            Round {detail.round_no}
            {detail.winner ? ` · ${detail.winner} win` : ""}
          </div>
        </div>

        <div className="mh-team">
          <SchoolCrest school={detail.blue_school} size={56} tone="blue" />
          <div className="mh-name">{detail.blue_school}</div>
        </div>
      </div>

      <div className="round-chips">
        {detail.sibling_rounds.map((r) => {
          const href = matchKey
            ? `/matches/${encodeURIComponent(matchKey)}?round=${r.game_id}`
            : undefined;
          const active = r.game_id === detail.game_id;
          const inner = (
            <>
              <span>R{r.round_no}</span>
              {r.winner === "红" && <i className="chip-dot red" />}
              {r.winner === "蓝" && <i className="chip-dot blue" />}
            </>
          );
          return href ? (
            <Link key={r.game_id} href={href} className={`round-chip ${active ? "active" : ""}`}>
              {inner}
            </Link>
          ) : (
            <span key={r.game_id} className={`round-chip ${active ? "active" : ""}`}>
              {inner}
            </span>
          );
        })}
      </div>
    </section>
  );
}
