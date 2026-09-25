/**
 * telefoniaToken — garante que o token do agente enviado à extensão/3C Plus
 * esteja SEMPRE decriptado. Tokens salvos no UserProfile têm prefixo "enc:"
 * e só podem ser decriptados no backend (get-agent-token).
 */
import { base44 } from '@/api/base44Client';

export async function obterTokenAgenteDecriptado(empresaId, tokenBruto) {
  if (!tokenBruto) return null;
  if (!tokenBruto.startsWith('enc:')) return tokenBruto;
  try {
    const resp = await base44.functions.invoke('executarComando3CPlus', {
      empresaId,
      comando: 'get-agent-token',
    });
    const decrypted = resp?.data?.dados?.token || null;
    if (decrypted && !decrypted.startsWith('enc:')) return decrypted;
    console.warn('[telefoniaToken] backend retornou token ainda criptografado');
    return null;
  } catch (e) {
    console.warn('[telefoniaToken] falha ao decriptar token:', e.message);
    return null;
  }
}