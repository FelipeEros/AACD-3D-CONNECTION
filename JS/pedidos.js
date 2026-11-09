const orders = [
  { id: 'PED-2024-004', institution: 'Hospital Israelita Albert Einstein', printer: 'Prusa MK3S+', material: 'PLA Flexível', date: '08/11/2024', status: 'Em produção', statusClass: 'status-production', quantity: '2 unidades', file: 'ortese-punho-v2.stl', notes: 'Imprimir com preenchimento de 30% e camada de 0,2 mm.', estimatedTime: '4h 30min', start: '08/11/2024 · 14h', end: '08/11/2024 · 18h30', progress: 3 },
  { id: 'PED-2024-003', institution: 'AACD Central', printer: 'Ultimaker S5', material: 'PLA Branco', date: '07/11/2024', status: 'Pendente', statusClass: 'status-pending', quantity: '1 unidade', file: 'modelo-anatomico-femur.stl', notes: 'Priorizar acabamento da superfície externa.', estimatedTime: '3h 15min', start: 'Aguardando aceite', end: 'A definir', progress: 1 },
  { id: 'PED-2024-002', institution: 'Santa Casa de Misericórdia', printer: 'Prusa Mini+', material: 'PETG Preto', date: '05/11/2024', status: 'Concluído', statusClass: 'status-completed', quantity: '3 unidades', file: 'suporte-personalizado-v1.stl', notes: 'Peças revisadas e prontas para retirada.', estimatedTime: '2h 40min', start: '05/11/2024 · 09h', end: '05/11/2024 · 11h40', progress: 4 },
  { id: 'PED-2024-001', institution: 'AACD Central', printer: 'Ender 3 S1', material: 'TPU Flexível', date: '02/11/2024', status: 'Cancelado', statusClass: 'status-cancelled', quantity: '1 unidade', file: 'adaptador-ergonomico.stl', notes: 'Cancelado pela instituição após alteração do projeto.', estimatedTime: '1h 50min', start: 'Não iniciado', end: 'Cancelado', progress: 0 },
];

const rows = [...document.querySelectorAll('#ordersList tr')];
const search = document.querySelector('#orderSearch');
const institution = document.querySelector('#institutionFilter');
const status = document.querySelector('#statusFilter');
const emptyState = document.querySelector('#emptyState');
const visibleCount = document.querySelector('#visibleCount');
const orderCount = document.querySelector('#orderCount');
const modal = document.querySelector('#orderModal');

function filterOrders() {
  const searchValue = search.value.trim().toLowerCase();
  const institutionValue = institution.dataset.value || '';
  const statusValue = status.dataset.value || '';
  let visible = 0;
  rows.forEach((row) => {
    const matchesSearch = !searchValue || row.dataset.search.toLowerCase().includes(searchValue);
    const matchesInstitution = !institutionValue || row.dataset.institution === institutionValue;
    const matchesStatus = !statusValue || row.dataset.status === statusValue;
    const shouldShow = matchesSearch && matchesInstitution && matchesStatus;
    row.hidden = !shouldShow;
    if (shouldShow) visible += 1;
  });
  visibleCount.textContent = `${visible} ${visible === 1 ? 'resultado' : 'resultados'}`;
  orderCount.textContent = visible;
  emptyState.classList.toggle('visible', visible === 0);
}

function showDetails(index) {
  const order = orders[index];
  document.querySelector('#modalTitle').textContent = order.id;
  document.querySelector('#modalStatus').textContent = order.status;
  document.querySelector('#modalStatus').className = `status ${order.statusClass}`;
  document.querySelector('#modalDate').textContent = `Solicitado em ${order.date}`;
  document.querySelector('#modalInstitution').textContent = order.institution;
  document.querySelector('#modalPrinter').textContent = order.printer;
  document.querySelector('#modalMaterial').textContent = order.material;
  document.querySelector('#modalQuantity').textContent = order.quantity;
  document.querySelector('#modalEstimatedTime').textContent = order.estimatedTime;
  document.querySelector('#modalStart').textContent = order.start;
  document.querySelector('#modalEnd').textContent = order.end;
  document.querySelector('#modalFile').textContent = order.file;
  document.querySelector('#modalNotes').textContent = order.notes;
  document.querySelectorAll('.progress-step').forEach((step, index) => {
    step.classList.toggle('completed', index < order.progress);
    step.classList.toggle('current', index === order.progress - 1 && order.progress > 0);
  });
  document.querySelector('#progressLine').style.width = `${Math.max(0, order.progress - 1) * 33.33}%`;
  modal.hidden = false;
  document.querySelector('.close-button').focus();
}

function closeModal() {
  modal.hidden = true;
}

document.querySelectorAll('.details-button').forEach((button) => {
  button.addEventListener('click', () => showDetails(Number(button.dataset.order)));
});
search.addEventListener('input', filterOrders);
document.querySelectorAll('.order-filter .dropdown-toggle').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const menu = button.closest('.order-filter').querySelector('.dropdown-menu');
    const shouldOpen = !menu.classList.contains('show');
    document.querySelectorAll('.order-filter .dropdown-menu').forEach((otherMenu) => {
      otherMenu.classList.remove('show');
      otherMenu.closest('.order-filter').querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
    });
    menu.classList.toggle('show', shouldOpen);
    button.setAttribute('aria-expanded', String(shouldOpen));
  });
});
document.addEventListener('click', () => {
  document.querySelectorAll('.order-filter .dropdown-menu').forEach((menu) => {
    menu.classList.remove('show');
    menu.closest('.order-filter').querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
  });
});
document.querySelectorAll('.order-filter [data-filter]').forEach((option) => {
  option.addEventListener('click', () => {
    const filterName = option.dataset.filter;
    const button = document.querySelector(`#${filterName}Filter`);
    button.dataset.value = option.dataset.value;
    button.textContent = option.textContent;
    option.closest('.dropdown-menu').querySelectorAll('.dropdown-item').forEach((item) => item.classList.toggle('active', item === option));
    filterOrders();
  });
});
document.querySelector('#clearFilters').addEventListener('click', () => {
  search.value = '';
  institution.dataset.value = '';
  institution.textContent = 'Todas';
  status.dataset.value = '';
  status.textContent = 'Todos';
  document.querySelectorAll('.order-filter .dropdown-item').forEach((item) => item.classList.toggle('active', item.dataset.value === ''));
  filterOrders();
});
document.querySelectorAll('[data-close-modal]').forEach((element) => element.addEventListener('click', closeModal));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden) closeModal();
});
