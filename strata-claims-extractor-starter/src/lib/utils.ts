export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, value: string): void {
  const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function chunkTextByChars(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    const slice = remaining.slice(0, maxChars);
    const splitAt = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('. '));
    const index = splitAt > maxChars * 0.6 ? splitAt + 1 : maxChars;
    chunks.push(remaining.slice(0, index).trim());
    remaining = remaining.slice(index).trimStart();
  }
  if (remaining.length) chunks.push(remaining);
  return chunks;
}

export function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

export function formatTargetSummaryMarkdown(targetName: string, summary: string, pages: string[]): string {
  return `## ${targetName}\n\n${summary}\n\nSource pages: ${pages.join(', ') || 'Not available'}\n`;
}
