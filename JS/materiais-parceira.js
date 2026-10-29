const materialRegistrationModal = document.querySelector('#materialRegistrationModal');
const materialRegistrationButton = document.querySelector('#openMaterialRegistration');
const materialRegistrationForm = document.querySelector('#materialRegistrationForm');
const materialFormFeedback = document.querySelector('#materialFormFeedback');

function closeMaterialRegistration() {
  materialRegistrationModal.classList.remove('is-open');
  materialRegistrationModal.setAttribute('aria-hidden', 'true');
  materialRegistrationForm.reset();
  materialFormFeedback.textContent = '';
  materialFormFeedback.className = 'material-form-feedback';
}

materialRegistrationButton.addEventListener('click', () => {
  materialRegistrationModal.classList.add('is-open');
  materialRegistrationModal.setAttribute('aria-hidden', 'false');
  materialRegistrationForm.querySelector('input')?.focus();
});

materialRegistrationModal.querySelectorAll('[data-material-modal-close]').forEach((closeButton) => {
  closeButton.addEventListener('click', closeMaterialRegistration);
});

materialRegistrationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!materialRegistrationForm.checkValidity()) {
    materialRegistrationForm.reportValidity();
    return;
  }
  materialFormFeedback.textContent = 'Dados preenchidos. O material está pronto para ser cadastrado.';
  materialFormFeedback.className = 'material-form-feedback visible success';
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && materialRegistrationModal.classList.contains('is-open')) {
    closeMaterialRegistration();
  }
});
