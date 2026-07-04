import { useState } from "react";
import { mount } from "../shared/mount";
import { callTool, sendFollowUp, useToolOutput } from "../shared/openai";
import { Crest, Empty, TournamentLogo, useApplyTheme } from "../shared/components";
import { img, initials } from "../shared/img";
import type { SearchData, SearchResult } from "../../src/shared/shapes";

const TYPE_LABEL: Record<string, string> = {
  team: "Team",
  player: "Player",
  tournament: "Competition",
  manager: "Manager",
  referee: "Referee",
};

function Avatar({ r }: { r: SearchResult }) {
  const [failed, setFailed] = useState(false);
  if (r.type === "tournament") return <TournamentLogo id={r.id} name={r.name} />;
  if (r.type === "team") return <Crest teamId={r.id} name={r.name} />;
  const src = r.type === "player" ? img.player(r.id) : undefined;
  if (!src || failed) return <span className="sf-crest">{initials(r.name)}</span>;
  return (
    <span className="sf-crest">
      <img src={src} alt="" onError={() => setFailed(true)} />
    </span>
  );
}

function onSelect(r: SearchResult) {
  if (r.type === "tournament") {
    callTool("get_standings", { tournamentId: r.id });
  } else if (r.type === "team") {
    sendFollowUp(`Show ${r.name}'s latest match on SofaScore`);
  } else {
    sendFollowUp(`Tell me about ${r.name}`);
  }
}

function Search() {
  useApplyTheme();
  const d = useToolOutput<SearchData>();
  if (!d) return <div className="sf-root"><Empty>Searching…</Empty></div>;

  return (
    <div className="sf-root">
      <h1 className="sf-title" style={{ marginBottom: 4 }}>Results for “{d.query}”</h1>
      <div className="sf-sub" style={{ marginBottom: 12 }}>{d.count} match{d.count === 1 ? "" : "es"}</div>

      {d.results.length === 0 ? (
        <div className="sf-card"><Empty>Nothing found. Try another name.</Empty></div>
      ) : (
        <div className="sf-card">
          {d.results.map((r) => (
            <div
              key={`${r.type}-${r.id}`}
              className="sf-match"
              style={{ gridTemplateColumns: "auto 1fr auto" }}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(r)}
            >
              <Avatar r={r} />
              <div style={{ minWidth: 0 }}>
                <div className="sf-name" style={{ fontWeight: 700 }}>{r.name}</div>
                {r.subtitle && <div className="sf-sub">{r.subtitle}</div>}
              </div>
              <span className="sf-pill">{TYPE_LABEL[r.type] ?? r.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

mount(<Search />);
