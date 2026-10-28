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
      <a href="Tela_Configuracoes.html" role="menuitem"><i class="bi bi-person" aria-hidden="true"></i>Meu perfil</a>
      <a href="mailto:suporte@aacd.org" role="menuitem"><i class="bi bi-question-circle" aria-hidden="true"></i>Ajuda e suporte</a>
    </div>
    <a class="profile-logout" href="Tela_Login.html" role="menuitem"><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Sair da conta</a>
  `;
  wrapper.appendChild(menu);
  button.id = 'profileMenuButton';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'profileMenu');
}

const profileButtons = document.querySelectorAll('.user-avatar');
profileButtons.forEach(createProfileMenu);

document.querySelectorAll('.profile-menu').forEach((profileMenu) => {
  const profileMenuButton = profileMenu.querySelector('.user-avatar');
  const menu = profileMenu.querySelector('.profile-dropdown');
  const logout = profileMenu.querySelector('.profile-logout');
  if (!profileMenuButton || !menu) return;

  profileMenuButton.addEventListener('click', (event) => {
    event.stopPropagation();
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
});
