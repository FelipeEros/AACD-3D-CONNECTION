const loginForm = document.querySelector('#loginForm');
const passwordInput = document.querySelector('#password');
const emailInput = document.querySelector('#email');
const formFeedback = document.querySelector('#formFeedback');
const submitButton = loginForm.querySelector('button[type="submit"]');

function showFeedback(message, color) {
  formFeedback.textContent = message;
  formFeedback.style.color = color;
}

// Já logado? Vai direto para o dashboard do perfil.
const sessaoAtual = AACD.session.get();
if (sessaoAtual?.usuario) {
  window.location.href = AACD.DASHBOARD[sessaoAtual.usuario.perfil] || 'Tela_Dashboard.html';
}

document.querySelector('#togglePassword').addEventListener('click', (event) => {
  const isVisible = passwordInput.type === 'text';
  passwordInput.type = isVisible ? 'password' : 'text';
  event.currentTarget.classList.toggle('password-hidden', isVisible);
  event.currentTarget.setAttribute('aria-label', isVisible ? 'Mostrar senha' : 'Ocultar senha');
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim();
  const senha = passwordInput.value;
  if (!email.includes('@') || !senha) {
    showFeedback('Informe seu e-mail e sua senha.', '#c92732');
    (email.includes('@') ? passwordInput : emailInput).focus();
    return;
  }

  showFeedback('Acessando seu workspace...', '#238b72');
  submitButton.disabled = true;
  try {
    const sessao = await AACD.api('/auth/login', { method: 'POST', body: { email, senha }, retry: false });
    AACD.session.set(sessao);
    window.location.href = AACD.DASHBOARD[sessao.usuario.perfil] || 'Tela_Dashboard.html';
  } catch (err) {
    showFeedback(AACD.errorMessage(err), '#c92732');
    submitButton.disabled = false;
  }
});

document.querySelector('#forgotPassword').addEventListener('click', async () => {
  const email = emailInput.value.trim();
  if (!email.includes('@')) {
    showFeedback('Digite seu e-mail acima e clique novamente em "Esqueci minha senha".', '#c97842');
    emailInput.focus();
    return;
  }
  try {
    const { message } = await AACD.api('/auth/recuperar-senha', { method: 'POST', body: { email }, retry: false });
    showFeedback(message, '#247993');
  } catch (err) {
    showFeedback(AACD.errorMessage(err), '#c92732');
  }
});
