import { Topbar } from "../components/AppShell";
import DesignSurface from "../DesignSurface";
import type { ChatProject, Design } from "../types";

function ProjectPreview({
  designs,
}: {
  designs: Design[];
}) {
  const panes = designs.slice(-2);
  if (panes.length === 0) {
    return <div className="project-preview project-preview-empty"><span /></div>;
  }
  return (
    <div className={`project-preview project-preview-count-${panes.length}`}>
      {panes.map((design, index) => (
        <div className="project-preview-pane" key={`${design.id}-${index}`}>
          <DesignSurface kind={design.kind} />
        </div>
      ))}
    </div>
  );
}

export default function ProjectsView({
  projects,
  onOpenChat,
}: {
  projects: ChatProject[];
  onOpenChat: (chat: ChatProject) => void;
}) {
  const empties = Array.from({ length: 8 }, () => "New design");
  return (
    <div className="main-scroll projects-scroll">
      <Topbar title="Projects" />
      <div className="projects-grid">
        {projects.map((project) => (
          <div
            className="project-card"
            key={project.id}
            onClick={() => onOpenChat(project)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenChat(project);
              }
            }}
          >
            <ProjectPreview designs={project.designs} />
            <span>{project.title}</span>
          </div>
        ))}
        {empties.map((label, index) => (
          <div className="project-card project-card-empty" key={`${label}-${index}`}>
            <div className="project-preview project-preview-empty"><span /></div>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
