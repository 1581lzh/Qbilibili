export const AVATAR_COLORS = [
  "bg-pink-500", "bg-violet-500", "bg-blue-500", "bg-cyan-500",
  "bg-green-500", "bg-amber-500", "bg-red-500", "bg-indigo-500",
];

export function avatarColorFor(name: string): string {
  const n = name || "";
  let h = 0;
  for (let i = 0; i < n.length; i++) {
    h = n.charCodeAt(i) + ((h << 5) - h);
  }
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
