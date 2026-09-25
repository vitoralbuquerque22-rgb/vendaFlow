/**
 * Formata um telefone brasileiro para o padrão (DD) 9 XXXX-XXXX ou (DD) XXXX-XXXX
 * Aceita qualquer formato de entrada, extrai apenas os dígitos.
 */
export function formatarTelefone(telefone) {
  if (!telefone) return "";
  const digits = telefone.replace(/\D/g, "");

  // Remove prefixo 55 do Brasil se tiver 12 ou 13 dígitos
  const clean = (digits.length === 13 || digits.length === 12) ? digits.slice(2) : digits;

  if (clean.length === 11) {
    // Celular: (DD) 9 XXXX-XXXX
    return `(${clean.slice(0, 2)}) ${clean[2]} ${clean.slice(3, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    // Fixo: (DD) XXXX-XXXX
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  // Fallback: retorna como veio
  return telefone;
}