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
  window.location.href = 'materials.html';
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

document.querySelectorAll('.card-button').forEach((button) => {
  button.addEventListener('click', () => {
    const message = button.dataset.action === 'review' ? 'A solicitação está pronta para avaliação.' : 'Detalhes da instituição disponíveis em breve.';
    button.textContent = message;
    window.setTimeout(() => {
      const action = button.dataset.action === 'review' ? {
        label: 'Avaliar Solicitação',
        icon: 'bi bi-arrow-right',
      } : {
        label: 'Ver Instituição',
        icon: 'bi bi-arrow-right',
      };

      button.innerHTML = `
        <span class="card-button-text">${action.label}</span>
        <i class="${action.icon}" aria-hidden="true"></i>
      `;
    }, 1800);
  });
});
