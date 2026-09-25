import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getImpersonation, setImpersonation } from '../hooks/usePermissions';

describe('Impersonation HMAC', () => {
  afterEach(() => {
    setImpersonation(null);
  });

  it('salva e recupera impersonação válida', () => {
    const data = { papel: 'gestor_empresa', empresaId: 'emp123' };
    setImpersonation(data);
    const result = getImpersonation();
    expect(result).toEqual(data);
  });

  it('rejeita impersonação com assinatura adulterada', () => {
    const data = { papel: 'gestor_empresa', empresaId: 'emp123' };
    setImpersonation(data);
    // Adulterar a assinatura diretamente
    sessionStorage.setItem('vf_imp_sig', 'assinatura_falsa');
    const result = getImpersonation();
    expect(result).toBeNull();
  });

  it('retorna null quando não há impersonação', () => {
    expect(getImpersonation()).toBeNull();
  });
});