document.addEventListener('DOMContentLoaded', () => {
  const rows = [...document.querySelectorAll('tbody tr')];
  const defaultLabels = {
    institution: 'Todas',
    printer: 'Todas',
    material: 'Todos',
    period: 'mm/dd/yyyy',
    status: 'Todos'
  };

  const selectedFilters = {
    institution: '',
    printer: '',
    material: '',
    period: '',
    status: ''
  };

  function applyFilters() {
    const visibleRows = rows.filter((row) => {
      const matchesInstitution = !selectedFilters.institution || row.dataset.institution === selectedFilters.institution;
      const matchesPrinter = !selectedFilters.printer || row.dataset.printer === selectedFilters.printer;
      const matchesMaterial = !selectedFilters.material || row.dataset.material === selectedFilters.material;
      const matchesPeriod = !selectedFilters.period || row.dataset.period === selectedFilters.period;
      const matchesStatus = !selectedFilters.status || row.dataset.status === selectedFilters.status;

      return matchesInstitution && matchesPrinter && matchesMaterial && matchesPeriod && matchesStatus;
    });

    rows.forEach((row) => {
      row.hidden = !visibleRows.includes(row);
    });

    const footerText = document.querySelector('.table-footer span');
    if (footerText) {
      footerText.textContent = visibleRows.length
        ? `Mostrando 1 a ${visibleRows.length} de ${visibleRows.length} registros`
        : 'Nenhum registro encontrado';
    }
  }

  function clearFilters() {
    Object.keys(selectedFilters).forEach((key) => {
      selectedFilters[key] = '';
    });

    document.querySelectorAll('.dropdown-item').forEach((item) => {
      const isDefault = item.dataset.value === '';
      item.classList.toggle('active', isDefault);
    });

    Object.entries(defaultLabels).forEach(([filter, label]) => {
      const button = document.getElementById(`${filter}Filter`);
      if (button) {
        button.textContent = label;
      }
    });

    applyFilters();
  }

  document.querySelectorAll('.dropdown-item').forEach((item) => {
    item.addEventListener('click', () => {
      const { filter, value } = item.dataset;
      const dropdown = item.closest('.dropdown');
      const button = dropdown?.querySelector('.filter-value');

      if (!button || !filter) return;

      selectedFilters[filter] = value || '';
      button.textContent = item.textContent.trim();

      dropdown.querySelectorAll('.dropdown-item').forEach((option) => {
        option.classList.toggle('active', option === item);
      });

      applyFilters();
    });
  });

  const filterButton = document.querySelector('.filter-button');
  if (filterButton) {
    filterButton.addEventListener('click', () => {
      clearFilters();
    });
  }

  applyFilters();
});
