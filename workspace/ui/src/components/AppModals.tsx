import { LogoMark } from "../Icons";
import type { WorkspaceStatus } from "../types";
import { Modal } from "./Ui";

export function AboutModal({
  open,
  onClose,
  status,
}: {
  open: boolean;
  onClose: () => void;
  status: WorkspaceStatus | null;
}) {
  return (
    <Modal open={open} onClose={onClose} title="About this workspace" width={520} className="about-modal">
      <div className="about-body">
        <div className="about-mark">
          <LogoMark size={28} />
          <div>
            <b>Congo workspace</b>
            <span>Version {status?.version ?? "0.1.0"} · runs on this computer</span>
          </div>
        </div>
        <p>
          See, try and adjust real designs while your own AI writes the code. Browsing the
          Congo library and keeping designs here are free; library source uses your Congo
          subscription.
        </p>
        <p>
          Built on <a href="https://impeccable.style" target="_blank" rel="noopener noreferrer">Impeccable</a>{" "}
          by Paul Bakaus (Apache License 2.0). Its design commands, live editor and request
          handoff run underneath every action here, unchanged. This workspace is part of
          Congo Workspace, a modified version whose changes are listed in NOTICE.md.
        </p>
        <p className="about-fine">
          Inter by Rasmus Andersson (SIL Open Font License 1.1). Dependency notices ship with
          the workspace source.
        </p>
      </div>
    </Modal>
  );
}
