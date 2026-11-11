import { Topbar } from "../components/AppShell";
import DesignFrame from "../DesignFrame";
import type { Design, Project } from "../types";

function ProjectPreview({ designs }: { designs: Design[] }) {
  const panes = designs.slice(-2);
  if (panes.length === 0) {
    return <div className="project-preview project-preview-empty"><span /></div>;
  }
  return (
    <div className={`project-preview project-preview-count-${panes.length}`}>
      {panes.map((design, index) => (
        <div className="project-preview-pane" key={`${design.id}-${index}`}>
          <DesignFrame design={design} />
        </div>
      ))}
    </div>
  );
}

export default function ProjectsView({
  projects,
  designs,
  onOpenProject,
}: {
  projects: Project[];
  designs: Record<string, Design>;
  onOpenProject: (project: Project) => void;
}) {
  return (
    <div className="main-scroll projects-scroll">
      <Topbar title="Projects" />
      <div className="projects-grid">
        {projects.map((project) => (
          <div
            className="project-card"
            key={project.id}
            onClick={() => onOpenProject(project)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenProject(project);
              }
            }}
          >
            <ProjectPreview
              designs={project.designIds.map((id) => designs[id]).filter((d): d is Design => Boolean(d))}
            />
            <span>{project.name}</span>
          </div>
        ))}
        {projects.length === 0
          ? [0, 1, 2, 3].map((index) => (
              <div className="project-card project-card-empty" key={index} aria-hidden="true">
                <div className="project-preview project-preview-empty"><span /></div>
                <span />
              </div>
            ))
          : null}
      </div>
      {projects.length === 0 ? (
        <div className="feed-sentinel">
          <span>Saved designs from Compose and the Library appear here</span>
        </div>
      ) : null}
    </div>
  );
}
