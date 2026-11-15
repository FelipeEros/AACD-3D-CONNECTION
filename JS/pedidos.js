// Tela_Pedidos (AACD): lista, detalhes, criação e cancelamento de pedidos.
(function () {
  const { api, escapeHtml, fmt, STATUS_SOLICITACAO, feedback, errorMessage } = window.AACD;
  if (!window.AACD.usuario) return;

  const $ = (sel) => document.querySelector(sel);
  const tbody = $('#ordersList');
  const search = $('#orderSearch');
  const institutionFilter = $('#institutionFilter');
  const statusFilter = $('#statusFilter');
  const modal = $('#orderModal');

  let pedidos = [];
  const instituicoes = {};
  const impressoras = {};

  // ---- Dados de apoio (nomes de instituições e impressoras) -----------------
  async function carregarApoio() {
    const [insts, imps] = await Promise.all([
      api('/instituicoes', { query: { limit: 100 } }),
      api('/impressoras', { query: { limit: 100 } }),
    ]);
    insts.data.forEach((i) => { instituicoes[i.id] = i; });
    imps.data.forEach((i) => { impressoras[i.id] = i; });

    const menu = institutionFilter.closest('.order-filter').querySelector('.dropdown-menu');
    menu.insertAdjacentHTML('beforeend', insts.data.map((i) => `
      <li><button class="dropdown-item" type="button" data-filter="institution" data-value="${i.id}">${escapeHtml(i.nome)}</button></li>`).join(''));
    menu.querySelectorAll('[data-filter]').forEach(ligarOpcaoFiltro);
  }

  const nomeInstituicao = (id) => instituicoes[id]?.nome || 'Instituição';
  const nomeImpressora = (id) => {
    const imp = impressoras[id];
    return imp ? `${imp.nome}${imp.modelo ? ` (${imp.modelo})` : ''}` : '—';
  };

  // ---- Lista ----------------------------------------------------------------
  async function carregarPedidos() {
    $('#visibleCount').textContent = 'Carregando...';
    try {
      const res = await api('/solicitacoes', {
        query: {
          limit: 100,
          status: statusFilter.dataset.value,
          instituicao_id: institutionFilter.dataset.value,
        },
      });
      pedidos = res.data;
      $('#orderCount').textContent = res.total;
      renderizar();
    } catch (err) {
      tbody.innerHTML = '';
      $('#visibleCount').textContent = '';
      $('#emptyState').textContent = errorMessage(err);
      $('#emptyState').classList.add('visible');
    }
  }

  function renderizar() {
    const termo = search.value.trim().toLowerCase();
    const visiveis = pedidos.filter((p) => !termo
      || `${fmt.idCurto(p.id)} ${nomeInstituicao(p.instituicao_id)} ${p.observacoes || ''}`.toLowerCase().includes(termo));

    tbody.innerHTML = visiveis.map((p) => {
      const st = STATUS_SOLICITACAO[p.status] || { label: p.status, css: '' };
      return `
        <tr>
          <td><strong>${fmt.idCurto(p.id)}</strong><small>${escapeHtml((p.observacoes || '').slice(0, 40))}</small></td>
          <td><span class="institution-name"><i class="bi bi-building" aria-hidden="true"></i>${escapeHtml(nomeInstituicao(p.instituicao_id))}</span></td>
          <td>${escapeHtml(nomeImpressora(p.impressora_id))}</td>
          <td>${fmt.data(p.prazo)}</td>
          <td>${fmt.data(p.created_at)}</td>
          <td><span class="status ${st.css}">${escapeHtml(st.label)}</span></td>
          <td><button class="details-button" type="button" data-id="${p.id}">Detalhes <i class="bi bi-arrow-right" aria-hidden="true"></i></button></td>
        </tr>`;
    }).join('');

    $('#visibleCount').textContent = `${visiveis.length} ${visiveis.length === 1 ? 'resultado' : 'resultados'}`;
    $('#emptyState').textContent = pedidos.length ? 'Nenhum pedido encontrado com os filtros selecionados.' : 'Nenhum pedido cadastrado ainda.';
    $('#emptyState').classList.toggle('visible', visiveis.length === 0);
  }

  tbody.addEventListener('click', (event) => {
    const button = event.target.closest('.details-button');
    if (button) abrirDetalhes(button.dataset.id);
  });

  // ---- Filtros --------------------------------------------------------------
  search.addEventListener('input', renderizar);

  function fecharMenus() {
    document.querySelectorAll('.order-filter .dropdown-menu').forEach((menu) => {
      menu.classList.remove('show');
      menu.closest('.order-filter').querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
    });
  }

  document.querySelectorAll('.order-filter .dropdown-toggle').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const menu = button.closest('.order-filter').querySelector('.dropdown-menu');
      const abrir = !menu.classList.contains('show');
      fecharMenus();
      menu.classList.toggle('show', abrir);
      button.setAttribute('aria-expanded', String(abrir));
    });
  });
  document.addEventListener('click', fecharMenus);

  function ligarOpcaoFiltro(option) {
    if (option.dataset.ligado) return;
    option.dataset.ligado = '1';
    option.addEventListener('click', () => {
      const button = document.querySelector(`#${option.dataset.filter}Filter`);
      button.dataset.value = option.dataset.value;
      button.textContent = option.textContent;
      option.closest('.dropdown-menu').querySelectorAll('.dropdown-item')
        .forEach((item) => item.classList.toggle('active', item === option));
      carregarPedidos();
    });
  }
  document.querySelectorAll('.order-filter [data-filter]').forEach(ligarOpcaoFiltro);

  $('#clearFilters').addEventListener('click', () => {
    search.value = '';
    institutionFilter.dataset.value = '';
    institutionFilter.textContent = 'Todas';
    statusFilter.dataset.value = '';
    statusFilter.textContent = 'Todos';
    document.querySelectorAll('.order-filter .dropdown-item')
      .forEach((item) => item.classList.toggle('active', item.dataset.value === ''));
    carregarPedidos();
  });

  // ---- Detalhes -------------------------------------------------------------
  async function abrirDetalhes(id) {
    const p = pedidos.find((x) => x.id === id);
    const st = STATUS_SOLICITACAO[p.status] || { label: p.status, css: '', passo: 0 };
    $('#modalTitle').textContent = `Pedido ${fmt.idCurto(p.id)}`;
    $('#modalStatus').textContent = st.label;
    $('#modalStatus').className = `status ${st.css}`;
    $('#modalDate').textContent = `Solicitado em ${fmt.dataHora(p.created_at)}`;
    $('#modalInstitution').textContent = nomeInstituicao(p.instituicao_id);
    $('#modalPrinter').textContent = nomeImpressora(p.impressora_id);
    $('#modalMaterial').textContent = 'Carregando...';
    $('#modalQuantity').textContent = '—';
    $('#modalEstimatedTime').textContent = fmt.data(p.prazo);
    $('#modalNotes').textContent = p.observacoes || 'Sem observações.';
    $('#modalFeedback').textContent = '';

    document.querySelectorAll('.progress-step').forEach((step, i) => {
      step.classList.toggle('completed', i < st.passo);
      step.classList.toggle('current', i === st.passo - 1);
    });
    $('#progressLine').style.width = `${Math.max(0, st.passo - 1) * 33.33}%`;

    const acoes = $('#modalActions');
    acoes.innerHTML = ['pendente', 'aceita'].includes(p.status)
      ? '<button class="danger-action" type="button" id="cancelOrder">Cancelar pedido</button>'
      : '';
    $('#cancelOrder')?.addEventListener('click', () => cancelar(p.id));

    modal.hidden = false;
    modal.querySelector('.close-button').focus();

    try {
      const [detalhe, arquivos] = await Promise.all([
        api(`/solicitacoes/${id}`),
        api('/arquivos', { query: { solicitacao_id: id } }).catch(() => []),
      ]);
      const itens = detalhe.itens || [];
      $('#modalMaterial').textContent = itens.map((i) => i.material?.nome || 'Material').join(', ') || '—';
      $('#modalQuantity').textContent = itens.map((i) => `${fmt.numero(i.quantidade, 2)} ${i.material?.unidade || ''}`.trim()).join(' + ') || '—';
      mostrarArquivo(arquivos[0]);
    } catch (err) {
      feedback($('#modalFeedback'), errorMessage(err), 'erro');
    }
  }

  function mostrarArquivo(arquivo) {
    const botao = document.querySelector('.file-button');
    $('#modalFile').textContent = arquivo ? (arquivo.nome_original || arquivo.caminho_storage.split('/').pop()) : 'Nenhum arquivo anexado';
    botao.hidden = !arquivo;
    botao.onclick = async () => {
      try {
        const { url } = await api(`/arquivos/${arquivo.id}/download`);
        window.open(url, '_blank', 'noopener');
      } catch (err) {
        feedback($('#modalFeedback'), errorMessage(err), 'erro');
      }
    };
  }

  async function cancelar(id) {
    if (!window.confirm('Cancelar este pedido? A instituição deixará de vê-lo como pendente.')) return;
    try {
      await api(`/solicitacoes/${id}/cancelar`, { method: 'POST' });
      fecharDetalhes();
      carregarPedidos();
    } catch (err) {
      feedback($('#modalFeedback'), errorMessage(err), 'erro');
    }
  }

  function fecharDetalhes() { modal.hidden = true; }
  document.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', fecharDetalhes));

  // ---- Novo pedido ----------------------------------------------------------
  const novoModal = $('#newOrderModal');
  const form = $('#newOrderForm');
  const selInst = $('#newInstitution');
  const selImp = $('#newPrinter');
  const itensBox = $('#newItems');
  const addItem = $('#addItem');
  const novoFeedback = $('#newOrderFeedback');
  let materiaisCompativeis = [];

  $('#newOrderButton').addEventListener('click', () => {
    form.reset();
    itensBox.innerHTML = '';
    novoFeedback.textContent = '';
    selImp.disabled = true;
    addItem.disabled = true;
    // Só instituições aprovadas/ativas podem receber pedidos.
    const ativas = Object.values(instituicoes).filter((i) => !['pendente', 'rejeitada', 'recusada', 'inativa', 'desativada'].includes(i.status));
    selInst.innerHTML = '<option value="">Selecione</option>' + ativas
      .map((i) => `<option value="${i.id}">${escapeHtml(i.nome)}</option>`).join('');
    novoModal.hidden = false;
    selInst.focus();
  });

  const fecharNovo = () => { novoModal.hidden = true; };
  document.querySelectorAll('[data-close-new]').forEach((el) => el.addEventListener('click', fecharNovo));

  selInst.addEventListener('change', async () => {
    itensBox.innerHTML = '';
    addItem.disabled = true;
    selImp.disabled = true;
    if (!selInst.value) return;
    selImp.innerHTML = '<option value="">Carregando...</option>';
    try {
      const { data } = await api('/impressoras', { query: { instituicao_id: selInst.value, limit: 100 } });
      const usaveis = data.filter((i) => i.status !== 'indisponivel');
      selImp.innerHTML = usaveis.length
        ? '<option value="">Selecione</option>' + usaveis.map((i) => `<option value="${i.id}">${escapeHtml(nomeImpressora(i.id) === '—' ? i.nome : nomeImpressora(i.id))} — ${escapeHtml(window.AACD.STATUS_IMPRESSORA[i.status] || i.status)}</option>`).join('')
        : '<option value="">Nenhuma impressora disponível</option>';
      selImp.disabled = !usaveis.length;
    } catch (err) {
      feedback(novoFeedback, errorMessage(err), 'erro');
    }
  });

  selImp.addEventListener('change', async () => {
    itensBox.innerHTML = '';
    addItem.disabled = true;
    if (!selImp.value) return;
    try {
      const vinculos = await api(`/impressoras/${selImp.value}/materiais`);
      materiaisCompativeis = vinculos.map((v) => v.material).filter(Boolean);
      if (!materiaisCompativeis.length) {
        feedback(novoFeedback, 'Esta impressora não tem materiais compatíveis cadastrados.', 'erro');
        return;
      }
      novoFeedback.textContent = '';
      addItem.disabled = false;
      adicionarItem();
    } catch (err) {
      feedback(novoFeedback, errorMessage(err), 'erro');
    }
  });

  function adicionarItem() {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <label class="form-field">Material<select class="item-material" required>
        ${materiaisCompativeis.map((m) => `<option value="${m.id}">${escapeHtml(m.nome)}${m.cor ? ` — ${escapeHtml(m.cor)}` : ''}</option>`).join('')}
      </select></label>
      <label class="form-field">Quantidade<input class="item-qtd" type="number" min="0.01" step="0.01" value="1" required /></label>
      <button class="item-remove" type="button" aria-label="Remover material">&times;</button>`;
    row.querySelector('.item-remove').addEventListener('click', () => {
      if (itensBox.children.length > 1) row.remove();
    });
    itensBox.appendChild(row);
  }
  addItem.addEventListener('click', adicionarItem);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const itens = [...itensBox.querySelectorAll('.item-row')].map((row) => ({
      material_id: row.querySelector('.item-material').value,
      quantidade: Number(row.querySelector('.item-qtd').value),
    }));
    if (!selInst.value || !selImp.value || !itens.length) {
      feedback(novoFeedback, 'Escolha a instituição, a impressora e ao menos um material.', 'erro');
      return;
    }
    if (itens.some((i) => !(i.quantidade > 0))) {
      feedback(novoFeedback, 'As quantidades devem ser maiores que zero.', 'erro');
      return;
    }

    const body = { instituicao_id: selInst.value, impressora_id: selImp.value, itens };
    if ($('#newDeadline').value) body.prazo = $('#newDeadline').value;
    if ($('#newNotes').value.trim()) body.observacoes = $('#newNotes').value.trim();

    const submit = $('#newOrderSubmit');
    submit.disabled = true;
    feedback(novoFeedback, 'Criando pedido...', 'info');
    try {
      const pedido = await api('/solicitacoes', { method: 'POST', body });
      const arquivo = $('#newFile').files[0];
      if (arquivo) {
        feedback(novoFeedback, 'Enviando arquivo do modelo...', 'info');
        const dados = new FormData();
        dados.append('arquivo', arquivo);
        dados.append('solicitacao_id', pedido.id);
        try {
          await api('/arquivos', { method: 'POST', form: dados });
        } catch (err) {
          window.alert(`O pedido foi criado, mas o arquivo não foi enviado: ${errorMessage(err)}`);
        }
      }
      fecharNovo();
      carregarPedidos();
    } catch (err) {
      feedback(novoFeedback, errorMessage(err), 'erro');
    } finally {
      submit.disabled = false;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    fecharDetalhes();
    fecharNovo();
  });

  carregarApoio().catch(() => {}).finally(carregarPedidos);
}());
