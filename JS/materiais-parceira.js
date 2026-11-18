const materialRegistrationModal = document.querySelector('#materialRegistrationModal');
const materialRegistrationButton = document.querySelector('#openMaterialRegistration');
const materialRegistrationForm = document.querySelector('#materialRegistrationForm');
const materialFormFeedback = document.querySelector('#materialFormFeedback');
const materialSubmitButton = materialRegistrationForm.querySelector('button[type="submit"]');
const materialsTableBody = document.querySelector('#materialsTableBody');
const materialsTableContainer = document.querySelector('.table-scroll');
const summaryGrid = document.querySelector('.summary-grid');
let editingMaterialId = null;
let materials = [];
let inventoryRows = [];
let activeType = '';
let activeStatus = '';
const materialTypeFilter = document.querySelector('#materialTypeFilter');
const materialStatusFilter = document.querySelector('#materialStatusFilter');
const materialTypeMenu = document.querySelector('#materialTypeMenu');
const materialStatusMenu = document.querySelector('#materialStatusMenu');

function showMaterialFeedback(message, type = 'info') {
  materialFormFeedback.textContent = message;
  materialFormFeedback.className = `material-form-feedback visible ${type}`;
}

function closeMaterialRegistration() {
  materialRegistrationModal.classList.remove('is-open');
  materialRegistrationModal.setAttribute('aria-hidden', 'true');
  materialRegistrationForm.reset();
  materialFormFeedback.textContent = '';
  materialFormFeedback.className = 'material-form-feedback';
  materialSubmitButton.disabled = false;
  materialSubmitButton.textContent = 'Cadastrar material';
  document.querySelector('#materialRegistrationTitle').textContent = 'Cadastrar material';
  editingMaterialId = null;
}

function materialStatus(material, saldo, alerta) {
  const situacao = String(alerta?.situacao || '').toLowerCase();
  const minimo = Number(material.estoque_minimo ?? 0);
  if (saldo <= 0) return ['CRÍTICO', 'critical'];
  if (situacao.includes('esgot') || situacao.includes('crít') || situacao.includes('crit')) return ['CRÍTICO', 'critical'];
  if (minimo > 0 && saldo <= minimo * 0.25) return ['CRÍTICO', 'critical'];
  if (situacao === 'baixo') return ['BAIXO', 'low'];
  if (minimo > 0 && saldo <= minimo) return ['BAIXO', 'low'];
  return ['ADEQUADO', 'adequate'];
}

function renderMaterials(rows) {
  materialsTableBody.innerHTML = rows.length ? rows.map(({ material, saldo, alerta }) => {
    const characteristics = material.caracteristicas || {};
    const [status, statusClass] = materialStatus(material, saldo, alerta);
    return `
      <tr data-material-id="${AACD.escapeHtml(material.id)}">
        <td><strong>${AACD.escapeHtml(material.nome)}</strong><small>${AACD.escapeHtml([characteristics.marca, characteristics.lote].filter(Boolean).join(' - ') || 'Sem marca ou lote')}</small></td>
        <td>${AACD.escapeHtml(material.tipo)}</td>
        <td><span class="color-dot"></span>${AACD.escapeHtml(material.cor || '—')}</td>
        <td>${AACD.escapeHtml(AACD.fmt.numero(saldo, 2))} ${AACD.escapeHtml(material.unidade || '')}</td>
        <td><span class="status ${statusClass}">${status}</span></td>
        <td><button class="edit-button edit-material" type="button" aria-label="Editar ${AACD.escapeHtml(material.nome)}"><i class="bi bi-pencil" aria-hidden="true"></i></button></td>
      </tr>`;
  }).join('') : '<tr><td colspan="6">Nenhum material cadastrado.</td></tr>';

  const total = inventoryRows.reduce((sum, { saldo }) => sum + saldo, 0);
  const critical = inventoryRows.filter(({ material, saldo, alerta }) => materialStatus(material, saldo, alerta)[0] === 'CRÍTICO').length;
  const summaryValues = summaryGrid.querySelectorAll('strong');
  summaryValues[0].textContent = AACD.fmt.numero(total, 2);
  summaryValues[1].textContent = critical;
  summaryGrid.classList.remove('is-loading');
  materialsTableContainer.classList.remove('is-loading');
  summaryGrid.setAttribute('aria-busy', 'false');
  materialsTableContainer.setAttribute('aria-busy', 'false');
}

function applyMaterialFilters() {
  const filtered = inventoryRows.filter(({ material, saldo, alerta }) => {
    const typeMatches = !activeType || material.tipo === activeType;
    const statusMatches = !activeStatus || materialStatus(material, saldo, alerta)[0] === activeStatus;
    return typeMatches && statusMatches;
  });
  renderMaterials(filtered);
}

function renderFilterMenu(menu, options, selected, onSelect) {
  menu.innerHTML = options.map(({ value, label }) => `
    <button type="button" class="${value === selected ? 'active' : ''}" data-filter-value="${AACD.escapeHtml(value)}">${AACD.escapeHtml(label)}</button>
  `).join('');
  menu.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      onSelect(button.dataset.filterValue);
      menu.hidden = true;
      menu.previousElementSibling.setAttribute('aria-expanded', 'false');
    });
  });
}

function updateFilterMenus() {
  const types = [...new Set(materials.map(({ tipo }) => tipo).filter(Boolean))].sort();
  renderFilterMenu(materialTypeMenu, [{ value: '', label: 'Todos os Tipos' }, ...types.map((type) => ({ value: type, label: type }))], activeType, (value) => {
    activeType = value;
    materialTypeFilter.innerHTML = `${value || 'Todos os Tipos'} <i class="bi bi-chevron-down" aria-hidden="true"></i>`;
    applyMaterialFilters();
  });
  renderFilterMenu(materialStatusMenu, [
    { value: '', label: 'Todas as situações' },
    { value: 'ADEQUADO', label: 'Adequado' },
    { value: 'BAIXO', label: 'Baixo' },
    { value: 'CRÍTICO', label: 'Crítico' },
  ], activeStatus, (value) => {
    activeStatus = value;
    materialStatusFilter.innerHTML = `<i class="bi bi-filter" aria-hidden="true"></i>${value || 'Filtros'}`;
    applyMaterialFilters();
  });
}

async function loadMaterials() {
  const [materialResponse, saldoResponse, alertResponse] = await Promise.all([
    AACD.api('/materiais', { query: { limit: 100 } }),
    AACD.api('/estoque/saldo', { query: { limit: 100, _cachebust: Date.now() } }),
    AACD.api('/estoque/alertas', { query: { limit: 100, _cachebust: Date.now() } }),
  ]);
  materials = materialResponse.data || [];
  const balanceRows = saldoResponse.data || [];
  const balances = new Map(balanceRows.map((row) => [row.material_id || row.id || row.material?.id, {
    saldo: Number(row.saldo_atual ?? row.saldo ?? row.quantidade ?? 0),
    minimo: Number(row.estoque_minimo ?? row.minimo ?? 0),
  }]));
  const alertRows = alertResponse.data || [];
  const alerts = new Map(alertRows.map((row) => [row.material_id || row.id || row.material?.id, row]));
  alerts.forEach((alert, materialId) => {
    const balance = balances.get(materialId);
    balances.set(materialId, {
      saldo: balance?.saldo ?? Number(alert.saldo_atual ?? alert.saldo ?? 0),
      minimo: Number(alert.estoque_minimo ?? alert.minimo ?? balance?.minimo ?? 0),
    });
  });
  inventoryRows = materials.map((material) => {
    const alert = alerts.get(material.id);
    const balance = balances.get(material.id);
    const saldoCandidates = [
      material.saldo_atual,
      balance?.saldo,
      alert?.saldo_atual,
      alert?.saldo,
      alert?.quantidade,
    ].map((candidate) => Number(candidate)).filter((candidate) => Number.isFinite(candidate));
    const saldo = saldoCandidates.find((candidate) => candidate > 0) ?? saldoCandidates.at(-1) ?? 0;
    const minimo = Number(
      balance?.minimo
      ?? alert?.estoque_minimo
      ?? alert?.minimo
      ?? material.estoque_minimo
      ?? 0,
    );
    return {
      material: { ...material, estoque_minimo: minimo },
      saldo,
      alerta: alert,
    };
  });
  updateFilterMenus();
  applyMaterialFilters();
}

function openMaterialEdit(material) {
  const characteristics = material.caracteristicas || {};
  editingMaterialId = material.id;
  document.querySelector('#materialRegistrationTitle').textContent = 'Editar material';
  materialSubmitButton.textContent = 'Salvar alterações';
  materialRegistrationForm.elements.name.value = material.nome || '';
  materialRegistrationForm.elements.type.value = material.tipo || '';
  materialRegistrationForm.elements.brand.value = characteristics.marca || '';
  materialRegistrationForm.elements.batch.value = characteristics.lote || '';
  materialRegistrationForm.elements.color.value = material.cor || '';
  const inventory = inventoryRows.find(({ material: rowMaterial }) => rowMaterial.id === material.id);
  materialRegistrationForm.elements.quantity.value = String(inventory?.saldo ?? 0);
  materialRegistrationForm.elements.unit.value = material.unidade || '';
  materialRegistrationForm.elements.compatibility.value = characteristics.compatibilidade || '';
  materialRegistrationForm.elements.quantity.required = true;
  materialRegistrationModal.classList.add('is-open');
  materialRegistrationModal.setAttribute('aria-hidden', 'false');
  materialRegistrationForm.elements.name.focus();
}

materialRegistrationButton.addEventListener('click', () => {
  editingMaterialId = null;
  materialRegistrationForm.elements.quantity.required = true;
  materialRegistrationModal.classList.add('is-open');
  materialRegistrationModal.setAttribute('aria-hidden', 'false');
  materialRegistrationForm.elements.name.focus();
});

materialRegistrationModal.querySelectorAll('[data-material-modal-close]').forEach((closeButton) => {
  closeButton.addEventListener('click', closeMaterialRegistration);
});

materialsTableBody.addEventListener('click', (event) => {
  const editButton = event.target.closest('.edit-material');
  if (!editButton) return;
  const material = materials.find(({ id }) => id === editButton.closest('tr').dataset.materialId);
  if (material) openMaterialEdit(material);
});

materialTypeFilter.addEventListener('click', () => {
  materialTypeMenu.hidden = !materialTypeMenu.hidden;
  materialTypeFilter.setAttribute('aria-expanded', String(!materialTypeMenu.hidden));
});

materialStatusFilter.addEventListener('click', () => {
  materialStatusMenu.hidden = !materialStatusMenu.hidden;
  materialStatusFilter.setAttribute('aria-expanded', String(!materialStatusMenu.hidden));
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.inventory-filter')) {
    materialTypeMenu.hidden = true;
    materialStatusMenu.hidden = true;
    materialTypeFilter.setAttribute('aria-expanded', 'false');
    materialStatusFilter.setAttribute('aria-expanded', 'false');
  }
});

materialRegistrationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!materialRegistrationForm.checkValidity()) {
    materialRegistrationForm.reportValidity();
    return;
  }
  const data = new FormData(materialRegistrationForm);
  const payload = {
    nome: data.get('name'),
    tipo: data.get('type'),
    marca: data.get('brand'),
    lote: data.get('batch'),
    cor: data.get('color'),
    unidade: data.get('unit'),
    compatibilidade: data.get('compatibility'),
  };
  const quantity = Number(data.get('quantity'));
  if (editingMaterialId) {
    payload.quantidade_estoque = quantity;
  } else {
    payload.quantidade_inicial = quantity;
  }

  materialSubmitButton.disabled = true;
  showMaterialFeedback(editingMaterialId ? 'Salvando alterações...' : 'Cadastrando material...', 'info');
  try {
    await AACD.api(editingMaterialId ? `/materiais/${editingMaterialId}` : '/materiais', {
      method: editingMaterialId ? 'PATCH' : 'POST',
      body: payload,
    });
    await loadMaterials();
    showMaterialFeedback(editingMaterialId ? 'Alterações salvas com sucesso.' : 'Material cadastrado com sucesso.', 'success');
    window.setTimeout(closeMaterialRegistration, 900);
  } catch (error) {
    materialSubmitButton.disabled = false;
    showMaterialFeedback(AACD.errorMessage(error), 'error');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && materialRegistrationModal.classList.contains('is-open')) {
    closeMaterialRegistration();
  }
});

loadMaterials().catch((error) => {
  materialsTableBody.innerHTML = `<tr><td colspan="6">${AACD.escapeHtml(AACD.errorMessage(error))}</td></tr>`;
  summaryGrid.classList.remove('is-loading');
  materialsTableContainer.classList.remove('is-loading');
});
