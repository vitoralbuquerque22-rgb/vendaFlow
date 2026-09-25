import { sanitizeHTML } from "@/lib/sanitize";

export default function EmailPreview({ html, maxLength = 500, className = "" }) {
  if (!html) return null;
  const preview = maxLength ? html.substring(0, maxLength) + (html.length > maxLength ? '...' : '') : html;
  return (
    <div
      className={`text-slate-300 text-sm ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizeHTML(preview) }}
    />
  );
}