import { mount } from "../shared/mount";
import { useToolOutput } from "../shared/openai";
import {
  Empty,
  SectionHead,
  StandingsTable,
  TournamentLogo,
  useApplyTheme,
} from "../shared/components";
import type { StandingsData } from "../../src/shared/shapes";

function Standings() {
  useApplyTheme();
  const d = useToolOutput<StandingsData>();
  if (!d) return <div className="sf-root"><Empty>Loading table…</Empty></div>;

  return (
    <div className="sf-root">
      <div className="sf-row" style={{ marginBottom: 12, gap: 12 }}>
        <TournamentLogo id={d.tournament.id} name={d.tournament.name} />
        <div>
          <h1 className="sf-title">{d.tournament.name}</h1>
          {d.seasonName && <div className="sf-sub">{d.seasonName}</div>}
        </div>
      </div>

      {d.groups.length === 0 ? (
        <div className="sf-card"><Empty>No standings available.</Empty></div>
      ) : (
        d.groups.map((g, i) => (
          <div className="sf-card" key={i}>
            {(g.name || d.groups.length > 1) && <SectionHead title={g.name ?? `Group ${i + 1}`} />}
            <div style={{ padding: "0 8px" }}>
              <StandingsTable group={g} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

mount(<Standings />);
