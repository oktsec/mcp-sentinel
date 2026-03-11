export function truncateText(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}
