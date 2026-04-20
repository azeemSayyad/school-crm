export const fmtFull = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

export const fmtDT = (d: string | null) =>
  d
    ? new Date(d).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not scheduled";

export const daysAgo = (d: string) => {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  return diff === 0 ? "Today" : diff === 1 ? "1d" : `${diff}d`;
};

export const timeAgo = (d: string | null | undefined): string => {
  if (!d) return "—";
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

export const getInitials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const getHue = (name: string) =>
  name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
