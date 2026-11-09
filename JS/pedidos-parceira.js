const form = document.querySelector('#partnerOrderForm');
const fileInput = document.querySelector('#orderFile');
const fileName = document.querySelector('#fileName');
const feedback = document.querySelector('#formFeedback');

document.querySelectorAll('.partner-dropdown').forEach((dropdown) => {
  const button = dropdown.querySelector('.partner-dropdown-button');
  const value = dropdown.querySelector('.dropdown-value');
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    document.querySelectorAll('.partner-dropdown.is-open').forEach((item) => item !== dropdown && item.classList.remove('is-open'));
    dropdown.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(dropdown.classList.contains('is-open')));
  });
  dropdown.querySelectorAll('[data-value]').forEach((option) => {
    option.addEventListener('click', () => {
      button.textContent = option.textContent;
      value.value = option.dataset.value;
      dropdown.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
    });
  });
});
document.addEventListener('click', () => document.querySelectorAll('.partner-dropdown.is-open').forEach((dropdown) => dropdown.classList.remove('is-open')));

fileInput.addEventListener('change', () => {
  fileName.textContent = fileInput.files[0]?.name || 'Selecione um arquivo STL, OBJ ou 3MF';
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  feedback.textContent = 'Pedido enviado para análise da AACD.';
  feedback.classList.add('visible');
  form.querySelector('.submit-button').disabled = true;
});
