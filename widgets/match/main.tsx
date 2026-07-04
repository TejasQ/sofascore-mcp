import { mount } from "../shared/mount";
import { useToolOutput } from "../shared/openai";
import {
  Crest,
  Empty,
  LiveDot,
  MomentumChart,
  SectionHead,
  StatBar,
  useApplyTheme,
} from "../shared/components";
import { kickoff, minuteLabel } from "../shared/format";
import type { Incident, MatchDetail } from "../../src/shared/shapes";

function IncidentIcon({ inc }: { inc: Incident }) {
  if (inc.type === "goal")
    return <span title="Goal">{inc.goalType === "penalty" ? "⚽(P)" : inc.goalType === "ownGoal" ? "⚽(OG)" : "⚽"}</span>;
  if (inc.type === "card")
    return (
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 13,
          borderRadius: 2,
          background: inc.cardColor === "red" ? "var(--live)" : "#ffcc00",
        }}
        title={`${inc.cardColor} card`}
      />
    );
  if (inc.type === "substitution") return <span title="Substitution" style={{ color: "var(--brand)" }}>⇄</span>;
  return <span className="sf-muted">•</span>;
}

function TimelineRow({ inc }: { inc: Incident }) {
  if (inc.type === "period") {
    return (
      <div style={{ textAlign: "center", padding: "6px 0" }}>
        <span className="sf-pill">{inc.detail ?? "—"}</span>
      </div>
    );
  }
  const home = inc.team === "home";
  const main = inc.player ?? inc.detail ?? "";
  const sub =
    inc.type === "goal"
      ? inc.assist
        ? `assist ${inc.assist}`
        : inc.scoreHome !== undefined
          ? `${inc.scoreHome}–${inc.scoreAway}`
          : ""
      : inc.type === "substitution"
        ? inc.detail
          ? `out ${inc.detail}`
          : ""
        : inc.detail ?? "";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: home ? "row" : "row-reverse",
        alignItems: "center",
        gap: 8,
        padding: "7px 14px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span className="sf-muted" style={{ minWidth: 34, textAlign: home ? "left" : "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
        {minuteLabel(inc.minute, inc.addedMinute)}
      </span>
      <IncidentIcon inc={inc} />
      <div style={{ textAlign: home ? "left" : "right", flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{main}</div>
        {sub && <div className="sf-sub">{sub}</div>}
      </div>
    </div>
  );
}

function Match() {
  useApplyTheme();
  const d = useToolOutput<MatchDetail>();
  if (!d) return <div className="sf-root"><Empty>Loading match…</Empty></div>;

  const hasScore = d.homeScore !== undefined && d.awayScore !== undefined;
  const statusLine = [d.tournament.name, d.round, d.seasonName, d.venue].filter(Boolean).join(" · ");
  const stats = (d.statistics ?? []).filter((s) => s.homeValue !== undefined || s.awayValue !== undefined).slice(0, 10);

  return (
    <div className="sf-root">
      <div className="sf-card">
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, padding: "18px 14px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
            <Crest teamId={d.home.id} name={d.home.name} size="lg" />
            <div style={{ fontWeight: 700 }}>{d.home.shortName ?? d.home.name}</div>
          </div>
          <div style={{ textAlign: "center", minWidth: 96 }}>
            {d.status.live && (
              <div style={{ marginBottom: 4 }}>
                <span className="sf-pill live"><LiveDot /> {d.status.text}</span>
              </div>
            )}
            <div style={{ fontSize: 34, fontWeight: 900, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {hasScore ? `${d.homeScore} – ${d.awayScore}` : kickoff(d.startTimestamp) || "vs"}
            </div>
            {!d.status.live && (
              <div className="sf-sub" style={{ marginTop: 6 }}>{d.status.type === "finished" ? "Full time" : d.status.text}</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
            <Crest teamId={d.away.id} name={d.away.name} size="lg" />
            <div style={{ fontWeight: 700 }}>{d.away.shortName ?? d.away.name}</div>
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "0 14px 14px", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <span className="sf-sub">{statusLine}</span>
        </div>
      </div>

      {d.momentum && d.momentum.length > 0 && (
        <div className="sf-card">
          <SectionHead title="Momentum" />
          <MomentumChart points={d.momentum} />
          <div className="sf-sub" style={{ padding: "0 14px 12px", display: "flex", gap: 14 }}>
            <span><span style={{ color: "var(--home)" }}>■</span> {d.home.shortName ?? d.home.name}</span>
            <span><span style={{ color: "var(--away)" }}>■</span> {d.away.shortName ?? d.away.name}</span>
          </div>
        </div>
      )}

      {d.incidents.length > 0 && (
        <div className="sf-card">
          <SectionHead title="Timeline" count={d.incidents.filter((i) => i.type !== "period").length} />
          {d.incidents.map((inc, i) => (
            <TimelineRow inc={inc} key={i} />
          ))}
        </div>
      )}

      {stats.length > 0 && (
        <div className="sf-card">
          <SectionHead title="Statistics" />
          {stats.map((s, i) => (
            <StatBar stat={s} key={i} />
          ))}
        </div>
      )}
    </div>
  );
}

mount(<Match />);
