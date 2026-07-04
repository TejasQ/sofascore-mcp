import { mount } from "../shared/mount";
import { useToolOutput, useWidgetState } from "../shared/openai";
import {
  Crest,
  Empty,
  LiveDot,
  MatchRow,
  SectionHead,
  StandingsTable,
  useApplyTheme,
} from "../shared/components";
import { kickoff } from "../shared/format";
import { callTool } from "../shared/openai";
import type { BracketRound, MatchSummary, StandingsGroup, WorldCupData } from "../../src/shared/shapes";

const TABS: Array<{ id: string; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "groups", label: "Groups" },
  { id: "knockout", label: "Knockout" },
  { id: "matches", label: "Matches" },
];

function Hero({ d }: { d: WorldCupData }) {
  return (
    <div
      className="sf-card"
      style={{
        marginBottom: 12,
        background:
          "linear-gradient(100deg, #7a1414 0%, #b3421a 42%, #6e2411 70%, #1a1109 100%)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 16px" }}>
        <div style={{ fontSize: 40, filter: "drop-shadow(0 2px 6px rgba(0,0,0,.45))" }}>🏆</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>{d.tournament.name}</div>
          <div style={{ opacity: 0.85, fontSize: 12, fontWeight: 600 }}>
            {d.seasonName}
            {d.tagline ? ` · ${d.tagline}` : ""}
          </div>
        </div>
        {d.highlight && (
          <span className="sf-pill live" style={{ boxShadow: "0 2px 10px rgba(0,0,0,.3)" }}>
            <LiveDot /> {d.highlight}
          </span>
        )}
      </div>
    </div>
  );
}

function GroupSnapshot({ group, index }: { group: StandingsGroup; index: number }) {
  return (
    <div className="sf-card" style={{ margin: 0 }}>
      <SectionHead title={group.name ?? `Group ${index + 1}`} />
      <div style={{ padding: "6px 12px 10px" }}>
        {group.rows.slice(0, 4).map((r) => (
          <div key={r.team.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
            <span className="sf-rank" style={{ width: 16, color: "var(--faint)", fontWeight: 700 }}>{r.position}</span>
            <Crest teamId={r.team.id} name={r.team.name} />
            <span className="sf-name" style={{ flex: 1, fontWeight: 600 }}>{r.team.shortName ?? r.team.name}</span>
            <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{r.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatch({ m }: { m: MatchSummary }) {
  const hasScore = m.homeScore !== undefined && m.awayScore !== undefined;
  const row = (side: "home" | "away") => {
    const t = side === "home" ? m.home : m.away;
    const s = side === "home" ? m.homeScore : m.awayScore;
    const win = hasScore && (s ?? 0) > (side === "home" ? m.awayScore ?? 0 : m.homeScore ?? 0);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
        <Crest teamId={t.id} name={t.name} />
        <span className="sf-name" style={{ flex: 1, fontWeight: win ? 800 : 600, fontSize: 12 }}>
          {t.shortName ?? t.name}
        </span>
        <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
          {hasScore ? s : ""}
        </span>
      </div>
    );
  };
  return (
    <div
      className="sf-card"
      style={{ margin: 0, padding: "8px 10px", cursor: "pointer", minWidth: 190 }}
      onClick={() => callTool("get_match", { eventId: m.id })}
    >
      {row("home")}
      {row("away")}
      <div className="sf-sub" style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
        <span>{m.status.live ? "LIVE" : m.status.type === "finished" ? "FT" : kickoff(m.startTimestamp)}</span>
      </div>
    </div>
  );
}

function Bracket({ rounds }: { rounds: BracketRound[] }) {
  if (!rounds.length) return <div className="sf-card"><Empty>Knockout bracket not available yet.</Empty></div>;
  return (
    <div className="sf-scroll">
      <div style={{ display: "flex", gap: 14, paddingBottom: 6 }}>
        {rounds.map((r) => (
          <div key={r.name} style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 200 }}>
            <div style={{ fontWeight: 800, fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
              {r.name}
            </div>
            {r.matches.map((m) => (
              <BracketMatch key={m.id} m={m} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchesList({ matches }: { matches: MatchSummary[] }) {
  if (!matches.length) return <div className="sf-card"><Empty>No matches to show.</Empty></div>;
  return (
    <div className="sf-card">
      <SectionHead title="World Cup matches" count={matches.length} />
      {matches.map((m) => (
        <MatchRow key={m.id} match={m} />
      ))}
    </div>
  );
}

function WorldCup() {
  useApplyTheme();
  const d = useToolOutput<WorldCupData>();
  // `null` until the user picks a tab, so the tool's `view` drives the default.
  const [tab, setTab] = useWidgetState<string | null>(null);
  if (!d) return <div className="sf-root"><Empty>Loading the World Cup…</Empty></div>;

  const active = tab ?? d.view ?? "overview";
  const featured = d.matches.slice(0, 6);

  return (
    <div className="sf-root">
      <Hero d={d} />

      <div className="sf-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`sf-tab${active === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {active === "overview" && (
        <>
          {featured.length > 0 && (
            <div className="sf-card">
              <SectionHead title={d.highlight ? "Live & featured" : "Matches"} count={featured.length} />
              {featured.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </div>
          )}
          {d.groups.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
              {d.groups.map((g, i) => (
                <GroupSnapshot key={i} group={g} index={i} />
              ))}
            </div>
          )}
          {featured.length === 0 && d.groups.length === 0 && (
            <div className="sf-card"><Empty>World Cup data isn't available right now.</Empty></div>
          )}
        </>
      )}

      {active === "groups" && (
        d.groups.length === 0 ? (
          <div className="sf-card"><Empty>Group standings aren't available yet.</Empty></div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {d.groups.map((g, i) => (
              <div className="sf-card" style={{ margin: 0 }} key={i}>
                <SectionHead title={g.name ?? `Group ${i + 1}`} />
                <div style={{ padding: "0 8px" }}>
                  <StandingsTable group={g} />
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {active === "knockout" && <Bracket rounds={d.knockout} />}

      {active === "matches" && <MatchesList matches={d.matches} />}
    </div>
  );
}

mount(<WorldCup />);
