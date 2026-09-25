import { describe, it, expect } from 'vitest';
import { sanitizeHTML, sanitizeText } from '../sanitize';

describe('sanitizeHTML', () => {
  it('permite tags seguras', () => {
    const input = '<b>negrito</b> e <i>itálico</i>';
    const result = sanitizeHTML(input);
    expect(result).toContain('<b>negrito</b>');
    expect(result).toContain('<i>itálico</i>');
  });

  it('remove script tags', () => {
    const input = '<script>alert("xss")</script><p>texto</p>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('<script>');
    expect(result).toContain('<p>texto</p>');
  });

  it('remove onerror em imagens', () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('onerror');
  });

  it('retorna string vazia para entrada nula', () => {
    expect(sanitizeHTML(null)).toBe('');
    expect(sanitizeHTML(undefined)).toBe('');
    expect(sanitizeHTML('')).toBe('');
  });
});

describe('sanitizeText', () => {
  it('escapa caracteres HTML', () => {
    expect(sanitizeText('<script>')).toBe('&lt;script&gt;');
    expect(sanitizeText('a & b')).toBe('a &amp; b');
    expect(sanitizeText('"quoted"')).toBe('&quot;quoted&quot;');
  });

  it('retorna string vazia para entrada nula', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
  });
});