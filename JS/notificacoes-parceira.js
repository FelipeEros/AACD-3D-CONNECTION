(function () {
  const { api, escapeHtml, fmt, usuario } = window.AACD;
  if (usuario?.perfil !== 'instituicao') return;
  let notificationButton = document.querySelector('#notificationButton')
    || document.querySelector('[aria-label="Notificações"]');
  if (!notificationButton) return;
  let notificationMenu = notificationButton.closest('.notification-menu');
  if (!notificationMenu) {
    notificationMenu = document.createElement('div');
    notificationMenu.className = 'notification-menu';
    notificationButton.parentNode.insertBefore(notificationMenu, notificationButton);
    notificationMenu.appendChild(notificationButton);
  }
  notificationButton.classList.add('notification-button');
  let notificationPanel = notificationMenu.querySelector('#notificationPanel');
  if (!notificationPanel) {
    notificationPanel = document.createElement('section');
    notificationPanel.className = 'notification-panel';
    notificationPanel.id = 'notificationPanel';
    notificationPanel.setAttribute('aria-labelledby', 'notificationTitle');
    notificationPanel.innerHTML = `
      <header class="notification-header">
        <h2 id="notificationTitle">Notificações</h2>
        <button type="button" class="notification-mark-read">Marcar como lidas</button>
      </header>
      <div class="notification-list"></div>
      <p class="notification-empty">Você está em dia!</p>`;
    notificationMenu.appendChild(notificationPanel);
  }
  const notificationList = notificationPanel?.querySelector('.notification-list');
  let notificationBadge = notificationButton?.querySelector('.notification-badge')
    || document.querySelector('.notification-badge');
  if (!notificationBadge) {
    notificationBadge = document.createElement('span');
    notificationBadge.className = 'notification-badge';
    notificationButton.appendChild(notificationBadge);
  }
  const markNotificationsRead = notificationPanel?.querySelector('#markNotificationsRead')
    || notificationPanel?.querySelector('.notification-mark-read');
  const notificationEmpty = document.querySelector('.notification-empty');
  const readKey = `aacd3d.notificacoes.lidas.${usuario?.id || 'instituicao'}`;
  const preferenceKey = `aacd3d.notificacoes.${usuario?.instituicao_id || 'local'}`;
  let notifications = [];
  let readIds = loadReadIds();

  if (!notificationButton || !notificationMenu || !notificationPanel
    || !notificationList || !notificationBadge || !markNotificationsRead || !notificationEmpty) return;

  function loadReadIds() {
    try {
      return new Set(JSON.parse(localStorage.getItem(readKey) || '[]'));
    } catch {
      return new Set();
    }
  }

  function saveReadIds() {
    localStorage.setItem(readKey, JSON.stringify([...readIds].slice(-300)));
  }

  function idade(value) {
    if (!value) return '';
    const date = new Date(value);
    const minutos = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (minutos < 1) return 'Agora';
    if (minutos < 60) return `Há ${minutos} min`;
    if (minutos < 1440) return `Há ${Math.floor(minutos / 60)} h`;
    return fmt.data(value);
  }

  function criarNotificacao(id, tipo, titulo, texto, href, icone, data) {
    return { id, tipo, titulo, texto, href, icone, data };
  }

  function preferencias() {
    try {
      return { aacd: true, estoque: true, manutencao: false, ...JSON.parse(localStorage.getItem(preferenceKey) || '{}') };
    } catch {
      return { aacd: true, estoque: true, manutencao: false };
    }
  }

  async function carregar() {
    const [mensagens, pedidos, materiais, saldos, impressoras] = await Promise.all([
      api('/mensagens', { query: { limit: 100 } }).catch(() => ({ data: [] })),
      api('/solicitacoes', { query: { limit: 100, status: 'pendente,em_producao' } }).catch(() => ({ data: [] })),
      api('/materiais', { query: { limit: 100 } }).catch(() => ({ data: [] })),
      api('/estoque/saldo', { query: { limit: 100 } }).catch(() => ({ data: [] })),
      api('/impressoras', { query: { limit: 100 } }).catch(() => ({ data: [] })),
    ]);
    const config = preferencias();
    const novas = [];
    (config.aacd ? mensagens.data || [] : []).filter((mensagem) => mensagem.remetente_id !== usuario?.id).forEach((mensagem) => {
      novas.push(criarNotificacao(
        `mensagem:${mensagem.id}`,
        'message',
        'Nova mensagem',
        String(mensagem.conteudo || '').slice(0, 100),
        'Tela_Mensagens_Parceira.html',
        'bi-chat-dots',
        mensagem.criado_em || mensagem.created_at,
      ));
    });
    (config.aacd ? pedidos.data || [] : []).forEach((pedido) => {
      const emProducao = pedido.status === 'em_producao';
      novas.push(criarNotificacao(
        `pedido:${pedido.id}:${pedido.status}`,
        emProducao ? 'printer' : 'critical',
        emProducao ? 'Produção em andamento' : 'Novo pedido aguardando ação',
        `Pedido ${fmt.idCurto(pedido.id)} ${emProducao ? 'está em produção.' : 'aguarda aceite.'}`,
        'Tela_Pedidos_Parceira.html',
        emProducao ? 'bi-printer' : 'bi-clipboard-check',
        pedido.criado_em || pedido.created_at,
      ));
    });
    const nomesMateriais = new Map((materiais.data || []).map((material) => [material.id, material]));
    (config.estoque ? saldos.data || [] : []).filter((saldo) => {
      const material = nomesMateriais.get(saldo.material_id);
      const minimo = Number(material?.estoque_minimo ?? saldo.estoque_minimo ?? saldo.minimo ?? 0);
      const atual = Number(saldo.saldo_atual ?? saldo.saldo ?? saldo.quantidade ?? 0);
      return minimo > 0 && atual <= minimo;
    }).forEach((saldo) => {
      const material = nomesMateriais.get(saldo.material_id);
      const nome = material?.nome || saldo.nome || saldo.material_nome || 'Material';
      novas.push(criarNotificacao(
        `estoque:${saldo.material_id}`,
        'critical',
        'Estoque abaixo do mínimo',
        `${nome} precisa de reposição.`,
        'Tela_Materiais_Perceira.html',
        'bi-box-seam',
        saldo.atualizado_em || saldo.updated_at,
      ));
    });
    (config.manutencao ? impressoras.data || [] : []).filter((impressora) => (
      impressora.status === 'indisponivel'
    )).forEach((impressora) => {
      novas.push(criarNotificacao(
        `manutencao:${impressora.id}`,
        'critical',
        'Impressora em manutenção',
        `${impressora.nome || 'Uma impressora'} está indisponível.`,
        'Tela_Impressoras_Parceiras.html',
        'bi-tools',
        impressora.atualizado_em || impressora.updated_at,
      ));
    });
    notifications = novas.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
    renderizar();
  }

  function renderizar() {
    notificationList.innerHTML = notifications.length ? notifications.map((item) => `
      <a class="notification-item ${readIds.has(item.id) ? '' : 'unread'}" href="${item.href}" data-notification-id="${escapeHtml(item.id)}">
        <span class="notification-icon ${item.tipo}"><i class="bi ${item.icone}" aria-hidden="true"></i></span>
        <span><strong>${escapeHtml(item.titulo)}</strong><small>${escapeHtml(item.texto)}</small><time>${escapeHtml(idade(item.data))}</time></span>
      </a>`).join('') : '';
    notificationList.querySelectorAll('.notification-item').forEach((item) => {
      item.addEventListener('click', () => {
        readIds.add(item.dataset.notificationId);
        saveReadIds();
        updateCount();
      });
    });
    updateCount();
  }

  function updateCount() {
    const unread = notifications.filter((item) => !readIds.has(item.id)).length;
    notificationBadge.textContent = unread;
    notificationBadge.hidden = false;
    markNotificationsRead.disabled = unread === 0;
    notificationEmpty.classList.toggle('visible', unread === 0);
    notificationList.classList.toggle('is-empty', notifications.length === 0);
  }

  function closeNotifications() {
    notificationPanel.classList.remove('is-open');
    notificationButton.setAttribute('aria-expanded', 'false');
  }

  const alternarPainel = (event) => {
    event.stopPropagation();
    document.querySelectorAll('.profile-dropdown.is-open').forEach((panel) => {
      panel.classList.remove('is-open');
      panel.closest('.profile-menu')?.querySelector('.user-avatar')?.setAttribute('aria-expanded', 'false');
    });
    const aberto = notificationPanel.classList.toggle('is-open');
    notificationButton.setAttribute('aria-expanded', String(aberto));
  };
  notificationButton.removeEventListener('click', alternarPainel);
  notificationButton.addEventListener('click', alternarPainel);
  markNotificationsRead.addEventListener('click', () => {
    notifications.forEach((item) => readIds.add(item.id));
    saveReadIds();
    updateCount();
  });
  document.addEventListener('click', (event) => {
    if (!notificationMenu.contains(event.target)) closeNotifications();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeNotifications();
  });
  window.addEventListener('aacd3d-notificacoes-preferencias', () => carregar().catch(() => {}));

  carregar().catch(() => {
    notificationList.innerHTML = '';
    notifications = [];
    updateCount();
  });
  window.setInterval(() => carregar().catch(() => {}), 30000);
}());
