export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.floor(m)} m`;
  return `${(Math.floor(m / 10) / 100).toFixed(2)} km`;
}
