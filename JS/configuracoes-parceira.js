const settingsFeedback = document.querySelector('.settings-feedback');

document.querySelector('[data-save-settings]')?.addEventListener('click', () => {
  settingsFeedback.textContent = 'Alterações da instituição salvas com sucesso.';
  settingsFeedback.classList.add('visible');
});

document.querySelector('.secondary-button')?.addEventListener('click', () => {
  settingsFeedback.textContent = 'Senha atualizada com sucesso.';
  settingsFeedback.classList.add('visible');
});
