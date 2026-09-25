/**
 * pages.config.js - Page routing configuration
 */
import { lazy } from 'react';

// Recarrega a página uma única vez quando um chunk lazy falha ao carregar
// (acontece quando o app foi atualizado e o navegador tem referência antiga)
const lazyWithRetry = (importFn) => lazy(() =>
  importFn().catch((error) => {
    const key = 'vf_chunk_reload';
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      window.location.reload();
      return new Promise(() => {});
    }
    sessionStorage.removeItem(key);
    throw error;
  })
);

import AceitarConvite from './pages/AceitarConvite';
import Acesso from './pages/Acesso';
import AutoSelectEmpresa from './pages/AutoSelectEmpresa';
import ChooseEmpresa from './pages/ChooseEmpresa';
import Dashboard from './pages/Dashboard';
import EmailRedirect from './pages/EmailRedirect';
import Leads from './pages/Leads';
import Onboarding from './pages/Onboarding';
import Tarefas from './pages/Tarefas';

// Lazy-loaded secondary pages
const AssistenteVendas = lazyWithRetry(() => import('./pages/AssistenteVendas'));
const Automacoes = lazyWithRetry(() => import('./pages/Automacoes'));
const Cadencias = lazyWithRetry(() => import('./pages/Cadencias'));
const ConfiguracaoAlertas = lazyWithRetry(() => import('./pages/ConfiguracaoAlertas'));
const CriarEmpresa = lazyWithRetry(() => import('./pages/CriarEmpresa'));
const DadosEmpresa = lazyWithRetry(() => import('./pages/DadosEmpresa'));
const DashboardAdmin = lazyWithRetry(() => import('./pages/DashboardAdmin'));
const DebugEmpresas = lazyWithRetry(() => import('./pages/DebugEmpresas'));
const DistribuicaoLeads = lazyWithRetry(() => import('./pages/DistribuicaoLeads'));
const EmailMarketing = lazyWithRetry(() => import('./pages/EmailMarketing'));
const EmpresasVendedoras = lazyWithRetry(() => import('./pages/EmpresasVendedoras'));
const Equipes = lazyWithRetry(() => import('./pages/Equipes'));
const Formularios = lazyWithRetry(() => import('./pages/Formularios'));
const GerenciamentoEmpresas = lazyWithRetry(() => import('./pages/GerenciamentoEmpresas'));
const GestaoRBAC = lazyWithRetry(() => import('./pages/GestaoRBAC'));
const GestaoUsuariosEmpresa = lazyWithRetry(() => import('./pages/GestaoUsuariosEmpresa'));
const Integracoes = lazyWithRetry(() => import('./pages/Integracoes'));
const LandingPagePublica = lazyWithRetry(() => import('./pages/LandingPagePublica'));
const LandingPages = lazyWithRetry(() => import('./pages/LandingPages'));
const LpDiagnosticoAutomotivo = lazyWithRetry(() => import('./pages/LpDiagnosticoAutomotivo'));
const MetasEmpresa = lazyWithRetry(() => import('./pages/MetasEmpresa'));
const MetasPorVendedor = lazyWithRetry(() => import('./pages/MetasPorVendedor'));
const MonitoramentoAoVivo = lazyWithRetry(() => import('./pages/MonitoramentoAoVivo'));
const Perfil = lazyWithRetry(() => import('./pages/Perfil'));
const PowerDialerControle = lazyWithRetry(() => import('./pages/PowerDialerControle'));
const Produtos = lazyWithRetry(() => import('./pages/Produtos'));
const Relatorios = lazyWithRetry(() => import('./pages/Relatorios'));
const Scripts = lazyWithRetry(() => import('./pages/Scripts'));
const SolicitarPermissoes = lazyWithRetry(() => import('./pages/SolicitarPermissoes'));

import __Layout from './Layout.jsx';

export const PAGES = {
    "AceitarConvite": AceitarConvite,
    "Acesso": Acesso,
    "AssistenteVendas": AssistenteVendas,
    "AutoSelectEmpresa": AutoSelectEmpresa,
    "Automacoes": Automacoes,
    "Cadencias": Cadencias,
    "ChooseEmpresa": ChooseEmpresa,
    "ConfiguracaoAlertas": ConfiguracaoAlertas,
    "CriarEmpresa": CriarEmpresa,
    "DadosEmpresa": DadosEmpresa,
    "Dashboard": Dashboard,
    "DashboardAdmin": DashboardAdmin,
    "DebugEmpresas": DebugEmpresas,
    "DistribuicaoLeads": DistribuicaoLeads,
    "EmailMarketing": EmailMarketing,
    "EmailRedirect": EmailRedirect,
    "EmpresasVendedoras": EmpresasVendedoras,
    "Equipes": Equipes,
    "Formularios": Formularios,
    "GerenciamentoEmpresas": GerenciamentoEmpresas,
    "GestaoRBAC": GestaoRBAC,
    "GestaoUsuariosEmpresa": GestaoUsuariosEmpresa,
    "Integracoes": Integracoes,
    "LandingPagePublica": LandingPagePublica,
    "LandingPages": LandingPages,
    "Leads": Leads,
    "LpDiagnosticoAutomotivo": LpDiagnosticoAutomotivo,
    "MetasEmpresa": MetasEmpresa,
    "MetasPorVendedor": MetasPorVendedor,
    "MonitoramentoAoVivo": MonitoramentoAoVivo,
    "Onboarding": Onboarding,
    "Perfil": Perfil,
    "PowerDialerControle": PowerDialerControle,
    "Produtos": Produtos,
    "Relatorios": Relatorios,
    "Scripts": Scripts,
    "SolicitarPermissoes": SolicitarPermissoes,
    "Tarefas": Tarefas,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};