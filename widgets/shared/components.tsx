import { useEffect, useState } from "react";
import { img, initials } from "./img";
import { kickoff, minuteLabel } from "./format";
import { callTool, useTheme } from "./openai";
import type {
  MatchSummary,
  Stat,
  StandingRow,
  StandingsGroup,
} from "../../src/shared/shapes";

/** Apply the host theme to <html> so CSS variables resolve. */
export function useApplyTheme(): "light" | "dark" {
  const theme = useTheme();
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return theme;
}

export function Crest({
  teamId,
  name,
  size = "sm",
}: {
  teamId?: number;
  name: string;
  size?: "sm" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const src = img.team(teamId);
  const cls = size === "lg" ? "sf-crest lg" : "sf-crest";
  if (!src || failed) return <span className={cls}>{initials(name)}</span>;
  return (
    <span className={cls}>
      <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
}

export function LiveDot() {
  return <span className="sf-live-dot" aria-label="live" />;
}

export function TournamentLogo({ id, name }: { id?: number; name: string }) {
  const [failed, setFailed] = useState(false);
  const src = img.tournament(id);
  if (!src || failed) return <span className="sf-crest">{initials(name)}</span>;
  return (
    <span className="sf-crest">
      <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
}

function StatusCell({ match }: { match: MatchSummary }) {
  const { status } = match;
  if (status.live) {
    return (
      <div className="sf-status live">
        <LiveDot />
        <span>{status.text}</span>
      </div>
    );
  }
  if (status.type === "notstarted") {
    return <div className="sf-status">{kickoff(match.startTimestamp) || status.text}</div>;
  }
  return <div className="sf-status">{status.text || "–"}</div>;
}

export function MatchRow({ match }: { match: MatchSummary }) {
  const hasScore = match.homeScore !== undefined && match.awayScore !== undefined;
  const homeWin = hasScore && (match.homeScore ?? 0) > (match.awayScore ?? 0);
  const awayWin = hasScore && (match.awayScore ?? 0) > (match.homeScore ?? 0);
  const open = () => callTool("get_match", { eventId: match.id });

  const teamRow = (side: "home" | "away", win: boolean, lose: boolean) => {
    const t = side === "home" ? match.home : match.away;
    const score = side === "home" ? match.homeScore : match.awayScore;
    return (
      <div className={`sf-team${lose ? " dim" : ""}`}>
        <Crest teamId={t.id} name={t.name} />
        <span className="sf-name" style={win ? { fontWeight: 800 } : undefined}>
          {t.name}
        </span>
        <span className={`sf-num${lose ? " dim" : ""}`} style={{ marginLeft: "auto" }}>
          {hasScore ? score : ""}
        </span>
      </div>
    );
  };

  return (
    <div className="sf-match" onClick={open} role="button" tabIndex={0}>
      <div className="sf-teams">
        {teamRow("home", homeWin, awayWin)}
        {teamRow("away", awayWin, homeWin)}
      </div>
      <StatusCell match={match} />
    </div>
  );
}

export function SectionHead({
  title,
  count,
  logo,
}: {
  title: string;
  count?: number;
  logo?: React.ReactNode;
}) {
  return (
    <div className="sf-section-head">
      {logo}
      <span>{title}</span>
      {count !== undefined && <span className="sf-count">{count}</span>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="sf-empty">{children}</div>;
}

/** Home-vs-away statistic bar (possession, shots, etc.). */
export function StatBar({ stat }: { stat: Stat }) {
  const h = stat.homeValue ?? 0;
  const a = stat.awayValue ?? 0;
  const total = h + a;
  const hp = total > 0 ? (h / total) * 100 : 50;
  const ap = total > 0 ? (a / total) * 100 : 50;
  return (
    <div className="sf-stat">
      <div className="sf-stat-top">
        <span style={{ color: "var(--home)" }}>{stat.home}</span>
        <span className="sf-stat-name">{stat.name}</span>
        <span style={{ color: "var(--away)" }}>{stat.away}</span>
      </div>
      <div className="sf-bar">
        <div className="h" style={{ width: `${hp}%` }} />
        <div className="a" style={{ width: `${ap}%` }} />
      </div>
    </div>
  );
}

/** Momentum histogram: bars above baseline = home pressure, below = away. */
export function MomentumChart({
  points,
}: {
  points: Array<{ minute: number; value: number }>;
}) {
  if (!points.length) return null;
  const W = 640;
  const H = 120;
  const mid = H / 2;
  const maxMin = Math.max(90, ...points.map((p) => p.minute));
  const maxVal = Math.max(20, ...points.map((p) => Math.abs(p.value)));
  const bw = Math.max(2, W / points.length - 1);
  return (
    <div className="sf-scroll" style={{ padding: "10px 14px" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
        <line x1="0" y1={mid} x2={W} y2={mid} stroke="var(--border-strong)" strokeWidth="1" />
        {points.map((p, i) => {
          const x = (p.minute / maxMin) * (W - bw);
          const h = (Math.abs(p.value) / maxVal) * (mid - 4);
          const home = p.value >= 0;
          return (
            <rect
              key={i}
              x={x}
              y={home ? mid - h : mid}
              width={bw}
              height={h}
              rx={1}
              fill={home ? "var(--home)" : "var(--away)"}
              opacity={0.9}
            />
          );
        })}
      </svg>
    </div>
  );
}

function qualColor(text?: string): string | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  if (t.includes("relegation")) return "var(--live)";
  if (t.includes("europa") || t.includes("conference")) return "var(--success)";
  if (t.includes("champions") || t.includes("qualification") || t.includes("promotion") || t.includes("final") || t.includes("round"))
    return "var(--brand)";
  return "var(--amber)";
}

export function StandingsTable({ group }: { group: StandingsGroup }) {
  return (
    <div className="sf-scroll">
      <table className="sf-table">
        <thead>
          <tr>
            <th className="left" style={{ width: 22 }}>#</th>
            <th className="left">Team</th>
            <th>P</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th>GD</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((r: StandingRow) => (
            <tr key={r.team.id}>
              <td className="left sf-rank">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span
                    className="sf-qual"
                    style={{ background: qualColor(r.promotion) ?? "transparent", height: 16, display: "inline-block", width: 3 }}
                  />
                  {r.position}
                </span>
              </td>
              <td className="left">
                <span className="sf-teamcell">
                  <Crest teamId={r.team.id} name={r.team.name} />
                  <span className="sf-name">{r.team.shortName ?? r.team.name}</span>
                </span>
              </td>
              <td>{r.played}</td>
              <td>{r.win}</td>
              <td>{r.draw}</td>
              <td>{r.loss}</td>
              <td>{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
              <td className="pts">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { minuteLabel };
