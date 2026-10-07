const filters = {
  institution: { value: '' },
  technology: { value: '' },
  material: { value: '' },
  search: document.querySelector('#printerSearch')
};
const cards = [...document.querySelectorAll('.printer-card')];
const resultCount = document.querySelector('#resultCount');
const emptyState = document.querySelector('#emptyState');
const clearFilters = document.querySelector('#clearFilters');

function filterPrinters() {
  const searchTerm = filters.search.value.trim().toLowerCase();
  let visibleCards = 0;

  cards.forEach((card) => {
    const matchesInstitution = !filters.institution.value || card.dataset.institution === filters.institution.value;
    const matchesTechnology = !filters.technology.value || card.dataset.technology === filters.technology.value;
    const matchesMaterial = !filters.material.value || card.dataset.materials.includes(filters.material.value);
    const matchesSearch = !searchTerm || card.dataset.name.toLowerCase().includes(searchTerm);
    const isVisible = matchesInstitution && matchesTechnology && matchesMaterial && matchesSearch;

    card.hidden = !isVisible;
    if (isVisible) visibleCards += 1;
  });

  resultCount.textContent = `${visibleCards} ${visibleCards === 1 ? 'impressora encontrada' : 'impressoras encontradas'}`;
  emptyState.hidden = visibleCards !== 0;
}

filters.search.addEventListener('input', filterPrinters);
document.querySelectorAll('[data-filter]').forEach((option) => {
  option.addEventListener('click', () => {
    const filterName = option.dataset.filter;
    filters[filterName].value = option.dataset.value;
    document.querySelector(`#${filterName}Filter`).textContent = option.textContent;
    option.closest('.dropdown-menu').querySelectorAll('.dropdown-item').forEach((item) => item.classList.toggle('active', item === option));
    filterPrinters();
  });
});
clearFilters.addEventListener('click', () => {
  ['institution', 'technology', 'material'].forEach((filterName) => {
    filters[filterName].value = '';
    const button = document.querySelector(`#${filterName}Filter`);
    button.textContent = filterName === 'material' ? 'Todos' : 'Todas';
    button.closest('.dropdown').querySelectorAll('.dropdown-item').forEach((item, index) => item.classList.toggle('active', index === 0));
  });
  filters.search.value = '';
  filterPrinters();
});

document.querySelectorAll('.printer-action').forEach((button) => {
  button.addEventListener('click', () => {
    const originalText = button.textContent;
    button.textContent = button.classList.contains('waiting') ? 'Adicionada à fila' : 'Solicitação enviada';
    button.disabled = true;
    window.setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 1800);
  });
});
