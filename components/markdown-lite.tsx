'use client';

/** Minimal markdown rendering: bold, links disabled (plain text), line breaks. React-markdown with HTML stripped. */
export function MarkdownLite({ text }: { text: string }) {
  // Links disabled per §8: render [text](url) as plain text
  const safe = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)').replace(/<[^>]+>/g, '');
  return (
    <span className="whitespace-pre-wrap">
      {safe.split('**').map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}
    </span>
  );
}
