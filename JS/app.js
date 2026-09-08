const loginForm = document.querySelector('#loginForm');
const passwordInput = document.querySelector('#password');
const emailInput = document.querySelector('#email');
const formFeedback = document.querySelector('#formFeedback');

function showFeedback(message, color) {
  formFeedback.textContent = message;
  formFeedback.style.color = color;
}

document.querySelector('#togglePassword').addEventListener('click', (event) => {
  const isVisible = passwordInput.type === 'text';
  passwordInput.type = isVisible ? 'password' : 'text';
  event.currentTarget.classList.toggle('password-hidden', isVisible);
  event.currentTarget.setAttribute('aria-label', isVisible ? 'Mostrar senha' : 'Ocultar senha');
});

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const validEmail = emailInput.value.trim().includes('@');
  const validPassword = passwordInput.value.trim().length >= 4;
  if (!validEmail || !validPassword) {
    showFeedback('Informe um e-mail válido e uma senha com pelo menos 4 caracteres.', '#c92732');
    (validEmail ? passwordInput : emailInput).focus();
    return;
  }
  showFeedback('Acessando seu workspace...', '#238b72');
  window.setTimeout(() => { window.location.href = 'dashboard.html'; }, 450);
});

document.querySelector('#forgotPassword').addEventListener('click', () => showFeedback('Um link de recuperação seria enviado para seu e-mail corporativo.', '#c97842'));
document.querySelector('#registerButton').addEventListener('click', () => showFeedback('Cadastro institucional em breve. Fale com a equipe AACD para começar.', '#247993'));
