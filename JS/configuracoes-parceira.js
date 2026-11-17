(function () {
  const { api, errorMessage, session } = window.AACD;
  const feedback = document.querySelector('.settings-feedback');
  const institutionId = session.get()?.usuario?.instituicao_id;
  const fields = {
    nome: document.querySelector('#institutionName'),
    cnpj: document.querySelector('#institutionCnpj'),
    email: document.querySelector('#institutionEmail'),
    telefone: document.querySelector('#institutionPhone'),
    endereco: document.querySelector('#institutionAddress'),
    descricao: document.querySelector('#institutionDescription'),
  };
  const notificationKey = `aacd3d.notificacoes.${institutionId || 'local'}`;
  const descriptionKey = `aacd3d.descricao.${institutionId || 'local'}`;
  const addressKey = `aacd3d.endereco.${institutionId || 'local'}`;

  function onlyDigits(value) {
    return value.replace(/\D/g, '');
  }

  function formatCnpj(value) {
    const digits = onlyDigits(value).slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  function formatPhone(value) {
    const digits = onlyDigits(value).slice(0, 11);
    if (digits.length <= 10) {
      return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    }
    return digits.replace(/^(\d{2})(\d{5})(\d)/, '($1) $2-$3');
  }

  function showFeedback(message, error = false) {
    feedback.textContent = message;
    feedback.className = `settings-feedback visible${error ? ' error' : ''}`;
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
        showFeedback('Preferências de notificações salvas.');
      });
    });
  }

  async function loadInstitution() {
    if (!institutionId) throw new Error('Instituição não identificada na sessão.');
    const institution = await api(`/instituicoes/${institutionId}`);
    Object.entries(fields).forEach(([key, input]) => {
      if (input) input.value = institution[key] || '';
    });
    fields.endereco.value = localStorage.getItem(addressKey) || institution.endereco || '';
    fields.descricao.value = localStorage.getItem(descriptionKey) || institution.descricao || '';
    fields.cnpj.value = formatCnpj(fields.cnpj.value);
    fields.telefone.value = formatPhone(fields.telefone.value);
  }

  function bindMask(input, formatter) {
    if (!input) return;
    const applyMask = () => {
      const formatted = formatter(input.value);
      if (input.value !== formatted) input.value = formatted;
    };
    input.addEventListener('input', applyMask);
    input.addEventListener('change', applyMask);
    input.addEventListener('blur', applyMask);
    applyMask();
  }

  bindMask(fields.cnpj, formatCnpj);
  bindMask(fields.telefone, formatPhone);

  document.querySelector('#settingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.querySelector('[data-save-settings]');
    const requiredFields = [
      ['nome', fields.nome, 'Nome da instituição'],
      ['cnpj', fields.cnpj, 'CNPJ'],
      ['email', fields.email, 'E-mail institucional'],
      ['telefone', fields.telefone, 'Telefone'],
    ];
    const emptyField = requiredFields.find(([, input]) => !input.value.trim());
    if (emptyField) {
      showFeedback(`Preencha o campo ${emptyField[2]} antes de salvar.`, true);
      emptyField[1].focus();
      return;
    }
    button.disabled = true;
    try {
      const updated = await api(`/instituicoes/${institutionId}`, {
        method: 'PATCH',
        body: {
          nome: fields.nome.value,
          cnpj: onlyDigits(fields.cnpj.value),
          email: fields.email.value,
          telefone: onlyDigits(fields.telefone.value),
        },
      });
      fields.nome.value = updated.nome || fields.nome.value;
      fields.email.value = updated.email || fields.email.value;
      fields.telefone.value = updated.telefone || fields.telefone.value;
      localStorage.setItem(addressKey, fields.endereco.value);
      localStorage.setItem(descriptionKey, fields.descricao.value);
      showFeedback('Alterações da instituição salvas com sucesso.');
    } catch (error) {
      showFeedback(errorMessage(error), true);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('#changePasswordButton').addEventListener('click', async () => {
    const current = document.querySelector('#currentPassword');
    const next = document.querySelector('#newPassword');
    const confirm = document.querySelector('#confirmPassword');
    if (!current.value || !next.value || !confirm.value) {
      showFeedback('Preencha os três campos de senha.', true);
      return;
    }
    if (next.value !== confirm.value) {
      showFeedback('A confirmação da nova senha não confere.', true);
      return;
    }
    const button = document.querySelector('#changePasswordButton');
    button.disabled = true;
    try {
      await api('/auth/senha', {
        method: 'PUT',
        body: { senha_atual: current.value, nova_senha: next.value },
      });
      current.value = '';
      next.value = '';
      confirm.value = '';
      showFeedback('Senha atualizada com sucesso.');
    } catch (error) {
      showFeedback(errorMessage(error), true);
    } finally {
      button.disabled = false;
    }
  });

  loadNotifications();
  loadInstitution().catch((error) => showFeedback(errorMessage(error), true));
}());
