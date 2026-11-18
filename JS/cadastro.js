// Tela_Cadastro: envia a solicitação de parceria para /api/cadastro.
const cadastroForm = document.querySelector('.cadastro-form');
const cadastroButton = cadastroForm.querySelector('.primary-submit');
const cadastroFeedback = document.createElement('p');
cadastroFeedback.className = 'form-feedback';
cadastroFeedback.setAttribute('role', 'status');
cadastroButton.after(cadastroFeedback);

const campo = (id) => document.getElementById(id);

cadastroForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const dados = {
    nome: campo('nomeInstituicao').value.trim(),
    cnpj: campo('cnpj').value.trim(),
    telefone: campo('telefone').value.trim(),
    email: campo('email').value.trim(),
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
