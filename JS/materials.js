const selectedFilters = { type: '', institution: '', status: '' };
const resultCount = document.querySelector('#resultCount');
const exportStatus = document.querySelector('#exportStatus');
const tableBody = document.querySelector('#materialsBody');
let materials = [];

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function value(row, names, fallback = '') {
  if (!row) return fallback;
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null) return row[name];
  }
  return fallback;
}

function closeDropdowns() {
  document.querySelectorAll('.filter-control .dropdown-menu').forEach((menu) => menu.classList.remove('show'));
  document.querySelectorAll('.filter-control').forEach((control) => control.classList.remove('open'));
}

function filterMaterials() {
  const rows = [...tableBody.querySelectorAll('tr[data-material-id]')];
  const visibleRows = rows.filter((row) => Object.entries(selectedFilters).every(([key, filterValue]) => {
    if (!filterValue) return true;
    if (key === 'institution') return (row.dataset.institution || '').split(' ').includes(filterValue);
    return row.dataset[key] === filterValue;
  }));

  rows.forEach((row) => { row.hidden = !visibleRows.includes(row); });
  resultCount.textContent = visibleRows.length
    ? `Mostrando 1–${visibleRows.length} de ${visibleRows.length} materiais`
    : 'Nenhum material encontrado';
}

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
  if (!event.target.closest('.filter-control')) closeDropdowns();
});

document.querySelectorAll('.dropdown-item').forEach((item) => {
  item.addEventListener('click', () => selectFilterItem(item));
});

function selectFilterItem(item) {
  const { filter, value: filterValue } = item.dataset;
  const parent = item.closest('.filter-control');
  parent.querySelector('.button-label').textContent = item.textContent.trim();
  selectedFilters[filter] = filterValue || '';
  parent.querySelectorAll('.dropdown-item')
    .forEach((option) => option.classList.toggle('active', option === item));
  closeDropdowns();
  filterMaterials();
}

document.querySelector('#clearFilters').addEventListener('click', () => {
  Object.keys(selectedFilters).forEach((key) => { selectedFilters[key] = ''; });
  document.querySelectorAll('.filter-control').forEach((control) => {
    const first = control.querySelector('.dropdown-item');
    if (first) {
      control.querySelector('.button-label').textContent = first.textContent.trim();
      control.querySelectorAll('.dropdown-item')
        .forEach((item, index) => item.classList.toggle('active', index === 0));
    }
  });
  closeDropdowns();
  filterMaterials();
});

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

document.querySelector('#exportButton').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const visible = materials.filter((material) => {
    return (!selectedFilters.type || slug(material.tipo) === selectedFilters.type)
      && (!selectedFilters.institution || (material.institutionSlugs || []).includes(selectedFilters.institution))
      && (!selectedFilters.status || material.statusKind === selectedFilters.status);
  });

  if (!visible.length) {
    exportStatus.textContent = 'Não há materiais para exportar com os filtros selecionados.';
    return;
  }

  try {
    await AACD.api('/estoque/relatorio.csv', { raw: true }).catch(() => null);
  } catch {
    // O relatório local abaixo permanece disponível mesmo sem a rota CSV.
  }

  const headers = ['Material', 'Tipo', 'Instituição', 'Quantidade', 'Status'];
  const data = visible.map((material) => [
    material.nome,
    material.tipo,
    material.institutionName,
    material.quantityLabel,
    material.statusLabel,
  ]);
  const csv = [headers, ...data].map((line) => line.map(csvEscape).join(';')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `relatorio-materiais-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);

  button.innerHTML = '<i class="bi bi-check-circle" aria-hidden="true"></i> Relatório exportado';
  exportStatus.textContent = `Relatório exportado com ${visible.length} ${visible.length === 1 ? 'material' : 'materiais'}.`;
  window.setTimeout(() => {
    button.innerHTML = '<i class="bi bi-download" aria-hidden="true"></i> Exportar Relatório';
  }, 1800);
});

function formatQuantity(quantity, unit, type) {
  const number = Number(quantity ?? 0);
  const normalizedUnit = String(unit || '').toLowerCase();
  if (normalizedUnit === 'g') {
    return number >= 1000
      ? `${AACD.fmt.numero(number / 1000, 2)} Kg`
      : `${AACD.fmt.numero(number)} g`;
  }
  if (slug(type) === 'resina') return `${AACD.fmt.numero(number, 2)} Litros`;
  return `${AACD.fmt.numero(number, 2)} ${unit || 'un.'}`;
}

function statusFromMaterial(material, alertIds) {
  const alert = alertIds instanceof Map ? alertIds.get(material.id) : null;
  const situacao = String(alert?.situacao || '').toLowerCase();
  const minimum = Number(material.minimum ?? 0);
  const quantity = Number(material.quantity ?? 0);
  if (quantity <= 0) return { kind: 'critico', label: 'CRÍTICO', css: 'critical', criticalValue: true };
  if (situacao.includes('esgot') || situacao.includes('crít') || situacao.includes('crit')) {
    return { kind: 'critico', label: 'CRÍTICO', css: 'critical', criticalValue: true };
  }
  if (minimum > 0 && quantity <= minimum * 0.25) {
    return { kind: 'critico', label: 'CRÍTICO', css: 'critical', criticalValue: true };
  }
  if (situacao === 'baixo') return { kind: 'baixo', label: 'BAIXO ESTOQUE', css: 'low', criticalValue: false };
  if (minimum > 0 && quantity <= minimum) {
    return { kind: 'baixo', label: 'BAIXO ESTOQUE', css: 'low', criticalValue: false };
  }
  return { kind: 'adequado', label: 'ADEQUADO', css: 'adequate', criticalValue: false };
}

function renderInstitutionOptions(institutions) {
  const menu = document.querySelector('#institutionFilter').closest('.filter-control').querySelector('.dropdown-menu');
  menu.innerHTML = '<li><button class="dropdown-item active" type="button" data-filter="institution" data-value="">Todas as Unidades</button></li>';
  institutions.forEach((institution) => {
    const li = document.createElement('li');
    li.innerHTML = `<button class="dropdown-item" type="button" data-filter="institution" data-value="${AACD.escapeHtml(slug(institution.nome))}">${AACD.escapeHtml(institution.nome)}</button>`;
    menu.appendChild(li);
  });
  menu.querySelectorAll('.dropdown-item').forEach((item) => item.addEventListener('click', () => selectFilterItem(item)));
}

function renderMaterials() {
  if (!materials.length) {
    tableBody.innerHTML = '<tr><td colspan="4" class="materials-loading">Nenhum material cadastrado.</td></tr>';
    resultCount.textContent = 'Nenhum material encontrado';
    return;
  }

  tableBody.innerHTML = materials.map((material) => `
    <tr data-material-id="${AACD.escapeHtml(material.id)}" data-type="${AACD.escapeHtml(slug(material.tipo))}" data-institution="${AACD.escapeHtml((material.institutionSlugs || []).join(' '))}" data-status="${AACD.escapeHtml(material.statusKind)}">
      <td>
        <div class="material-name">
          <span class="material-swatch ${slug(material.tipo) === 'resina' ? 'coral' : 'blue'}"><i class="bi bi-droplet-fill" aria-hidden="true"></i></span>
          <span><strong>${AACD.escapeHtml(material.nome)}</strong><small>${AACD.escapeHtml(material.detail || `${material.tipo || 'Material'} ${material.brand || ''}`.trim())}</small></span>
        </div>
      </td>
      <td><strong class="${material.status.criticalValue ? 'critical-value' : ''}">${AACD.escapeHtml(material.quantityLabel)}</strong><small>${AACD.escapeHtml(material.institutionName)}</small></td>
      <td><span class="status ${AACD.escapeHtml(material.status.css)}">${AACD.escapeHtml(material.statusLabel)}</span></td>
      <td><span class="compatibility"><i class="bi bi-printer" aria-hidden="true"></i> ${AACD.escapeHtml(material.compatibilityLabel)}</span></td>
    </tr>`).join('');

  filterMaterials();
}

async function listAll(path) {
  const items = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await AACD.api(path, { query: { limit: 100, offset } });
    items.push(...(page.data || []));
    if (!page.data || page.data.length < 100) break;
  }
  return items;
}

async function loadMaterials() {
  if (!window.AACD.usuario) return;
  try {
    const [materialRows, institutionRows, printerRows, alertRows, balanceRows] = await Promise.all([
      listAll('/materiais'),
      listAll('/instituicoes'),
      listAll('/impressoras'),
      AACD.api('/estoque/alertas', { query: { limit: 1000, _cachebust: Date.now() } }).then((page) => page.data || []).catch(() => []),
      AACD.api('/estoque/saldo', { query: { limit: 1000, _cachebust: Date.now() } }).then((page) => page.data || []).catch(() => []),
    ]);

    const institutions = Object.fromEntries(institutionRows.map((institution) => [institution.id, institution.nome]));
    renderInstitutionOptions(institutionRows);

    const balanceByMaterial = new Map(balanceRows.map((row) => [
      row.material_id || row.id || row.material?.id,
      row,
    ]));
    const alertIds = new Map(alertRows.map((row) => [row.material_id || row.id, row]));
    alertRows.forEach((row) => {
      const materialId = row.material_id || row.id;
      if (!materialId) return;
      const existing = balanceByMaterial.get(materialId);
      balanceByMaterial.set(materialId, {
        ...(existing || {}),
        saldo_atual: existing?.saldo_atual ?? row.saldo_atual,
        estoque_minimo: row.estoque_minimo ?? existing?.estoque_minimo,
      });
    });
    const compatibility = new Map();

    await Promise.all(printerRows.map(async (printer) => {
      try {
        const detail = await AACD.api(`/impressoras/${printer.id}`);
        (detail.materiais || []).forEach((relation) => {
          const materialId = relation.material_id || relation.material?.id;
          if (materialId) compatibility.set(materialId, (compatibility.get(materialId) || 0) + 1);
        });
      } catch {
        // A contagem segue vazia para impressoras sem dados detalhados.
      }
    }));

    const movementsByMaterial = new Map();
    await Promise.all(materialRows.map(async (row) => {
      if (balanceByMaterial.has(row.id)) return;
      try {
        const movementPage = await AACD.api(`/materiais/${row.id}/movimentacoes`, { query: { limit: 1000 } });
        const total = (movementPage.data || []).reduce((sum, movement) => {
          const quantity = Number(movement.quantidade ?? movement.quantidade_movimentada ?? 0);
          return sum + quantity;
        }, 0);
        movementsByMaterial.set(row.id, total);
      } catch {
        movementsByMaterial.set(row.id, 0);
      }
    }));

    const groupedRows = new Map();
    materialRows.forEach((row) => {
      const characteristics = row.caracteristicas || {};
      const key = [
        slug(row.nome),
        slug(row.tipo),
        slug(characteristics.marca),
        slug(row.unidade),
      ].join('|');
      if (!groupedRows.has(key)) groupedRows.set(key, []);
      groupedRows.get(key).push(row);
    });

    materials = [...groupedRows.values()].map((rows) => {
      const first = rows[0];
      const characteristics = first.caracteristicas || {};
      let quantity = 0;
      let minimum = 0;
      let compatibilityCount = 0;
      const institutionIds = new Set();

      rows.forEach((row) => {
        const balance = balanceByMaterial.get(row.id);
        const alert = alertIds.get(row.id);
        const candidates = [
          row.saldo_atual,
          balance?.saldo_atual,
          balance?.saldo,
          balance?.quantidade,
          alert?.saldo_atual,
          alert?.saldo,
          alert?.quantidade,
          movementsByMaterial.get(row.id),
        ].map((candidate) => Number(candidate)).filter((candidate) => Number.isFinite(candidate));
        const rowQuantity = candidates.find((candidate) => candidate > 0) ?? candidates.at(-1) ?? 0;
        quantity += rowQuantity;
        minimum += Number(value(balance, ['estoque_minimo', 'estoque_minimo_g', 'minimo'], value(row, ['estoque_minimo'], 0)));
        compatibilityCount += compatibility.get(row.id) || 0;
        if (row.instituicao_id) institutionIds.add(row.instituicao_id);
      });

      const base = {
        ...first,
        institutionName: institutionIds.size
          ? `Distribuído em ${institutionIds.size} ${institutionIds.size === 1 ? 'unidade' : 'unidades'}`
          : 'Instituição não informada',
        institutionSlugs: [...institutionIds].map((institutionId) => slug(institutions[institutionId])),
        quantity,
        minimum,
        tipo: first.tipo || first.categoria || 'outro',
        nome: first.nome || 'Material',
        detail: characteristics.marca
          ? `${first.tipo || 'Material'} ${characteristics.marca}${characteristics.lote ? ` - Lote ${characteristics.lote}` : ''}`
          : '',
        brand: characteristics.marca,
      };
      const alertMap = new Map(rows.map((row) => [row.id, alertIds.get(row.id)]).filter(([, alert]) => alert));
      const status = statusFromMaterial(base, alertMap);
      return {
        ...base,
        quantityLabel: formatQuantity(quantity, first.unidade, base.tipo),
        status,
        statusKind: status.kind,
        statusLabel: status.label,
        compatibilityLabel: `${compatibilityCount} ${compatibilityCount === 1 ? 'impressora' : 'impressoras'}`,
      };
    });

    renderMaterials();
    const alerts = materials.filter((material) => material.statusKind === 'critico');
    const restockMessage = document.querySelector('#restockMessage');
    const restockButton = document.querySelector('#requestButton');
    const restockAlert = document.querySelector('#restockAlert');
    const bottomGrid = restockAlert.closest('.bottom-grid');
    if (alerts.length) {
      restockMessage.textContent = `${alerts[0].nome} está crítico em ${alerts[0].institutionName}.`;
      restockAlert.hidden = false;
      restockButton.hidden = false;
      bottomGrid.classList.remove('no-restock-alert');
    } else {
      restockAlert.hidden = true;
      restockButton.hidden = true;
      bottomGrid.classList.add('no-restock-alert');
    }
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="4" class="materials-loading">${AACD.escapeHtml(AACD.errorMessage(err))}</td></tr>`;
    resultCount.textContent = 'Não foi possível carregar os materiais';
  }
}

document.querySelector('#requestButton').addEventListener('click', (event) => {
  event.currentTarget.textContent = 'Solicitação registrada';
  event.currentTarget.disabled = true;
});

loadMaterials();
