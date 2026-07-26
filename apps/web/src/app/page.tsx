import Link from "next/link";
import { HomeTypeRankPanel } from "@/components/home/HomeTypeRankPanel";
import { MatchRow } from "@/components/match/MatchRow";
import { SchoolCrest } from "@/components/match/SchoolCrest";
import { listMatches, schoolStandings } from "@/server/matches";

export default async function HomePage() {
  let matches: ReturnType<typeof listMatches> | null = null;
  let standings: { items: ReturnType<typeof schoolStandings> } | null = null;

  try {
    matches = listMatches({ limit: 16 });
    standings = { items: schoolStandings(12) };
  } catch {
    /* SQLite may be missing */
  }

  return (
    <div className="home-layout">
      <aside className="home-side">
        <section className="panel home-side-panel">
          <div className="home-side-head">
            <h2>学校积分榜</h2>
            <Link href="/teams" className="muted">
              全部
            </Link>
          </div>
          {!standings && <div className="empty" style={{ padding: 16 }}>—</div>}
          {standings && (
            <table className="home-mini-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>学校</th>
                  <th>赛</th>
                  <th>胜</th>
                  <th>分</th>
                </tr>
              </thead>
              <tbody>
                {standings.items.map((s) => (
                  <tr key={s.school}>
                    <td className="num muted">{s.rank}</td>
                    <td>
                      <Link href={`/teams/${encodeURIComponent(s.school)}`} className="home-school-link">
                        <SchoolCrest school={s.school} size={22} />
                        <span className="home-school-name">{s.school}</span>
                      </Link>
                    </td>
                    <td className="num">{s.played}</td>
                    <td className="num">{s.won}</td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {s.pts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </aside>

      <main className="home-main">
        <div className="home-main-head">
          <h1 className="page-title" style={{ fontSize: 18 }}>
            比赛
          </h1>
          <Link href="/matches" className="btn">
            全部赛程
          </Link>
        </div>
        {!matches && <div className="panel empty">未找到本地 SQLite 数据集</div>}
        {matches && (
          <div className="panel-list">
            {matches.items.map((m) => (
              <MatchRow key={m.match_key} match={m} />
            ))}
            {!matches.items.length && <div className="empty">暂无比赛</div>}
          </div>
        )}
      </main>

      <aside className="home-side">
        <HomeTypeRankPanel />
      </aside>
    </div>
  );
}
