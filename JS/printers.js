const filters = {
  institution: { value: '' },
  technology: { value: '' },
  material: { value: '' },
  search: document.querySelector('#printerSearch'),
};

const grid = document.querySelector('#printerGrid');
const resultCount = document.querySelector('#resultCount');
const emptyState = document.querySelector('#emptyState');
const clearFilters = document.querySelector('#clearFilters');
let printers = [];

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function resetMenu(filterName, defaultLabel) {
  const button = document.querySelector(`#${filterName}Filter`);
  const menu = button.closest('.dropdown').querySelector('.dropdown-menu');
  menu.innerHTML = `<li><button class="dropdown-item active" type="button" data-filter="${filterName}" data-value="">${defaultLabel}</button></li>`;
  menu.querySelector('[data-filter]').addEventListener('click', selectFilter);
}

function addFilterOption(filterName, value, label) {
  if (!value) return;
  const button = document.querySelector(`#${filterName}Filter`);
  const menu = button.closest('.dropdown').querySelector('.dropdown-menu');
  const valueSlug = slug(value);
  if (menu.querySelector(`[data-value="${valueSlug}"]`)) return;
  const li = document.createElement('li');
  li.innerHTML = `<button class="dropdown-item" type="button" data-filter="${filterName}" data-value="${AACD.escapeHtml(valueSlug)}">${AACD.escapeHtml(label)}</button>`;
  menu.appendChild(li);
  li.firstElementChild.addEventListener('click', selectFilter);
}

function selectFilter() {
  const filterName = this.dataset.filter;
  filters[filterName].value = this.dataset.value;
  document.querySelector(`#${filterName}Filter`).textContent = this.textContent;
  this.closest('.dropdown-menu').querySelectorAll('.dropdown-item')
    .forEach((item) => item.classList.toggle('active', item === this));
  closeDropdowns();
  filterPrinters();
}

function closeDropdowns() {
  document.querySelectorAll('.filter-control .dropdown-menu').forEach((menu) => menu.classList.remove('show'));
  document.querySelectorAll('.filter-control .dropdown-toggle').forEach((button) => button.setAttribute('aria-expanded', 'false'));
}

document.querySelectorAll('.filter-control .dropdown-toggle').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const menu = button.closest('.filter-control').querySelector('.dropdown-menu');
    const shouldOpen = !menu.classList.contains('show');
    closeDropdowns();
    if (shouldOpen) {
      menu.classList.add('show');
      button.setAttribute('aria-expanded', 'true');
    }
  });
});

document.addEventListener('click', closeDropdowns);

function filterPrinters() {
  const searchTerm = filters.search.value.trim().toLowerCase();
  let visibleCards = 0;

  grid.querySelectorAll('.printer-card').forEach((card) => {
    const matchesInstitution = !filters.institution.value || card.dataset.institution === filters.institution.value;
    const matchesTechnology = !filters.technology.value || card.dataset.technology === filters.technology.value;
    const matchesMaterial = !filters.material.value || (card.dataset.materials || '').split(' ').includes(filters.material.value);
    const matchesSearch = !searchTerm || card.dataset.name.includes(searchTerm);
    const isVisible = matchesInstitution && matchesTechnology && matchesMaterial && matchesSearch;
    card.hidden = !isVisible;
    if (isVisible) visibleCards += 1;
  });

  resultCount.textContent = `${visibleCards} ${visibleCards === 1 ? 'impressora encontrada' : 'impressoras encontradas'}`;
  emptyState.hidden = visibleCards !== 0;
}

filters.search.addEventListener('input', filterPrinters);

clearFilters.addEventListener('click', () => {
  filters.institution.value = '';
  filters.technology.value = '';
  filters.material.value = '';
  filters.search.value = '';
  document.querySelector('#institutionFilter').textContent = 'Todas';
  document.querySelector('#technologyFilter').textContent = 'Todas';
  document.querySelector('#materialFilter').textContent = 'Todos';
  document.querySelectorAll('.dropdown-menu').forEach((menu) => {
    menu.querySelectorAll('.dropdown-item').forEach((item, index) => item.classList.toggle('active', index === 0));
  });
  closeDropdowns();
  filterPrinters();
});

const printModal = document.querySelector('#printModal');
const printForm = document.querySelector('#printForm');
const printMaterial = document.querySelector('#printMaterial');
const printFormFeedback = document.querySelector('#printFormFeedback');
let selectedPrinter = null;

function closePrintModal() {
  printModal.classList.remove('is-open');
  printModal.setAttribute('aria-hidden', 'true');
  printForm.reset();
  printFormFeedback.textContent = '';
  printFormFeedback.className = 'print-form-feedback';
  printForm.querySelector('button[type="submit"]').disabled = false;
  selectedPrinter = null;
}

function printerStatus(printer) {
  if (printer.status === 'ocupada') return { kind: 'busy', label: 'EM USO' };
  if (printer.status === 'indisponivel') return { kind: 'busy', label: 'INDISPONÍVEL' };
  return { kind: 'available', label: 'DISPONÍVEL' };
}

function printerCard(printer) {
  const institutionName = printer.institutionName || 'Instituição';
  const status = printerStatus(printer);
  const technology = printer.tecnologia || printer.modelo || 'Não informada';
  const volume = printer.volume || printer.volume_construcao || printer.observacoes || 'Não informado';
  const materials = printer.compatibleMaterials || [];
  const available = printer.status === 'disponivel';

  return `
    <article class="printer-card" data-institution="${AACD.escapeHtml(slug(printer.institutionName))}" data-technology="${AACD.escapeHtml(slug(technology))}" data-materials="${AACD.escapeHtml(materials.map((material) => slug(material.nome)).join(' '))}" data-name="${AACD.escapeHtml(String(printer.nome || '').toLowerCase())}">
      <div class="printer-image has-fallback">
        <span class="status ${status.kind === 'available' ? 'available' : 'busy'}"><i></i>${AACD.escapeHtml(status.label)}</span>
      </div>
      <div class="printer-body">
        <h2>${AACD.escapeHtml(printer.nome)}</h2>
        <p class="institution"><i class="bi bi-building" aria-hidden="true"></i>${AACD.escapeHtml(institutionName)}</p>
        <dl>
          <div><dt>Tecnologia</dt><dd>${AACD.escapeHtml(technology)}</dd></div>
          <div><dt>Fabricante</dt><dd>${AACD.escapeHtml(printer.fabricante || 'Não informado')}</dd></div>
          <div><dt>Volume</dt><dd>${AACD.escapeHtml(volume)}</dd></div>
        </dl>
        <p class="materials-label">Materiais Compatíveis</p>
        <div class="material-list">${materials.length
          ? materials.map((material) => `<span>${AACD.escapeHtml(material.nome)}</span>`).join('')
          : '<span>Não informado</span>'}</div>
        ${available
          ? `<button class="printer-action" type="button" data-print-id="${AACD.escapeHtml(printer.id)}">Iniciar Impressão</button>`
          : `<button class="printer-action waiting" type="button" disabled>${printer.status === 'ocupada' ? 'Fila de Espera' : 'Indisponível'}</button>`}
      </div>
    </article>`;
}

grid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-print-id]');
  if (!button) return;
  selectedPrinter = printers.find((printer) => printer.id === button.dataset.printId);
  if (!selectedPrinter) return;

  document.querySelector('#selectedPrinterName').textContent = selectedPrinter.nome;
  document.querySelector('#selectedPrinterInstitution').textContent = selectedPrinter.institutionName || 'Instituição';
  printMaterial.innerHTML = selectedPrinter.compatibleMaterials.length
    ? selectedPrinter.compatibleMaterials.map((material) =>
      `<option value="${AACD.escapeHtml(material.id)}">${AACD.escapeHtml(material.nome)}</option>`).join('')
    : '<option value="">Nenhum material compatível</option>';
  printModal.classList.add('is-open');
  printModal.setAttribute('aria-hidden', 'false');
  document.querySelector('#printFile').focus();
});

printModal.querySelectorAll('[data-print-modal-close]').forEach((button) => button.addEventListener('click', closePrintModal));

printForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!printForm.checkValidity()) {
    printForm.reportValidity();
    return;
  }
  if (!selectedPrinter?.compatibleMaterials.length) {
    printFormFeedback.textContent = 'Esta impressora não possui materiais compatíveis cadastrados.';
    printFormFeedback.className = 'print-form-feedback visible';
    return;
  }

  const submitButton = printForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  const quantity = Number(new FormData(printForm).get('quantity'));
  const materialId = printMaterial.value;
  const fileName = document.querySelector('#printFile').files[0]?.name;
  const notes = printForm.elements.notes.value.trim();
  const observacoes = [
    fileName ? `Arquivo: ${fileName}` : '',
    notes,
  ].filter(Boolean).join(' | ');

  try {
    await AACD.api('/solicitacoes', {
      method: 'POST',
      body: {
        instituicao_id: selectedPrinter.instituicao_id,
        impressora_id: selectedPrinter.id,
        observacoes: observacoes || undefined,
        itens: [{ material_id: materialId, quantidade }],
      },
    });
    printFormFeedback.textContent = 'Solicitação criada e enviada para a instituição.';
    printFormFeedback.className = 'print-form-feedback visible success';
  } catch (err) {
    printFormFeedback.textContent = AACD.errorMessage(err);
    printFormFeedback.className = 'print-form-feedback visible';
    submitButton.disabled = false;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && printModal.classList.contains('is-open')) closePrintModal();
});

async function listAll(path) {
  const items = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await AACD.api(path, { query: { limit: 100, offset } });
    items.push(...(page.data || []));
    if (!page.data || page.data.length < 100) break;
  }
  return items;
}

async function loadPrinters() {
  if (!window.AACD.usuario) {
    grid.innerHTML = '<p class="empty-state">Sessão não encontrada. Entre novamente para carregar as impressoras.</p>';
    resultCount.textContent = 'Não foi possível carregar as impressoras';
    return;
  }
  try {
    const [printerRows, institutionRows] = await Promise.all([
      listAll('/impressoras'),
      listAll('/instituicoes'),
    ]);
    const institutions = Object.fromEntries(institutionRows.map((institution) => [institution.id, institution.nome]));
    const detailed = await Promise.all(printerRows.map(async (printer) => {
      try {
        const detail = await AACD.api(`/impressoras/${printer.id}`);
        return {
          ...printer,
          ...detail,
          institutionName: institutions[printer.instituicao_id] || detail.instituicao?.nome,
          compatibleMaterials: (detail.materiais || []).map((relation) => ({
            id: relation.material_id || relation.material?.id,
            nome: relation.material?.nome || relation.nome || relation.material_id,
          })).filter((material) => material.id),
        };
      } catch {
        return {
          ...printer,
          institutionName: institutions[printer.instituicao_id],
          compatibleMaterials: [],
        };
      }
    }));

    printers = detailed;
    resetMenu('institution', 'Todas');
    resetMenu('technology', 'Todas');
    resetMenu('material', 'Todos');
    printers.forEach((printer) => {
      addFilterOption('institution', printer.institutionName, printer.institutionName);
      addFilterOption('technology', printer.tecnologia || printer.modelo, printer.tecnologia || printer.modelo);
      printer.compatibleMaterials.forEach((material) => addFilterOption('material', material.nome, material.nome));
    });

    grid.innerHTML = printers.length
      ? printers.map(printerCard).join('')
      : '<p class="empty-state">Nenhuma impressora cadastrada.</p>';
    filterPrinters();
  } catch (err) {
    grid.innerHTML = `<p class="empty-state">${AACD.escapeHtml(AACD.errorMessage(err))}</p>`;
    resultCount.textContent = 'Não foi possível carregar as impressoras';
  }
}

loadPrinters();
