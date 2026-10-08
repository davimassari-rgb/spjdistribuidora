const PALETTE = [
  "bg-blue-100 text-blue-800",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-violet-100 text-violet-800",
  "bg-rose-100 text-rose-800",
  "bg-cyan-100 text-cyan-800",
  "bg-lime-100 text-lime-800",
];

export function initials(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1 || /[A-Z0-9]/i.test(w));
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

function colorFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Círculo com as iniciais do nome (cor fixa por nome). */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const dimension = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${dimension} ${colorFor(name)}`}
    >
      {initials(name)}
    </span>
  );
}
