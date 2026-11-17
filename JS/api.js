/**
 * Cliente da API AACD 3D Connect (usado por todas as telas).
 *
 * Inclua nas páginas, nesta ordem:
 *   <script src="../JS/config.js"></script>
 *   <script src="../JS/api.js" data-perfil="aacd"></script>   (ou "instituicao")
 * Com data-perfil, a página exige login daquele perfil; sem ele, é pública.
 */
(function () {
  const STORAGE_KEY = 'aacd3d.sessao';
  const DASHBOARD = { aacd: 'Tela_Dashboard.html', instituicao: 'Tela_Dashboard_Parceira.html' };
  const baseUrl = () => (window.AACD_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

  const session = {
    get() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
    },
    set(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); },
    clear() { localStorage.removeItem(STORAGE_KEY); },
  };

  class ApiError extends Error {
    constructor(status, message, details) {
      super(message);
      this.status = status;
      this.details = details;
    }
  }

  let refreshing = null;
  async function refreshSession() {
    const atual = session.get();
    if (!atual?.refresh_token) return false;
    refreshing ??= fetch(`${baseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: atual.refresh_token }),
    }).then(async (res) => {
      if (!res.ok) return false;
      session.set({ ...atual, ...(await res.json()) });
      return true;
    }).catch(() => false).finally(() => { refreshing = null; });
    return refreshing;
  }

  /**
   * Chama a API. Exemplos:
   *   api('/solicitacoes', { query: { status: 'pendente' } })
   *   api('/mensagens', { method: 'POST', body: { conteudo: 'Olá' } })
   *   api('/arquivos', { method: 'POST', form: formData })
   */
  async function api(path, { method = 'GET', body, form, query, raw = false, retry = true } = {}) {
    const url = new URL(baseUrl() + path);
    Object.entries(query || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
    const headers = {};
    const token = session.get()?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res;
    try {
      res = await fetch(url, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    } catch {
      throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
    }

    if (res.status === 401 && token && retry && await refreshSession()) {
      return api(path, { method, body, form, query, raw, retry: false });
    }
    if (res.status === 401 && token) {
      session.clear();
      goToLogin();
      throw new ApiError(401, 'Sessão expirada. Entre novamente.');
    }
    if (raw && res.ok) return res;
    if (res.status === 204) return null;

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = data?.error || {};
      throw new ApiError(res.status, err.message || `Erro ${res.status}`, err.details);
    }
    return data;
  }

  function goToLogin() {
    const atual = location.pathname.split('/').pop();
    if (atual !== 'Tela_Login.html') location.href = 'Tela_Login.html';
  }

  async function logout() {
    try { await api('/auth/logout', { method: 'POST', retry: false }); } catch { /* ignora */ }
    session.clear();
    location.href = 'Tela_Login.html';
  }

  /** Garante que há usuário logado com o perfil exigido pela página. */
  function requireLogin(perfil) {
    const usuario = session.get()?.usuario;
    if (!usuario) { goToLogin(); return null; }
    if (perfil && usuario.perfil !== perfil) {
      location.href = DASHBOARD[usuario.perfil] || 'Tela_Login.html';
      return null;
    }
    return usuario;
  }

  // ---- Utilitários de exibição -----------------------------------------
  const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);

  const fmt = {
    data: (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—'),
    dataHora: (v) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'),
    hora: (v) => (v ? new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''),
    numero: (v, casas = 0) => Number(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: casas }),
    idCurto: (id) => (id ? `#${String(id).slice(0, 8).toUpperCase()}` : '—'),
  };

  // Rótulos e classes CSS já usados pelas telas para cada status.
  const STATUS_SOLICITACAO = {
    pendente: { label: 'Pendente', css: 'status-pending', passo: 1 },
    aceita: { label: 'Aceita', css: 'status-pending', passo: 2 },
    em_producao: { label: 'Em produção', css: 'status-production', passo: 3 },
    concluida: { label: 'Concluído', css: 'status-completed', passo: 4 },
    recusada: { label: 'Recusado', css: 'status-cancelled', passo: 0 },
    cancelada: { label: 'Cancelado', css: 'status-cancelled', passo: 0 },
  };
  const STATUS_IMPRESSORA = {
    disponivel: 'Disponível', ocupada: 'Em uso', indisponivel: 'Indisponível',
  };

  /** Mostra uma mensagem num elemento de feedback já existente na tela. */
  function feedback(el, message, tipo = 'info') {
    if (!el) return;
    const cores = { erro: '#c92732', sucesso: '#238b72', info: '#247993' };
    el.textContent = message;
    el.style.color = cores[tipo] || '';
    el.classList.add('visible');
  }

  const errorMessage = (err) => {
    if (err?.details && Array.isArray(err.details)) {
      return `${err.message}: ${err.details.map((d) => d.mensagem || d).join('; ')}`;
    }
    if (err?.details?.message) return `${err.message}: ${err.details.message}`;
    return err?.message || 'Erro inesperado';
  };

  window.AACD = {
    api, ApiError, session, logout, requireLogin, escapeHtml, fmt, feedback, errorMessage,
    STATUS_SOLICITACAO, STATUS_IMPRESSORA, DASHBOARD,
    usuario: null,
  };

  // Proteção automática pela tag <script data-perfil="...">
  const perfil = document.currentScript?.dataset.perfil;
  if (perfil) window.AACD.usuario = requireLogin(perfil);
}());
