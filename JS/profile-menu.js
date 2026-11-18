function createProfileMenu(button) {
  if (button.closest('.profile-menu')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'profile-menu';
  button.parentNode.insertBefore(wrapper, button);
  wrapper.appendChild(button);

  const menu = document.createElement('div');
  menu.className = 'profile-dropdown';
  menu.id = 'profileMenu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `
    <div class="profile-summary">
      <span class="profile-summary-avatar">JS</span>
      <div>
        <strong>João da Silva</strong>
        <small>Administrador AACD</small>
        <small>administrador@aacd.org</small>
      </div>
    </div>
    <div class="profile-menu-links">
      <button class="profile-menu-action" type="button" role="menuitem" data-profile-action="open"><i class="bi bi-person" aria-hidden="true"></i>Meu perfil</button>
      <a href="mailto:suporte@aacd.org" role="menuitem"><i class="bi bi-question-circle" aria-hidden="true"></i>Ajuda e suporte</a>
    </div>
    <a class="profile-logout" href="Tela_Login.html" role="menuitem"><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Sair da conta</a>
  `;
  wrapper.appendChild(menu);
  button.id = 'profileMenuButton';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'profileMenu');
}

function createProfileModal() {
  if (document.querySelector('#profileDetailsModal')) return;

  const modal = document.createElement('div');
  modal.className = 'profile-modal';
  modal.id = 'profileDetailsModal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="profile-modal-backdrop" data-profile-action="close"></div>
    <section class="profile-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="profileDetailsTitle">
      <header class="profile-modal-header">
        <div>
          <span class="profile-modal-eyebrow">Minha conta</span>
          <h2 id="profileDetailsTitle">Meu perfil</h2>
        </div>
        <button class="profile-modal-close" type="button" aria-label="Fechar" data-profile-action="close">&times;</button>
      </header>
      <div class="profile-modal-body">
        <div class="profile-modal-identity">
          <span class="profile-modal-avatar">JS</span>
          <div><strong>João da Silva</strong><span>Administrador AACD</span></div>
        </div>
        <div class="profile-fields">
          <label><span>Nome completo</span><input type="text" value="João da Silva" /></label>
          <label><span>E-mail</span><input type="email" value="administrador@aacd.org" /></label>
          <label><span>Telefone</span><input type="tel" value="(11) 99999-9999" /></label>
          <label><span>Cargo</span><input type="text" value="Administrador AACD" /></label>
        </div>
      </div>
      <footer class="profile-modal-footer">
        <button class="profile-modal-secondary" type="button" data-profile-action="close">Cancelar</button>
        <button class="profile-modal-primary" type="button" data-profile-action="save">Salvar alterações</button>
      </footer>
    </section>
  `;
  document.body.appendChild(modal);
}

function createNotificationMenu(button) {
  const telaParceira = document.querySelector(
    '.partner-app, .partner-orders-app, .partner-materials-app, .partner-messages-app, .partner-settings-app',
  );
  if (telaParceira || window.AACD?.usuario?.perfil === 'instituicao') return;

  let wrapper = button.closest('.notification-menu');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'notification-menu';
    button.parentNode.insertBefore(wrapper, button);
    wrapper.appendChild(button);
  }
  button.classList.add('notification-button');
  button.id = 'notificationButton';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'notificationPanel');

  let panel = wrapper.querySelector('#notificationPanel');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'notification-panel';
    panel.id = 'notificationPanel';
    panel.setAttribute('aria-labelledby', 'notificationTitle');
    panel.innerHTML = `
      <header class="notification-header"><h2 id="notificationTitle">Notificações</h2><button type="button" id="markNotificationsRead">Marcar como lidas</button></header>
      <div class="notification-list"></div>
      <p class="notification-empty">Você está em dia!</p>`;
    wrapper.appendChild(panel);
  }

  const list = panel.querySelector('.notification-list');
  const empty = panel.querySelector('.notification-empty');
  const markRead = panel.querySelector('#markNotificationsRead') || panel.querySelector('.notification-mark-read');
  let badge = button.querySelector('.notification-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'notification-badge';
    button.appendChild(badge);
  }

  const readKey = `aacd3d.notificacoes.lidas.${window.AACD?.usuario?.id || 'aacd'}`;
  const preferenceKey = 'aacd3d.notificacoes.aacd';
  let readIds = new Set();
  let notifications = [];
  try { readIds = new Set(JSON.parse(localStorage.getItem(readKey) || '[]')); } catch { /* usa conjunto vazio */ }

  function preferences() {
    try {
      return { aacd: true, estoque: true, manutencao: false, ...JSON.parse(localStorage.getItem(preferenceKey) || '{}') };
    } catch {
      return { aacd: true, estoque: true, manutencao: false };
    }
  }

  function age(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `Há ${minutes} min`;
    if (minutes < 1440) return `Há ${Math.floor(minutes / 60)} h`;
    return date.toLocaleDateString('pt-BR');
  }

  function updateCount() {
    const unread = notifications.filter((item) => !readIds.has(item.id)).length;
    badge.textContent = unread;
    badge.hidden = unread === 0;
    if (markRead) markRead.disabled = unread === 0;
    list.classList.toggle('is-empty', notifications.length === 0);
    empty.classList.toggle('visible', unread === 0);
  }

  function render() {
    list.innerHTML = notifications.length
      ? notifications.map((item) => `
        <a class="notification-item ${readIds.has(item.id) ? '' : 'unread'}" href="${item.href}" data-notification-id="${window.AACD.escapeHtml(item.id)}">
          <span class="notification-icon ${item.type}"><i class="bi ${item.icon}" aria-hidden="true"></i></span>
          <span><strong>${window.AACD.escapeHtml(item.title)}</strong><small>${window.AACD.escapeHtml(item.text)}</small><time>${window.AACD.escapeHtml(age(item.date))}</time></span>
        </a>`).join('')
      : '';
    list.querySelectorAll('.notification-item').forEach((item) => {
      item.addEventListener('click', () => {
        readIds.add(item.dataset.notificationId);
        localStorage.setItem(readKey, JSON.stringify([...readIds].slice(-300)));
        updateCount();
      });
    });
    updateCount();
  }

  async function loadNotifications() {
    if (!window.AACD?.api) return;
    const config = preferences();
    const [institutions, solicitacoes, alerts, printers] = await Promise.all([
      window.AACD.api('/instituicoes', { query: { limit: 100 } }).catch(() => ({ data: [] })),
      config.aacd ? window.AACD.api('/solicitacoes', { query: { limit: 100 } }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      config.estoque ? window.AACD.api('/estoque/alertas', { query: { limit: 100 } }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      config.manutencao ? window.AACD.api('/impressoras', { query: { limit: 100 } }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    ]);
    const novas = [];
    (institutions.data || []).filter((item) => String(item.status).toLowerCase() === 'pendente').forEach((item) => {
      novas.push({
        id: `instituicao:${item.id}:pendente`,
        type: 'critical',
        title: 'Nova solicitação de instituição',
        text: `${item.nome || 'Instituição'} aguarda avaliação.`,
        href: 'Tela_Instituicoes.html',
        icon: 'bi-building',
        date: item.criado_em || item.created_at,
      });
    });
    (solicitacoes.data || []).filter((item) => ['pendente', 'aceita', 'em_producao'].includes(item.status)).forEach((item) => {
      novas.push({
        id: `pedido:${item.id}:${item.status}`,
        type: item.status === 'em_producao' ? 'printer' : 'critical',
        title: item.status === 'em_producao' ? 'Pedido em produção' : 'Pedido pendente',
        text: `Solicitação ${window.AACD.fmt.idCurto(item.id)} precisa de acompanhamento.`,
        href: 'Tela_Pedidos.html',
        icon: 'bi-clipboard-check',
        date: item.criado_em || item.created_at,
      });
    });
    (alerts.data || []).filter((item) => {
      const situation = String(item.situacao || '').toLowerCase();
      return situation === 'baixo' || situation === 'esgotado' || situation.includes('crit');
    }).forEach((item) => {
      const situation = String(item.situacao || '').toLowerCase();
      const esgotado = situation === 'esgotado' || Number(item.saldo_atual || 0) <= 0;
      novas.push({
        id: `estoque:${item.instituicao_id || 'rede'}:${item.material_id}:${situation}`,
        type: 'critical',
        title: esgotado ? 'Estoque esgotado' : 'Estoque baixo',
        text: `${item.material || 'Material'}: ${Number(item.saldo_atual || 0)} ${item.unidade || 'g'} disponíveis.`,
        href: 'Tela_Materiais.html',
        icon: 'bi-box-seam',
        date: null,
      });
    });
    (printers.data || []).filter((item) => item.status === 'indisponivel').forEach((item) => {
      novas.push({
        id: `impressora:${item.id}:indisponivel`,
        type: 'critical',
        title: 'Impressora indisponível',
        text: `${item.nome || 'Impressora'} está fora de operação.`,
        href: 'Tela_Impressoras.html',
        icon: 'bi-printer',
        date: item.atualizado_em || item.updated_at,
      });
    });
    notifications = novas.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    render();
  }

  const close = () => {
    panel.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
  };
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    document.querySelectorAll('.profile-dropdown.is-open').forEach((profilePanel) => {
      profilePanel.classList.remove('is-open');
      profilePanel.closest('.profile-menu')?.querySelector('.user-avatar')?.setAttribute('aria-expanded', 'false');
    });
    const isOpen = panel.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(isOpen));
  });
  if (markRead) {
    markRead.addEventListener('click', () => {
      notifications.forEach((item) => readIds.add(item.id));
      localStorage.setItem(readKey, JSON.stringify([...readIds].slice(-300)));
      render();
    });
  }
  window.addEventListener('aacd3d-notificacoes-preferencias', () => {
    loadNotifications().catch(() => {});
  });
  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  list.innerHTML = '';
  updateCount();
  loadNotifications().catch(() => {
    notifications = [];
    render();
  });
  window.setInterval(() => loadNotifications().catch(() => {}), 30000);
}

const profileButtons = document.querySelectorAll('.user-avatar');
profileButtons.forEach(createProfileMenu);
createProfileModal();
document.querySelectorAll('[aria-label="Notificações"]').forEach(createNotificationMenu);

document.querySelectorAll('.profile-menu').forEach((profileMenu) => {
  const profileMenuButton = profileMenu.querySelector('.user-avatar');
  const menu = profileMenu.querySelector('.profile-dropdown');
  const logout = profileMenu.querySelector('.profile-logout');
  const legacyProfileLink = profileMenu.querySelector('.profile-menu-links a[href="Tela_Configuracoes.html"]');
  if (legacyProfileLink) {
    const profileAction = document.createElement('button');
    profileAction.className = 'profile-menu-action';
    profileAction.type = 'button';
    profileAction.setAttribute('role', 'menuitem');
    profileAction.dataset.profileAction = 'open';
    profileAction.innerHTML = legacyProfileLink.innerHTML;
    legacyProfileLink.replaceWith(profileAction);
  }
  const profileAction = profileMenu.querySelector('[data-profile-action="open"]');
  if (!profileMenuButton || !menu) return;

  profileMenuButton.addEventListener('click', (event) => {
    event.stopPropagation();
    document.querySelectorAll('.notification-panel.is-open').forEach((notificationPanel) => {
      notificationPanel.classList.remove('is-open');
      notificationPanel.closest('.notification-menu')?.querySelector('.notification-button')?.setAttribute('aria-expanded', 'false');
    });
    const isOpen = menu.classList.toggle('is-open');
    profileMenuButton.setAttribute('aria-expanded', String(isOpen));
  });

  const closeMenu = () => {
    menu.classList.remove('is-open');
    profileMenuButton.setAttribute('aria-expanded', 'false');
  };

  document.addEventListener('click', (event) => {
    if (!profileMenu.contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  if (logout) {
    logout.addEventListener('click', (event) => {
      event.preventDefault();
      if (!window.confirm('Deseja realmente sair da sua conta?')) return;
      if (window.AACD) window.AACD.logout();
      else window.location.href = 'Tela_Login.html';
    });
  }

  profileAction?.addEventListener('click', () => {
    closeMenu();
    const profileModal = document.querySelector('#profileDetailsModal');
    profileModal.classList.add('is-open');
    profileModal.setAttribute('aria-hidden', 'false');
    profileModal.querySelector('input')?.focus();
  });
});

const profileModal = document.querySelector('#profileDetailsModal');
profileModal?.querySelectorAll('[data-profile-action="close"]').forEach((element) => {
  element.addEventListener('click', () => {
    profileModal.classList.remove('is-open');
    profileModal.setAttribute('aria-hidden', 'true');
  });
});

// ---- Dados reais do usuário logado ---------------------------------------
// Os dados do perfil vêm de /api/auth/me. A edição de nome/cargo não tem rota
// no backend ainda, por isso os campos ficam somente leitura.
async function preencherPerfil() {
  if (!window.AACD?.usuario) return;
  let perfil = { ...window.AACD.usuario };
  try { perfil = { ...perfil, ...(await window.AACD.api('/auth/me')) }; } catch { /* usa a sessão */ }

  const nome = perfil.nome || perfil.nome_completo || perfil.email;
  const cargo = perfil.perfil === 'aacd' ? 'Equipe AACD' : 'Instituição parceira';
  const iniciais = String(nome).replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
    .slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

  document.querySelectorAll('.profile-summary strong, .profile-modal-identity strong').forEach((el) => { el.textContent = nome; });
  document.querySelectorAll('.profile-summary small:nth-of-type(1), .profile-modal-identity span').forEach((el) => { el.textContent = cargo; });
  document.querySelectorAll('.profile-summary small:nth-of-type(2)').forEach((el) => { el.textContent = perfil.email; });
  document.querySelectorAll('.profile-summary-avatar, .profile-modal-avatar').forEach((el) => { el.textContent = iniciais; });
  document.querySelectorAll('button.user-avatar').forEach((el) => {
    if (!el.querySelector('i')) el.textContent = iniciais;
  });

  const campos = profileModal?.querySelectorAll('.profile-fields input') || [];
  const valores = [nome, perfil.email, perfil.telefone || '', cargo];
  campos.forEach((input, i) => { input.value = valores[i] ?? ''; input.readOnly = true; });
  const save = profileModal?.querySelector('[data-profile-action="save"]');
  if (save) save.hidden = true;
}
preencherPerfil();

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && profileModal?.classList.contains('is-open')) {
    profileModal.classList.remove('is-open');
    profileModal.setAttribute('aria-hidden', 'true');
  }
});
