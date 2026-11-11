import { Topbar } from "../components/AppShell";

export default function LibraryView() {
  return (
    <div className="main-scroll community-scroll">
      <Topbar title="Library" />
      <div className="community-grid">
        {[0, 1, 2, 3].map((index) => (
          <div className="generating-card" key={index} style={{ animationDelay: `${index * 90}ms` }}>
            <div className="generating-bar" />
            <div className="generating-line width-72" />
            <div className="generating-line width-48" />
            <div className="generating-block" />
          </div>
        ))}
      </div>
      <div className="feed-sentinel">
        <span>Congo apps and screens appear here</span>
      </div>
    </div>
  );
}
