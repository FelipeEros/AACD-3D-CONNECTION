const stateFilter = document.querySelector('#stateFilter');
const cityFilter = document.querySelector('#cityFilter');
const statusFilter = document.querySelector('#statusFilter');
const clearFilters = document.querySelector('#clearFilters');
const cards = document.querySelectorAll('.institution-card');
const noResults = document.querySelector('#noResults');

function filterInstitutions() {
  const filters = { state: stateFilter.value, city: cityFilter.value, status: statusFilter.value };
  let visibleCards = 0;
  cards.forEach((card) => {
    const matches = Object.entries(filters).every(([key, value]) => !value || card.dataset[key] === value);
    card.hidden = !matches;
    if (matches) visibleCards += 1;
  });
  noResults.classList.toggle('visible', visibleCards === 0);
}

[stateFilter, cityFilter, statusFilter].forEach((filter) => filter.addEventListener('change', filterInstitutions));
clearFilters.addEventListener('click', () => {
  [stateFilter, cityFilter, statusFilter].forEach((filter) => { filter.value = ''; });
  filterInstitutions();
});

document.querySelectorAll('.card-button').forEach((button) => {
  button.addEventListener('click', () => {
    const message = button.dataset.action === 'review' ? 'A solicitação está pronta para avaliação.' : 'Detalhes da instituição disponíveis em breve.';
    button.textContent = message;
    window.setTimeout(() => { button.innerHTML = button.dataset.action === 'review' ? 'Avaliar Solicitação <b>▣</b>' : 'Ver Instituição <b>→</b>'; }, 1800);
  });
});
