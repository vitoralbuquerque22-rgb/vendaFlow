import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'style', 'class'];

export function sanitizeHTML(dirty) {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

export function sanitizeText(input) {
  if (!input) return '';
  return String(input).replace(/[<>&"']/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;'
  }[c]));
}