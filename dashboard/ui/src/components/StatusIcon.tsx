interface Props {
  status: boolean | null;
  /** Shown when true, kept visually quiet (plain text, no colored pill): a successful "yes"
   * shouldn't compete for attention once dozens of them repeat down a matrix. */
  yesLabel: string;
  /** Shown when false, a colored pill, deliberately more visually prominent than `yesLabel`, so
   * the eye goes to the gaps rather than the successes. */
  noLabel: string;
  naLabel?: string;
}

/** A tri-state accessibility flag rendered as text + color (never color alone, never an icon
 * glyph), "yes" reads as plain quiet text, "no" as a stronger pill, "N/A" as a muted pill. */
export default function StatusIcon({ status, yesLabel, noLabel, naLabel = 'N/A' }: Props) {
  if (status === true) return <span className="access-status access-status-ok">{yesLabel}</span>;
  if (status === false) return <span className="access-status access-status-gap">{noLabel}</span>;
  return <span className="access-status access-status-na">{naLabel}</span>;
}
