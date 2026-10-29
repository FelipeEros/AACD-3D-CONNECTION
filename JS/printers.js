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

document.querySelectorAll('.filter-control .dropdown-toggle').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const control = button.closest('.filter-control');
    const menu = control.querySelector('.dropdown-menu');
    const shouldOpen = !menu.classList.contains('show');

    document.querySelectorAll('.filter-control .dropdown-menu').forEach((otherMenu) => {
      otherMenu.classList.remove('show');
      otherMenu.closest('.filter-control')?.querySelector('.dropdown-toggle')?.setAttribute('aria-expanded', 'false');
    });

    if (shouldOpen) {
      menu.classList.add('show');
      button.setAttribute('aria-expanded', 'true');
    }
  });
});

document.addEventListener('click', () => {
  document.querySelectorAll('.filter-control .dropdown-menu').forEach((menu) => {
    menu.classList.remove('show');
    menu.closest('.filter-control')?.querySelector('.dropdown-toggle')?.setAttribute('aria-expanded', 'false');
  });
});

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

const printModal = document.querySelector('#printModal');
const printForm = document.querySelector('#printForm');
const printMaterial = document.querySelector('#printMaterial');
const printFormFeedback = document.querySelector('#printFormFeedback');
const materialLabels = {
  pla: 'PLA',
  petg: 'PETG',
  abs: 'ABS',
  biomed: 'BioMed Clear',
  tough: 'Tough 1500',
  nylon: 'Nylon',
  pva: 'PVA',
  tpu: 'TPU',
};

function closePrintModal() {
  printModal.classList.remove('is-open');
  printModal.setAttribute('aria-hidden', 'true');
  printForm.reset();
  printFormFeedback.textContent = '';
  printFormFeedback.className = 'print-form-feedback';
  printForm.querySelector('button[type="submit"]').disabled = false;
}

document.querySelectorAll('.printer-action:not(.waiting)').forEach((button) => {
  button.addEventListener('click', () => {
    const card = button.closest('.printer-card');
    const printerName = card.querySelector('h2').textContent;
    const institution = card.querySelector('.institution').textContent.trim();
    const materials = card.dataset.materials.split(' ');

    document.querySelector('#selectedPrinterName').textContent = printerName;
    document.querySelector('#selectedPrinterInstitution').textContent = institution;
    printMaterial.innerHTML = materials.map((material) => `<option value="${material}">${materialLabels[material] || material.toUpperCase()}</option>`).join('');
    printModal.classList.add('is-open');
    printModal.setAttribute('aria-hidden', 'false');
    document.querySelector('#printFile').focus();
  });

  document.querySelectorAll('.printer-action.waiting').forEach((button) => {
    button.addEventListener('click', () => {
      const originalText = button.textContent;
      button.textContent = 'Adicionada à fila';
      button.disabled = true;
      window.setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 1800);
    });
  });
});

printModal.querySelectorAll('[data-print-modal-close]').forEach((button) => {
  button.addEventListener('click', closePrintModal);
});

printForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!printForm.checkValidity()) {
    printForm.reportValidity();
    return;
  }
  printFormFeedback.textContent = 'Impressão enviada para a fila com sucesso.';
  printFormFeedback.className = 'print-form-feedback visible success';
  printForm.querySelector('button[type="submit"]').disabled = true;
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && printModal.classList.contains('is-open')) {
    closePrintModal();
  }
});
