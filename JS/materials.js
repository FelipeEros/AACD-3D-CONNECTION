const filters = {
  type: document.querySelector('#typeFilter'),
  institution: document.querySelector('#institutionFilter'),
  status: document.querySelector('#statusFilter')
};
const rows = [...document.querySelectorAll('#materialsBody tr')];
const resultCount = document.querySelector('#resultCount');

function filterMaterials() {
  const visibleRows = rows.filter((row) => {
    const visible = Object.entries(filters).every(([key, filter]) => !filter.value || row.dataset[key] === filter.value);
    row.hidden = !visible;
    return visible;
  });
  resultCount.textContent = visibleRows.length ? `Mostrando 1–${visibleRows.length} de 24 materiais` : 'Nenhum material encontrado';
}

Object.values(filters).forEach((filter) => filter.addEventListener('change', filterMaterials));
document.querySelector('#filterButton').addEventListener('click', filterMaterials);

document.querySelector('#exportButton').addEventListener('click', (event) => {
  const button = event.currentTarget;
  button.innerHTML = '<span aria-hidden="true">✓</span> Relatório pronto';
  window.setTimeout(() => { button.innerHTML = '<img src="../ICONS/download.png" alt="" /> Exportar Relatório'; }, 1800);
});

document.querySelector('#requestButton').addEventListener('click', (event) => {
  event.currentTarget.textContent = 'Solicitação enviada';
  event.currentTarget.disabled = true;
});

document.querySelectorAll('.row-action').forEach((button) => {
  button.addEventListener('click', () => window.alert(`Detalhes: ${button.closest('tr').querySelector('.material-name strong').textContent}`));
});