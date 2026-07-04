import { mount } from "../shared/mount";
import { useToolOutput } from "../shared/openai";
import {
  Empty,
  MatchRow,
  SectionHead,
  TournamentLogo,
  useApplyTheme,
} from "../shared/components";
import type { MatchesData } from "../../src/shared/shapes";

function Matches() {
  useApplyTheme();
  const data = useToolOutput<MatchesData>();
  if (!data) return <div className="sf-root"><Empty>Loading matches…</Empty></div>;

  const liveTotal = data.groups
    .flatMap((g) => g.matches)
    .filter((m) => m.status.live).length;

  return (
    <div className="sf-root">
      <div className="sf-row" style={{ marginBottom: 12, justifyContent: "space-between" }}>
        <div>
          <h1 className="sf-title">{data.title}</h1>
          <div className="sf-sub">
            {data.subtitle ? `${data.subtitle} · ` : ""}
            {data.date ?? "Live"} · {data.count} match{data.count === 1 ? "" : "es"}
          </div>
        </div>
        {liveTotal > 0 && <span className="sf-pill live">{liveTotal} LIVE</span>}
      </div>

      {data.groups.length === 0 ? (
        <div className="sf-card">
          <Empty>No matches to show. Try another date or competition.</Empty>
        </div>
      ) : (
        data.groups.map((g) => (
          <div className="sf-card" key={`${g.tournament.id}-${g.tournament.name}`}>
            <SectionHead
              title={g.tournament.name}
              count={g.matches.length}
              logo={<TournamentLogo id={g.tournament.id} name={g.tournament.name} />}
            />
            {g.matches.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

mount(<Matches />);
