// Tela_Cadastro: envia a solicitação de parceria para /api/cadastro.
const cadastroForm = document.querySelector('.cadastro-form');
const cadastroButton = cadastroForm.querySelector('.primary-submit');
const cadastroFeedback = document.createElement('p');
cadastroFeedback.className = 'form-feedback';
cadastroFeedback.setAttribute('role', 'status');
cadastroButton.after(cadastroFeedback);

const campo = (id) => document.getElementById(id);

document.querySelectorAll('[data-password-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = campo(button.dataset.passwordToggle);
    const mostrar = input.type === 'password';
    input.type = mostrar ? 'text' : 'password';
    button.classList.toggle('is-visible', mostrar);
    button.querySelector('i')?.classList.toggle('bi-eye', !mostrar);
    button.querySelector('i')?.classList.toggle('bi-eye-slash', mostrar);

    const rotulo = input.id === 'senha' ? 'senha' : 'confirmação da senha';
    button.setAttribute('aria-label', mostrar ? `Ocultar ${rotulo}` : `Mostrar ${rotulo}`);
    button.setAttribute('title', mostrar ? `Ocultar ${rotulo}` : `Mostrar ${rotulo}`);
  });
});

cadastroForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const dados = {
    nome: campo('nomeInstituicao').value.trim(),
    cnpj: campo('cnpj').value.trim(),
    telefone: campo('telefone').value.trim(),
    email: campo('email').value.trim(),
    senha: campo('senha').value,
    endereco: campo('endereco').value.trim(),
    responsavel: campo('responsavel').value.trim(),
  };

  const faltando = Object.entries(dados).filter(([, v]) => !v).map(([k]) => k);
  if (!campo('responsavel').value.trim()) faltando.push('responsavel');
  if (faltando.length) {
    AACD.feedback(cadastroFeedback, 'Preencha todos os campos obrigatórios (*).', 'erro');
    campo(faltando[0] === 'nome' ? 'nomeInstituicao' : faltando[0]).focus();
    return;
  }
  if (dados.cnpj.replace(/\D/g, '').length !== 14) {
    AACD.feedback(cadastroFeedback, 'O CNPJ deve ter 14 dígitos.', 'erro');
    campo('cnpj').focus();
    return;
  }
  if (dados.senha.length < 8) {
    AACD.feedback(cadastroFeedback, 'A senha deve ter pelo menos 8 caracteres.', 'erro');
    campo('senha').focus();
    return;
  }
  if (dados.senha !== campo('confirmarSenha').value) {
    AACD.feedback(cadastroFeedback, 'As senhas informadas não coincidem.', 'erro');
    campo('confirmarSenha').focus();
    return;
  }

  cadastroButton.disabled = true;
  AACD.feedback(cadastroFeedback, 'Enviando solicitação...', 'info');
  try {
    const { message } = await AACD.api('/cadastro', { method: 'POST', body: dados });
    cadastroForm.reset();
    cadastroButton.disabled = false;
    AACD.feedback(cadastroFeedback, message, 'sucesso');
  } catch (err) {
    AACD.feedback(cadastroFeedback, AACD.errorMessage(err), 'erro');
    cadastroButton.disabled = false;
  }
});
