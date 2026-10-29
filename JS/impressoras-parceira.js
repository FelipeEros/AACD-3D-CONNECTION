const printerRegistrationModal = document.querySelector('#printerRegistrationModal');
const printerRegistrationButton = document.querySelector('#openPrinterRegistration');
const printerRegistrationForm = document.querySelector('#printerRegistrationForm');
const printerFormFeedback = document.querySelector('#printerFormFeedback');

function closePrinterRegistration() {
  printerRegistrationModal.classList.remove('is-open');
  printerRegistrationModal.setAttribute('aria-hidden', 'true');
  printerRegistrationForm.reset();
  printerFormFeedback.textContent = '';
  printerFormFeedback.className = 'printer-form-feedback';
}

printerRegistrationButton.addEventListener('click', () => {
  printerRegistrationModal.classList.add('is-open');
  printerRegistrationModal.setAttribute('aria-hidden', 'false');
  printerRegistrationForm.querySelector('input')?.focus();
});

printerRegistrationModal.querySelectorAll('[data-printer-modal-close]').forEach((closeButton) => {
  closeButton.addEventListener('click', closePrinterRegistration);
});

printerRegistrationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!printerRegistrationForm.checkValidity()) {
    printerRegistrationForm.reportValidity();
    return;
  }
  printerFormFeedback.textContent = 'Dados preenchidos. A impressora está pronta para ser cadastrada.';
  printerFormFeedback.className = 'printer-form-feedback visible success';
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && printerRegistrationModal.classList.contains('is-open')) {
    closePrinterRegistration();
  }
});
