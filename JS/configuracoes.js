(function () {
  const { api, session, errorMessage } = window.AACD;
  if (!window.AACD.usuario) return;

  const profileKey = 'aacd3d.perfil-administrativo';
  const notificationKey = 'aacd3d.notificacoes.aacd';
  const fields = {
    name: document.querySelector('#institution-name'),
    department: document.querySelector('#institution-department'),
    email: document.querySelector('#contact-email'),
    description: document.querySelector('#institution-description'),
  };
  const settingsFeedback = document.querySelector('#settingsFeedback');
  const passwordFeedback = document.querySelector('#passwordFeedback');

  function showFeedback(element, message, error = false) {
    element.textContent = message;
    element.className = `settings-feedback visible${error ? ' error' : ''}`;
  }

  function loadProfile() {
    const saved = JSON.parse(localStorage.getItem(profileKey) || '{}');
    const loggedUser = session.get()?.usuario;
    fields.name.value = saved.name || 'AACD Hospital Central';
    fields.department.value = saved.department || 'Laboratório de Bioengenharia 3D';
    fields.email.value = saved.email || loggedUser?.email || '';
    fields.description.value = saved.description || 'Centro de excelência em prototipagem rápida e manufatura aditiva para órteses e próteses personalizadas.';
  }

  function loadNotifications() {
    const saved = JSON.parse(localStorage.getItem(notificationKey) || '{}');
    document.querySelectorAll('[data-notification]').forEach((input) => {
      if (typeof saved[input.dataset.notification] === 'boolean') {
        input.checked = saved[input.dataset.notification];
      }
      input.addEventListener('change', () => {
        const current = JSON.parse(localStorage.getItem(notificationKey) || '{}');
        current[input.dataset.notification] = input.checked;
        localStorage.setItem(notificationKey, JSON.stringify(current));
        window.dispatchEvent(new CustomEvent('aacd3d-notificacoes-preferencias'));
        showFeedback(settingsFeedback, 'Preferência de notificações salva.');
      });
    });
  }

  document.querySelector('#settingsForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const button = document.querySelector('#saveSettings');
    if (!fields.name.value.trim() || !fields.department.value.trim() || !fields.email.value.trim()) {
      showFeedback(settingsFeedback, 'Preencha nome, setor e e-mail antes de salvar.', true);
      return;
    }
    button.disabled = true;
    try {
      localStorage.setItem(profileKey, JSON.stringify({
        name: fields.name.value.trim(),
        department: fields.department.value.trim(),
        email: fields.email.value.trim(),
        description: fields.description.value.trim(),
      }));
      showFeedback(settingsFeedback, 'Alterações salvas com sucesso.');
    } catch (error) {
      showFeedback(settingsFeedback, errorMessage(error), true);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('#changePassword').addEventListener('click', async () => {
    const current = document.querySelector('#current-password');
    const next = document.querySelector('#new-password');
    const confirm = document.querySelector('#confirm-password');
    const button = document.querySelector('#changePassword');

    if (!current.value || !next.value || !confirm.value) {
      showFeedback(passwordFeedback, 'Preencha todos os campos de senha.', true);
      return;
    }
    if (next.value.length < 8) {
      showFeedback(passwordFeedback, 'A nova senha deve ter pelo menos 8 caracteres.', true);
      return;
    }
    if (next.value !== confirm.value) {
      showFeedback(passwordFeedback, 'A confirmação da nova senha não confere.', true);
      return;
    }

    button.disabled = true;
    try {
      await api('/auth/senha', {
        method: 'PUT',
        body: { senha_atual: current.value, nova_senha: next.value },
      });
      current.value = '';
      next.value = '';
      confirm.value = '';
      showFeedback(passwordFeedback, 'Senha atualizada com sucesso.');
    } catch (error) {
      showFeedback(passwordFeedback, errorMessage(error), true);
    } finally {
      button.disabled = false;
    }
  });

  loadProfile();
  loadNotifications();
}());
