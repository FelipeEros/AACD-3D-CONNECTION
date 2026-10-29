const filters = {
  state: { value: '' },
  city: { value: '' },
  status: { value: '' },
};
const clearFilters = document.querySelector('#clearFilters');
const cards = document.querySelectorAll('.institution-card');
const noResults = document.querySelector('#noResults');
const materialsLink = [...document.querySelectorAll('.nav-item')].find((item) => item.textContent.trim() === 'Materiais');

materialsLink?.addEventListener('click', (event) => {
  event.preventDefault();
  window.location.href = 'Tela_Materiais.html';
});

function filterInstitutions() {
  let visibleCards = 0;
  cards.forEach((card) => {
    const matches = Object.entries(filters).every(([key, filter]) => !filter.value || card.dataset[key] === filter.value);
    card.hidden = !matches;
    if (matches) visibleCards += 1;
  });
  noResults.classList.toggle('visible', visibleCards === 0);
}

document.querySelectorAll('[data-filter]').forEach((option) => {
  option.addEventListener('click', () => {
    const filterName = option.dataset.filter;
    filters[filterName].value = option.dataset.value;
    document.querySelector(`#${filterName}Filter`).textContent = option.textContent;
    option.closest('.dropdown-menu').querySelectorAll('.dropdown-item').forEach((item) => item.classList.toggle('active', item === option));
    filterInstitutions();
  });
});
clearFilters.addEventListener('click', () => {
  Object.keys(filters).forEach((filterName) => {
    filters[filterName].value = '';
    const button = document.querySelector(`#${filterName}Filter`);
    button.textContent = filterName === 'state' ? 'Estado' : filterName === 'city' ? 'Cidade' : 'Status';
    button.closest('.dropdown').querySelectorAll('.dropdown-item').forEach((item, index) => item.classList.toggle('active', index === 0));
  });
  filterInstitutions();
});

const detailsModal = document.querySelector('#institutionDetailsModal');
const reviewModal = document.querySelector('#requestReviewModal');
const reviewFeedback = document.querySelector('#reviewFeedback');

document.querySelectorAll('.card-button').forEach((button) => {
  button.addEventListener('click', () => {
    const modal = button.dataset.action === 'review' ? reviewModal : detailsModal;
    bootstrap.Modal.getOrCreateInstance(modal).show();
  });
});

document.querySelectorAll('[data-review-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const approved = button.dataset.reviewAction === 'approve';
    reviewFeedback.textContent = approved
      ? 'Solicitação aprovada. A instituição agora pode ser incorporada ao hub.'
      : 'Solicitação recusada. O pedido foi removido da fila de avaliação.';
    reviewFeedback.className = `review-feedback visible ${approved ? 'success' : 'rejected'}`;
    document.querySelectorAll('[data-review-action]').forEach((actionButton) => {
      actionButton.disabled = true;
    });
  });
});

reviewModal.addEventListener('hidden.bs.modal', () => {
  reviewFeedback.textContent = '';
  reviewFeedback.className = 'review-feedback';
  document.querySelectorAll('[data-review-action]').forEach((button) => {
    button.disabled = false;
  });
});
