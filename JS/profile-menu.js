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
  if (button.closest('.notification-menu')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'notification-menu';
  button.parentNode.insertBefore(wrapper, button);
  wrapper.appendChild(button);
  button.classList.add('notification-button');
  button.id = 'notificationButton';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'notificationPanel');

  const panel = document.createElement('section');
  panel.className = 'notification-panel';
  panel.id = 'notificationPanel';
  panel.setAttribute('aria-labelledby', 'notificationTitle');
  panel.innerHTML = `
    <header class="notification-header"><h2 id="notificationTitle">Notificações</h2><button type="button" class="notification-mark-read">Marcar como lidas</button></header>
    <div class="notification-list">
      <a class="notification-item unread" href="Tela_Mensagens.html"><span class="notification-icon message"><i class="bi bi-chat-dots" aria-hidden="true"></i></span><span><strong>Nova mensagem</strong><small>Você recebeu uma nova atualização da rede AACD 3D Connect.</small><time>Há 15 minutos</time></span></a>
      <a class="notification-item unread" href="Tela_Impressoras.html"><span class="notification-icon printer"><i class="bi bi-printer" aria-hidden="true"></i></span><span><strong>Impressora disponível</strong><small>Uma impressora parceira está disponível para uma nova produção.</small><time>Há 2 horas</time></span></a>
      <a class="notification-item unread" href="Tela_Instituicoes.html"><span class="notification-icon critical"><i class="bi bi-building" aria-hidden="true"></i></span><span><strong>Nova solicitação</strong><small>Uma instituição parceira aguarda avaliação.</small><time>Ontem</time></span></a>
    </div>
    <p class="notification-empty">Você está em dia!</p>
  `;
  wrapper.appendChild(panel);

  const items = [...panel.querySelectorAll('.notification-item')];
  const badge = document.createElement('span');
  badge.className = 'notification-badge';
  badge.textContent = items.length;
  button.appendChild(badge);
  const markRead = panel.querySelector('.notification-mark-read');
  const empty = panel.querySelector('.notification-empty');
  const updateCount = () => {
    const count = items.filter((item) => item.classList.contains('unread')).length;
    badge.textContent = count;
    badge.hidden = count === 0;
    markRead.disabled = count === 0;
    panel.querySelector('.notification-list').classList.toggle('is-empty', count === 0);
    empty.classList.toggle('visible', count === 0);
  };
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
  items.forEach((item) => item.addEventListener('click', () => {
    item.classList.remove('unread');
    updateCount();
  }));
  markRead.addEventListener('click', () => {
    items.forEach((item) => item.classList.remove('unread'));
    updateCount();
  });
  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  updateCount();
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
      if (!window.confirm('Deseja realmente sair da sua conta?')) event.preventDefault();
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

profileModal?.querySelector('[data-profile-action="save"]')?.addEventListener('click', () => {
  const saveButton = profileModal.querySelector('[data-profile-action="save"]');
  saveButton.textContent = 'Alterações salvas';
  saveButton.disabled = true;
  window.setTimeout(() => {
    saveButton.textContent = 'Salvar alterações';
    saveButton.disabled = false;
  }, 1600);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && profileModal?.classList.contains('is-open')) {
    profileModal.classList.remove('is-open');
    profileModal.setAttribute('aria-hidden', 'true');
  }
});
