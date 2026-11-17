const printerRegistrationModal = document.querySelector('#printerRegistrationModal');
const printerRegistrationButton = document.querySelector('#openPrinterRegistration');
const printerRegistrationForm = document.querySelector('#printerRegistrationForm');
const printerFormFeedback = document.querySelector('#printerFormFeedback');
const printerSubmitButton = printerRegistrationForm.querySelector('button[type="submit"]');
const materialSelect = printerRegistrationForm.elements.material_id;
const printerGrid = document.querySelector('.printer-grid');
const summaryValues = document.querySelectorAll('.summary-bar strong');
const printerDetailsModal = document.querySelector('#printerDetailsModal');
const printerDetailsContent = document.querySelector('#printerDetailsContent');
const printerRegistrationTitle = document.querySelector('#printerRegistrationTitle');
const printerRegistrationDescription = document.querySelector('.printer-modal-description');
let editingPrinterId = null;

function showPrinterFeedback(message, type = 'info') {
  printerFormFeedback.textContent = message;
  printerFormFeedback.className = `printer-form-feedback visible ${type}`;
}

async function loadMaterials() {
  try {
    const response = await AACD.api('/materiais', { query: { limit: 100 } });
    const materials = response.data || [];
    materialSelect.innerHTML = materials.length
      ? '<option value="" selected disabled>Selecione</option>'
      : '<option value="" selected disabled>Nenhum material cadastrado</option>';
    materials.forEach((material) => {
      const option = document.createElement('option');
      option.value = material.id;
      option.textContent = material.nome;
      materialSelect.append(option);
    });
  } catch (error) {
    materialSelect.innerHTML = '<option value="" selected disabled>Não foi possível carregar</option>';
    showPrinterFeedback(AACD.errorMessage(error), 'error');
  }
}

function printerStatus(status) {
  const labels = { disponivel: 'OPERANTE', ocupada: 'OCUPADA', indisponivel: 'MANUTENÇÃO' };
  return labels[status] || status || 'SEM STATUS';
}

function renderPrinters(printers) {
  printerGrid.innerHTML = printers.length ? printers.map((printer) => {
    const details = printer.especificacoes || {};
    const status = printer.status || 'disponivel';
    const imageClass = status === 'indisponivel' ? 'printer-image-gray' : 'printer-image-purple';
    return `
      <article class="printer-card" data-printer-id="${AACD.escapeHtml(printer.id)}">
        <div class="printer-image ${imageClass}">
          <span class="status ${status === 'ocupada' ? 'status-busy' : status === 'indisponivel' ? 'status-maintenance' : 'status-operating'}"><i></i>${printerStatus(status)}</span>
          <i class="bi bi-printer" aria-hidden="true"></i>
        </div>
        <div class="printer-body">
          <h2>${AACD.escapeHtml(printer.nome)}</h2>
          <small class="printer-id">ID: ${AACD.escapeHtml(printer.id?.slice(0, 8).toUpperCase())}</small>
          <dl>
            <div><dt>Fabricante</dt><dd>${AACD.escapeHtml(details.fabricante || '—')}</dd></div>
            <div><dt>Modelo</dt><dd>${AACD.escapeHtml(printer.modelo || '—')}</dd></div>
            <div><dt>Tecnologia</dt><dd>${AACD.escapeHtml(printer.tecnologia || '—')}</dd></div>
          </dl>
          <div class="card-actions">
            <button type="button" class="details-button details-printer">Detalhes</button>
            <button type="button" class="icon-action edit-printer" aria-label="Editar impressora"><i class="bi bi-pencil" aria-hidden="true"></i></button>
            <button type="button" class="icon-action danger delete-printer" aria-label="Excluir impressora"><i class="bi bi-trash3" aria-hidden="true"></i></button>
          </div>
        </div>
      </article>`;
  }).join('') : '<p>Nenhuma impressora cadastrada.</p>';

  summaryValues[0].textContent = printers.filter(({ status }) => status !== 'indisponivel').length;
  summaryValues[1].textContent = printers.filter(({ status }) => status === 'indisponivel').length;
  summaryValues[2].textContent = '—';
  document.querySelector('.summary-bar').classList.remove('is-loading');
  document.querySelector('.printer-grid').classList.remove('is-loading');
  document.querySelector('.summary-bar').setAttribute('aria-busy', 'false');
  document.querySelector('.printer-grid').setAttribute('aria-busy', 'false');
}

async function loadPrinters() {
  const response = await AACD.api('/impressoras', { query: { limit: 100 } });
  renderPrinters(response.data || []);
}

printerGrid.addEventListener('click', async (event) => {
  const detailsButton = event.target.closest('.details-printer');
  const editButton = event.target.closest('.edit-printer');
  const deleteButton = event.target.closest('.delete-printer');
  const card = event.target.closest('.printer-card');
  if (!card) return;

  if (detailsButton) {
    try {
      const printer = await AACD.api(`/impressoras/${card.dataset.printerId}`);
      const details = printer.especificacoes || {};
      const materials = (printer.materiais || [])
        .map(({ material }) => material?.nome)
        .filter(Boolean)
        .join(', ');
      printerDetailsContent.innerHTML = `
        <dl class="printer-details-content">
          <div><dt>Nome</dt><dd>${AACD.escapeHtml(printer.nome)}</dd></div>
          <div><dt>Fabricante</dt><dd>${AACD.escapeHtml(details.fabricante || '—')}</dd></div>
          <div><dt>Modelo</dt><dd>${AACD.escapeHtml(printer.modelo || '—')}</dd></div>
          <div><dt>Número de série</dt><dd>${AACD.escapeHtml(details.numero_serie || '—')}</dd></div>
          <div><dt>Tecnologia</dt><dd>${AACD.escapeHtml(printer.tecnologia || '—')}</dd></div>
          <div><dt>Status</dt><dd>${AACD.escapeHtml(printerStatus(printer.status))}</dd></div>
          <div><dt>Materiais</dt><dd>${AACD.escapeHtml(materials || '—')}</dd></div>
        </dl>`;
      printerDetailsModal.classList.add('is-open');
      printerDetailsModal.setAttribute('aria-hidden', 'false');
    } catch (error) {
      window.alert(AACD.errorMessage(error));
    }
    return;
  }

  if (editButton) {
    try {
      const printer = await AACD.api(`/impressoras/${card.dataset.printerId}`);
      await materialsReady;
      openPrinterEdit(printer);
    } catch (error) {
      window.alert(AACD.errorMessage(error));
    }
    return;
  }

  if (!deleteButton) return;

  const printerName = card.querySelector('h2')?.textContent || 'esta impressora';
  if (!window.confirm(`Tem certeza que deseja excluir "${printerName}"? Essa ação não pode ser desfeita.`)) return;

  deleteButton.disabled = true;
  try {
    await AACD.api(`/impressoras/${card.dataset.printerId}`, { method: 'DELETE' });
    await loadPrinters();
  } catch (error) {
    deleteButton.disabled = false;
    window.alert(AACD.errorMessage(error));
  }
});

function closePrinterDetails() {
  printerDetailsModal.classList.remove('is-open');
  printerDetailsModal.setAttribute('aria-hidden', 'true');
  printerDetailsContent.textContent = '';
}

function openPrinterEdit(printer) {
  const details = printer.especificacoes || {};
  editingPrinterId = printer.id;
  printerRegistrationTitle.textContent = 'Editar impressora';
  printerRegistrationDescription.textContent = 'Atualize os dados da impressora da sua instituição.';
  printerSubmitButton.textContent = 'Salvar alterações';
  printerRegistrationForm.elements.name.value = printer.nome || '';
  printerRegistrationForm.elements.manufacturer.value = details.fabricante || '';
  printerRegistrationForm.elements.model.value = printer.modelo || '';
  printerRegistrationForm.elements.serialNumber.value = details.numero_serie || '';
  printerRegistrationForm.elements.technology.value = printer.tecnologia || '';
  materialSelect.required = false;
  materialSelect.value = printer.materiais?.[0]?.material?.id || printer.materiais?.[0]?.material_id || '';
  printerRegistrationModal.classList.add('is-open');
  printerRegistrationModal.setAttribute('aria-hidden', 'false');
  printerRegistrationForm.elements.name.focus();
}

function closePrinterRegistration() {
  printerRegistrationModal.classList.remove('is-open');
  printerRegistrationModal.setAttribute('aria-hidden', 'true');
  printerRegistrationForm.reset();
  materialSelect.innerHTML = '<option value="" selected disabled>Selecione</option>';
  printerFormFeedback.textContent = '';
  printerFormFeedback.className = 'printer-form-feedback';
  printerSubmitButton.disabled = false;
  printerSubmitButton.textContent = 'Cadastrar impressora';
  printerRegistrationTitle.textContent = 'Cadastrar impressora';
  printerRegistrationDescription.textContent = 'Preencha os dados da impressora para adicioná-la ao parque da sua instituição.';
  materialSelect.required = true;
  editingPrinterId = null;
}

printerRegistrationButton.addEventListener('click', () => {
  editingPrinterId = null;
  printerRegistrationTitle.textContent = 'Cadastrar impressora';
  printerRegistrationDescription.textContent = 'Preencha os dados da impressora para adicioná-la ao parque da sua instituição.';
  printerSubmitButton.textContent = 'Cadastrar impressora';
  materialSelect.required = true;
  printerRegistrationModal.classList.add('is-open');
  printerRegistrationModal.setAttribute('aria-hidden', 'false');
  printerRegistrationForm.querySelector('input')?.focus();
});

printerRegistrationModal.querySelectorAll('[data-printer-modal-close]').forEach((closeButton) => {
  closeButton.addEventListener('click', closePrinterRegistration);
});

printerRegistrationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!printerRegistrationForm.checkValidity()) {
    printerRegistrationForm.reportValidity();
    return;
  }
  const formData = new FormData(printerRegistrationForm);
  const payload = {
    nome: formData.get('name'),
    fabricante: formData.get('manufacturer'),
    modelo: formData.get('model'),
    numero_serie: formData.get('serialNumber'),
    tecnologia: formData.get('technology'),
  };
  if (editingPrinterId) {
    payload.material_ids = formData.get('material_id') ? [formData.get('material_id')] : [];
  } else {
    payload.material_ids = [formData.get('material_id')];
  }

  printerSubmitButton.disabled = true;
  showPrinterFeedback(editingPrinterId ? 'Salvando alterações...' : 'Cadastrando impressora...', 'info');
  AACD.api(editingPrinterId ? `/impressoras/${editingPrinterId}` : '/impressoras', {
    method: editingPrinterId ? 'PATCH' : 'POST',
    body: payload,
  })
    .then(() => {
      showPrinterFeedback(editingPrinterId ? 'Alterações salvas com sucesso.' : 'Impressora cadastrada com sucesso.', 'success');
      return loadPrinters().then(() => window.setTimeout(closePrinterRegistration, 1200));
    })
    .catch((error) => {
      printerSubmitButton.disabled = false;
      showPrinterFeedback(AACD.errorMessage(error), 'error');
    });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && printerRegistrationModal.classList.contains('is-open')) {
    closePrinterRegistration();
  }
  if (event.key === 'Escape' && printerDetailsModal.classList.contains('is-open')) {
    closePrinterDetails();
  }
});

printerDetailsModal.querySelectorAll('[data-printer-details-close]').forEach((button) => {
  button.addEventListener('click', closePrinterDetails);
});

const materialsReady = loadMaterials();
loadPrinters().catch((error) => {
  printerGrid.innerHTML = `<p>${AACD.escapeHtml(AACD.errorMessage(error))}</p>`;
  printerGrid.classList.remove('is-loading');
  printerGrid.setAttribute('aria-busy', 'false');
});
