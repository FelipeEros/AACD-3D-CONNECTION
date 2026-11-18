const filters = {
  state: { value: '' },
  city: { value: '' },
  status: { value: '' },
};

const grid = document.querySelector('#institutionGrid');
const noResults = document.querySelector('#noResults');
const clearFilters = document.querySelector('#clearFilters');
const detailsModal = document.querySelector('#institutionDetailsModal');
const reviewModal = document.querySelector('#requestReviewModal');
const reviewFeedback = document.querySelector('#reviewFeedback');

let institutions = [];
let printerCounts = {};

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function statusKind(status) {
  const value = slug(status);
  if (['pendente', 'pending', 'aguardando', 'solicitada'].includes(value)) return 'pending';
  if (['rejeitada', 'recusada', 'rejected', 'inativa', 'desativada', 'inactive'].includes(value)) return 'inactive';
  return 'active';
}

function statusLabel(status) {
  return {
    active: 'ATIVA',
    pending: 'PENDENTE',
    inactive: 'INATIVA',
  }[statusKind(status)];
}

function locationData(institution) {
  const state = institution.estado || institution.state || '';
  const city = institution.cidade || institution.city || '';
  if (!city && institution.endereco) {
    const endereco = institution.endereco;
    const match = endereco.match(/(?:-\s*|,\s*)([^,\-]+)\s*-\s*([A-Za-z]{2})$/);
    if (match) return { city: match[1].trim(), state: match[2].trim().toUpperCase() };
  }
  return { city, state };
}

function toDate(value) {
  return value ? AACD.fmt.data(value) : '—';
}

function institutionCard(institution) {
  const kind = statusKind(institution.status);
  const location = locationData(institution);
  const printerCount = printerCounts[institution.id] ?? 0;
  const stateSlug = slug(location.state);
  const citySlug = slug(location.city);

  if (kind === 'pending') {
    return `
      <article class="institution-card" data-state="${AACD.escapeHtml(stateSlug)}" data-city="${AACD.escapeHtml(citySlug)}" data-status="pending" data-id="${AACD.escapeHtml(institution.id)}">
        <div class="card-top">
          <span class="institution-icon pending-icon"><i class="bi bi-building" aria-hidden="true"></i></span>
          <span class="status pending-status">● PENDENTE</span>
        </div>
        <h2 title="${AACD.escapeHtml(institution.nome)}">${AACD.escapeHtml(institution.nome)}</h2>
        <p class="location"><span class="location-icon"><i class="bi bi-geo-alt" aria-hidden="true"></i></span><span class="location-text">${AACD.escapeHtml(location.city || 'Cidade não informada')}${location.state ? `, ${AACD.escapeHtml(location.state)}` : ''}</span></p>
        <div class="card-details">
          <div class="detail-box"><strong>Impressoras</strong><span class="printer-value muted-value"><span class="detail-icon"><i class="bi bi-printer" aria-hidden="true"></i></span><span class="printer-number">--</span></span></div>
          <div class="detail-box"><strong>Solicitado em</strong><span>${AACD.escapeHtml(toDate(institution.criado_em || institution.created_at))}</span></div>
        </div>
        <button class="card-button" type="button" data-action="review" data-id="${AACD.escapeHtml(institution.id)}"><span class="card-button-text">Avaliar Solicitação</span><i class="bi bi-arrow-right" aria-hidden="true"></i></button>
      </article>`;
  }

  return `
    <article class="institution-card" data-state="${AACD.escapeHtml(stateSlug)}" data-city="${AACD.escapeHtml(citySlug)}" data-status="${kind}" data-id="${AACD.escapeHtml(institution.id)}">
      <div class="card-top">
        <span class="institution-icon"><i class="bi bi-building" aria-hidden="true"></i></span>
        <span class="status ${kind === 'active' ? 'active-status' : 'inactive-status'}">● ${statusLabel(institution.status)}</span>
      </div>
      <h2 title="${AACD.escapeHtml(institution.nome)}">${AACD.escapeHtml(institution.nome)}</h2>
      <p class="location"><span class="location-icon"><i class="bi bi-geo-alt" aria-hidden="true"></i></span><span class="location-text">${AACD.escapeHtml(location.city || 'Cidade não informada')}${location.state ? `, ${AACD.escapeHtml(location.state)}` : ''}</span></p>
      <div class="card-details">
        <div class="detail-box"><strong>Impressoras</strong><span class="printer-value"><span class="detail-icon"><i class="bi bi-printer" aria-hidden="true"></i></span><span class="printer-number">${AACD.fmt.numero(printerCount)}</span></span></div>
        <div class="detail-box"><strong>Cadastrado em</strong><span>${AACD.escapeHtml(toDate(institution.criado_em || institution.created_at))}</span></div>
      </div>
      <button class="card-button" type="button" data-action="view" data-id="${AACD.escapeHtml(institution.id)}"><span class="card-button-text">Ver Instituição</span><i class="bi bi-arrow-right" aria-hidden="true"></i></button>
    </article>`;
}

function renderInstitutions() {
  const active = institutions.filter((item) => statusKind(item.status) !== 'pending');
  const pending = institutions.filter((item) => statusKind(item.status) === 'pending');

  grid.innerHTML = [
    `<h2 class="institution-section-title">Instituições cadastradas</h2>`,
    active.map(institutionCard).join(''),
    pending.length ? `<h2 class="institution-section-title">Solicitações pendentes</h2>${pending.map(institutionCard).join('')}` : '',
  ].join('');

  filterInstitutions();
}

function filterInstitutions() {
  let visibleCards = 0;
  grid.querySelectorAll('.institution-card').forEach((card) => {
    const matches = Object.entries(filters).every(([key, filter]) => !filter.value || card.dataset[key] === filter.value);
    card.hidden = !matches;
    if (matches) visibleCards += 1;
  });

  grid.querySelectorAll('.institution-section-title').forEach((title) => {
    let sibling = title.nextElementSibling;
    let hasVisibleCard = false;
    while (sibling && !sibling.classList.contains('institution-section-title')) {
      if (sibling.classList.contains('institution-card') && !sibling.hidden) hasVisibleCard = true;
      sibling = sibling.nextElementSibling;
    }
    title.hidden = !hasVisibleCard;
  });
  noResults.classList.toggle('visible', visibleCards === 0);
}

function addFilterOption(filterName, value, label) {
  if (!value) return;
  const menu = document.querySelector(`#${filterName}Filter`).closest('.dropdown').querySelector('.dropdown-menu');
  const slugValue = slug(value);
  if (menu.querySelector(`[data-value="${slugValue}"]`)) return;
  const li = document.createElement('li');
  li.innerHTML = `<button class="dropdown-item" type="button" data-filter="${filterName}" data-value="${AACD.escapeHtml(slugValue)}">${AACD.escapeHtml(label)}</button>`;
  menu.appendChild(li);
  li.firstElementChild.addEventListener('click', selectFilter);
}

function selectFilter() {
  const filterName = this.dataset.filter;
  filters[filterName].value = this.dataset.value;
  document.querySelector(`#${filterName}Filter`).textContent = this.textContent;
  this.closest('.dropdown-menu').querySelectorAll('.dropdown-item').forEach((item) => item.classList.toggle('active', item === this));
  filterInstitutions();
}

document.querySelectorAll('[data-filter]').forEach((option) => option.addEventListener('click', selectFilter));

clearFilters.addEventListener('click', () => {
  Object.keys(filters).forEach((filterName) => {
    filters[filterName].value = '';
    const button = document.querySelector(`#${filterName}Filter`);
    button.textContent = filterName === 'state' ? 'Estado' : filterName === 'city' ? 'Cidade' : 'Status';
    button.closest('.dropdown').querySelectorAll('.dropdown-item').forEach((item, index) => item.classList.toggle('active', index === 0));
  });
  filterInstitutions();
});

function fillDetails(institution) {
  const kind = statusKind(institution.status);
  const location = locationData(institution);
  document.querySelector('#institutionDetailsTitle').textContent = institution.nome || 'Instituição';
  const statusRow = detailsModal.querySelector('.modal-status-row');
  statusRow.innerHTML = `
    <span class="status ${kind === 'active' ? 'active-status' : 'inactive-status'}">● ${statusLabel(institution.status)}</span>
    <span class="modal-muted"><i class="bi bi-geo-alt" aria-hidden="true"></i> ${AACD.escapeHtml(location.city || 'Cidade não informada')}${location.state ? `, ${AACD.escapeHtml(location.state)}` : ''}</span>`;

  const items = detailsModal.querySelectorAll('.summary-item');
  items[0].querySelector('strong').textContent = institution.responsavel || 'Não informado';
  items[1].querySelector('strong').textContent = institution.email || 'Não informado';
  items[2].querySelector('strong').textContent = `${AACD.fmt.numero(printerCounts[institution.id] ?? 0)} impressoras`;
  items[3].querySelector('strong').textContent = toDate(institution.criado_em || institution.created_at);

  const section = detailsModal.querySelector('.modal-section p');
  section.textContent = institution.observacoes
    || 'Esta instituição faz parte da rede AACD 3D Connect e pode compartilhar impressoras e materiais.';
}

function fillReview(institution) {
  const location = locationData(institution);
  document.querySelector('#requestReviewTitle').textContent = institution.nome || 'Instituição';
  const statusRow = reviewModal.querySelector('.modal-status-row');
  statusRow.innerHTML = `
    <span class="status pending-status">● PENDENTE</span>
    <span class="modal-muted"><i class="bi bi-calendar3" aria-hidden="true"></i> Solicitado em ${AACD.escapeHtml(toDate(institution.criado_em || institution.created_at))}</span>`;

  const items = reviewModal.querySelectorAll('.summary-item');
  items[0].querySelector('strong').textContent = location.city
    ? `${location.city}${location.state ? `, ${location.state}` : ''}`
    : institution.endereco || 'Não informado';
  items[1].querySelector('strong').textContent = institution.responsavel || 'Não informado';
  items[2].querySelector('strong').textContent = institution.email || 'Não informado';
  items[3].querySelector('strong').textContent = institution.telefone || 'Não informado';

  const message = reviewModal.querySelector('.modal-section p');
  message.textContent = institution.observacoes
    || institution.mensagem
    || 'Solicitou integrar sua unidade ao hub para ampliar o acesso à manufatura de órteses e próteses.';
  reviewModal.dataset.institutionId = institution.id;
  reviewFeedback.textContent = '';
  reviewFeedback.className = 'review-feedback';
}

grid.addEventListener('click', (event) => {
  const button = event.target.closest('.card-button');
  if (!button) return;
  const institution = institutions.find((item) => item.id === button.dataset.id);
  if (!institution) return;

  if (button.dataset.action === 'review') {
    fillReview(institution);
    bootstrap.Modal.getOrCreateInstance(reviewModal).show();
  } else {
    fillDetails(institution);
    bootstrap.Modal.getOrCreateInstance(detailsModal).show();
  }
});

document.querySelectorAll('[data-review-action]').forEach((button) => {
  button.addEventListener('click', async () => {
    const institutionId = reviewModal.dataset.institutionId;
    const approved = button.dataset.reviewAction === 'approve';
    const actionButtons = document.querySelectorAll('[data-review-action]');
    actionButtons.forEach((actionButton) => { actionButton.disabled = true; });

    try {
      await AACD.api(`/instituicoes/${institutionId}/${approved ? 'aprovar' : 'rejeitar'}`, { method: 'POST' });
      institutions = institutions.map((item) => item.id === institutionId
        ? { ...item, status: approved ? 'ativa' : 'rejeitada' }
        : item);
      reviewFeedback.textContent = approved
        ? 'Solicitação aprovada. Um convite de acesso foi solicitado para o e-mail da instituição.'
        : 'Solicitação recusada e removida da fila de pendências.';
      reviewFeedback.className = `review-feedback visible ${approved ? 'success' : 'rejected'}`;
      renderInstitutions();
    } catch (err) {
      reviewFeedback.textContent = AACD.errorMessage(err);
      reviewFeedback.className = 'review-feedback visible rejected';
      actionButtons.forEach((actionButton) => { actionButton.disabled = false; });
    }
  });
});

reviewModal.addEventListener('hidden.bs.modal', () => {
  reviewFeedback.textContent = '';
  reviewFeedback.className = 'review-feedback';
  document.querySelectorAll('[data-review-action]').forEach((button) => { button.disabled = false; });
});

async function listAll(path, query = {}) {
  const items = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await AACD.api(path, { query: { ...query, limit: 100, offset } });
    items.push(...(page.data || []));
    if (!page.data || page.data.length < 100) break;
  }
  return items;
}

async function loadInstitutions() {
  if (!window.AACD.usuario) return;
  grid.innerHTML = '<p class="institution-loading">Carregando instituições...</p>';

  try {
    const [institutionRows, printerRows] = await Promise.all([
      listAll('/instituicoes'),
      listAll('/impressoras').catch(() => []),
    ]);
    institutions = institutionRows;
    printerCounts = printerRows.reduce((counts, printer) => {
      const institutionId = printer.instituicao_id;
      if (institutionId) counts[institutionId] = (counts[institutionId] || 0) + 1;
      return counts;
    }, {});

    institutions.forEach((institution) => {
      const location = locationData(institution);
      addFilterOption('state', location.state, location.state);
      addFilterOption('city', location.city, location.city);
    });
    renderInstitutions();
  } catch (err) {
    grid.innerHTML = `<p class="institution-error">${AACD.escapeHtml(AACD.errorMessage(err))}</p>`;
  }
}

loadInstitutions();
