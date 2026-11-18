(function () {
  if (!window.AACD?.usuario) return;

  const selectedFilters = { institution: '', printer: '', material: '', period: '', status: '' };
  const tbody = document.querySelector('.util-table tbody');
  const footerText = document.querySelector('.table-footer span');
  const pagination = document.querySelector('.pagination');
  const pageSize = 5;
  let currentPage = 1;
  let records = [];

  function slug(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function statusInfo(status) {
    if (status === 'concluida') return { filter: 'concluido', label: 'Concluído', css: 'success' };
    if (['pendente', 'aceita', 'em_producao'].includes(status)) return { filter: 'em-andamento', label: 'Em andamento', css: 'warning' };
    return { filter: 'cancelado', label: 'Cancelado', css: 'danger' };
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

  function replaceMenu(filterName, items, defaultLabel) {
    const button = document.querySelector(`#${filterName}Filter`);
    const menu = button.closest('.dropdown').querySelector('.dropdown-menu');
    menu.innerHTML = `<li><button class="dropdown-item active" type="button" data-filter="${filterName}" data-value="">${AACD.escapeHtml(defaultLabel)}</button></li>`;
    items.forEach((item) => {
      const li = document.createElement('li');
      li.innerHTML = `<button class="dropdown-item" type="button" data-filter="${filterName}" data-value="${AACD.escapeHtml(slug(item.label))}">${AACD.escapeHtml(item.label)}</button>`;
      menu.appendChild(li);
    });
  }

  function bindDynamicDropdowns() {
    document.querySelectorAll('.dropdown-item').forEach((item) => {
      item.addEventListener('click', () => {
        const { filter, value } = item.dataset;
        const dropdown = item.closest('.dropdown');
        const button = dropdown?.querySelector('.filter-value');
        if (!button || !filter) return;
        selectedFilters[filter] = value || '';
        button.textContent = item.textContent.trim();
        dropdown.querySelectorAll('.dropdown-item').forEach((option) => option.classList.toggle('active', option === item));
        currentPage = 1;
        applyFilters();
      });
    });
  }

  function periodMatches(record, period) {
    if (!period) return true;
    if (!record.date) return false;
    const days = period === '7-dias' ? 7 : period === '30-dias' ? 30 : 90;
    const limit = new Date();
    limit.setHours(0, 0, 0, 0);
    limit.setDate(limit.getDate() - days);
    return record.date >= limit;
  }

  function getFilteredRecords() {
    return records.filter((record) => (
      (!selectedFilters.institution || record.institutionSlug === selectedFilters.institution)
      && (!selectedFilters.printer || record.printerSlug === selectedFilters.printer)
      && (!selectedFilters.material || record.materialSlug === selectedFilters.material)
      && (!selectedFilters.status || record.status.filter === selectedFilters.status)
      && periodMatches(record, selectedFilters.period)
    ));
  }

  function renderTable() {
    const filtered = getFilteredRecords();
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    const visible = filtered.slice(start, start + pageSize);

    tbody.innerHTML = visible.length
      ? visible.map((record) => `
        <tr>
          <td>${AACD.escapeHtml(record.dateLabel)}</td>
          <td>${AACD.escapeHtml(record.institutionName)}</td>
          <td>${AACD.escapeHtml(record.printerName)}</td>
          <td>${AACD.escapeHtml(record.materialName)}</td>
          <td>${AACD.escapeHtml(record.quantityLabel)}</td>
          <td><span class="status ${record.status.css}">${AACD.escapeHtml(record.status.label)}</span></td>
        </tr>`).join('')
      : '<tr><td colspan="6">Nenhum registro encontrado.</td></tr>';

    footerText.textContent = filtered.length
      ? `Mostrando ${start + 1} a ${start + visible.length} de ${filtered.length} registros`
      : 'Nenhum registro encontrado';
    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    pagination.innerHTML = '';
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'page-link';
    previous.textContent = 'Anterior';
    previous.disabled = currentPage === 1;
    previous.addEventListener('click', () => { currentPage -= 1; renderTable(); });
    pagination.appendChild(previous);

    for (let page = 1; page <= totalPages; page += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `page-number${page === currentPage ? ' active' : ''}`;
      button.textContent = page;
      button.addEventListener('click', () => { currentPage = page; renderTable(); });
      pagination.appendChild(button);
    }

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'page-link';
    next.textContent = 'Próxima';
    next.disabled = currentPage === totalPages;
    next.addEventListener('click', () => { currentPage += 1; renderTable(); });
    pagination.appendChild(next);
  }

  function applyFilters() {
    renderTable();
  }

  function clearFilters() {
    Object.keys(selectedFilters).forEach((key) => { selectedFilters[key] = ''; });
    const defaults = {
      institution: 'Todas',
      printer: 'Todas',
      material: 'Todos',
      period: 'mm/dd/yyyy',
      status: 'Todos',
    };
    Object.entries(defaults).forEach(([key, label]) => {
      document.querySelector(`#${key}Filter`).textContent = label;
    });
    document.querySelectorAll('.dropdown-menu').forEach((menu) => {
      menu.querySelectorAll('.dropdown-item').forEach((item, index) => item.classList.toggle('active', index === 0));
    });
    currentPage = 1;
    applyFilters();
  }

  async function load() {
    try {
      const pageContent = document.querySelector('.page-content');
      pageContent?.classList.add('utilizacoes-loading');
      tbody.innerHTML = '<tr><td colspan="6">Carregando utilizações...</td></tr>';
      const [solicitacoes, instituicoes, impressoras, materiais] = await Promise.all([
        listAll('/solicitacoes'),
        listAll('/instituicoes'),
        listAll('/impressoras'),
        listAll('/materiais'),
      ]);

      const institutionNames = Object.fromEntries(instituicoes.map((item) => [item.id, item.nome]));
      const printerNames = Object.fromEntries(impressoras.map((item) => [item.id, item.nome]));
      const materialNames = Object.fromEntries(materiais.map((item) => [item.id, item.nome]));

      const detailed = await Promise.all(solicitacoes.map(async (solicitacao) => {
        try {
          return await AACD.api(`/solicitacoes/${solicitacao.id}`);
        } catch {
          return solicitacao;
        }
      }));

      records = detailed.map((solicitacao) => {
        const rawDate = solicitacao.criado_em || solicitacao.created_at;
        const date = rawDate ? new Date(rawDate) : null;
        const institutionName = institutionNames[solicitacao.instituicao_id] || 'Instituição';
        const printerName = printerNames[solicitacao.impressora_id] || 'Impressora';
        const itens = solicitacao.itens || [];
        const firstItem = itens[0];
        const materialName = firstItem?.material?.nome
          || materialNames[firstItem?.material_id]
          || (itens.length > 1 ? `${itens.length} materiais` : 'Material não informado');
        const quantity = itens.reduce((sum, item) => {
          const consumed = solicitacao.status === 'concluida'
            ? item.consumo_real
            : item.consumo_estimado;
          const itemQuantity = consumed
            ?? item.quantidade
            ?? item.quantidade_pecas
            ?? 0;
          return sum + Number(itemQuantity || 0);
        }, 0);
        const unit = firstItem?.material?.unidade || 'g';

        return {
          date,
          dateLabel: date ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Data não informada',
          institutionName,
          institutionSlug: slug(institutionName),
          printerName,
          printerSlug: slug(printerName),
          materialName,
          materialSlug: slug(materialName),
          quantityLabel: `${AACD.fmt.numero(quantity, 2)}${unit}`,
          status: statusInfo(solicitacao.status),
        };
      }).sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

      const institutionItems = [...new Set(records.map((record) => record.institutionName))].sort();
      const printerItems = [...new Set(records.map((record) => record.printerName))].sort();
      const materialItems = [...new Set(records.map((record) => record.materialName))].sort();
      replaceMenu('institution', institutionItems.map((label) => ({ label })), 'Todas');
      replaceMenu('printer', printerItems.map((label) => ({ label })), 'Todas');
      replaceMenu('material', materialItems.map((label) => ({ label })), 'Todos');
      bindDynamicDropdowns();

      const now = new Date();
      const monthRecords = records.filter((record) => record.date
        && record.date.getMonth() === now.getMonth()
        && record.date.getFullYear() === now.getFullYear());
      document.querySelectorAll('.summary-card strong')[0].textContent = AACD.fmt.numero(monthRecords.length);
      document.querySelectorAll('.summary-card strong')[1].textContent = AACD.fmt.numero(new Set(records.map((record) => record.institutionName)).size);
      document.querySelectorAll('.summary-card strong')[2].textContent = AACD.fmt.numero(new Set(records.map((record) => record.printerName)).size);

      document.querySelector('.filter-button')?.addEventListener('click', clearFilters);
      applyFilters();
      pageContent?.classList.remove('utilizacoes-loading');
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="6">${AACD.escapeHtml(AACD.errorMessage(error))}</td></tr>`;
      footerText.textContent = 'Não foi possível carregar as utilizações';
      document.querySelector('.page-content')?.classList.remove('utilizacoes-loading');
    }
  }

  load();
}());
