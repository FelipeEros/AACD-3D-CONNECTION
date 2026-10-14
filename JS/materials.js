const selectedFilters = {
  type: '',
  institution: '',
  status: ''
};

const rows = [...document.querySelectorAll('#materialsBody tr')];
const resultCount = document.querySelector('#resultCount');

function filterMaterials() {
  const visibleRows = rows.filter((row) => Object.entries(selectedFilters).every(([key, value]) => !value || row.dataset[key] === value));

  rows.forEach((row) => {
    row.hidden = !visibleRows.includes(row);
  });

  resultCount.textContent = visibleRows.length ? `Mostrando 1–${visibleRows.length} de 24 materiais` : 'Nenhum material encontrado';
}

function closeDropdowns() {
  document.querySelectorAll('.filter-control .dropdown-menu').forEach((menu) => menu.classList.remove('show'));
  document.querySelectorAll('.filter-control').forEach((control) => control.classList.remove('open'));
}

document.querySelectorAll('.dropdown-item').forEach((item) => {
  item.addEventListener('click', () => {
    const { filter, value } = item.dataset;
    const parent = item.closest('.filter-control');
    const toggle = parent.querySelector('.filter-value');
    const label = toggle.querySelector('.button-label');

    label.textContent = item.textContent.trim();
    selectedFilters[filter] = value || '';

    parent.querySelectorAll('.dropdown-item').forEach((option) => option.classList.toggle('active', option === item));
    closeDropdowns();
    filterMaterials();
  });
});

document.querySelectorAll('.filter-value').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const parent = button.closest('.filter-control');
    const menu = parent.querySelector('.dropdown-menu');
    const shouldOpen = !menu.classList.contains('show');

    closeDropdowns();

    if (shouldOpen) {
      menu.classList.add('show');
      parent.classList.add('open');
    }
  });
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.filter-control')) {
    closeDropdowns();
  }
});

document.querySelector('#clearFilters').addEventListener('click', () => {
  Object.keys(selectedFilters).forEach((key) => {
    selectedFilters[key] = '';
  });

  document.querySelectorAll('.dropdown-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.value === '');
  });

  document.querySelectorAll('.filter-value .button-label').forEach((label) => {
    const defaultText = label.closest('.filter-value').id === 'typeFilter'
      ? 'Todos os Tipos'
      : label.closest('.filter-value').id === 'institutionFilter'
        ? 'Todas as Unidades'
        : 'Qualquer Status';
    label.textContent = defaultText;
  });

  closeDropdowns();
  filterMaterials();
});

document.querySelector('#exportButton').addEventListener('click', (event) => {
  const button = event.currentTarget;
  button.innerHTML = '<i class="bi bi-check-circle" aria-hidden="true"></i> Relatório pronto';
  window.setTimeout(() => { button.innerHTML = '<i class="bi bi-download" aria-hidden="true"></i> Exportar Relatório'; }, 1800);
});

document.querySelector('#requestButton').addEventListener('click', (event) => {
  event.currentTarget.textContent = 'Solicitação enviada';
  event.currentTarget.disabled = true;
});

document.querySelectorAll('.row-action').forEach((button) => {
  button.addEventListener('click', () => window.alert(`Detalhes: ${button.closest('tr').querySelector('.material-name strong').textContent}`));
});

filterMaterials();