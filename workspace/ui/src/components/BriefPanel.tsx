import type { Brief } from "../types";

const ROWS: { key: keyof Brief; label: string }[] = [
  { key: "who", label: "Who needs it" },
  { key: "why", label: "Why it fits you" },
  { key: "supports", label: "What supports it" },
  { key: "next", label: "What to look into next" },
];

/** A product idea's brief. Shown from the "i" icon; closed until asked for. */
export default function BriefPanel({ brief, className = "" }: { brief: Brief; className?: string }) {
  const rows = ROWS.filter((row) => brief[row.key]);
  return (
    <div className={`brief-panel ${className}`.trim()} role="note" aria-label="Brief" onClick={(event) => event.stopPropagation()}>
      {rows.map((row) => (
        <p key={row.key}>
          <b>{row.label}</b>
          {brief[row.key]}
        </p>
      ))}
      {rows.length === 0 && brief.text ? <p>{brief.text}</p> : null}
    </div>
  );
}
