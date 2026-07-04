/** Format a unix-seconds kickoff time in the viewer's locale. */
export function kickoff(ts?: number): string {
  if (!ts) return "";
  try {
    return new Date(ts * 1000).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Weekday + day/month for a unix-seconds timestamp. */
export function dayLabel(ts?: number): string {
  if (!ts) return "";
  try {
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

export function minuteLabel(minute?: number, added?: number): string {
  if (minute === undefined) return "";
  return added ? `${minute}+${added}'` : `${minute}'`;
}
