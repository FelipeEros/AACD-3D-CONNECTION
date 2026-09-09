const filters = {
  institution: document.querySelector('#institutionFilter'),
  technology: document.querySelector('#technologyFilter'),
  material: document.querySelector('#materialFilter'),
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

Object.values(filters).forEach((filter) => filter.addEventListener('input', filterPrinters));
clearFilters.addEventListener('click', () => {
  filters.institution.value = '';
  filters.technology.value = '';
  filters.material.value = '';
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
