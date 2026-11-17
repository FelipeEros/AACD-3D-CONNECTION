// Tela_Pedidos_Parceira: a instituição recebe os pedidos criados pela AACD
// e avança o fluxo: aceitar/recusar -> iniciar produção -> concluir.
(function () {
  const { api, escapeHtml, fmt, STATUS_SOLICITACAO, feedback, errorMessage } = window.AACD;
  if (!window.AACD.usuario) return;

  const $ = (sel) => document.querySelector(sel);
  const tbody = $('#partnerOrders');
  const vazio = $('#partnerEmpty');
  const modal = $('#partnerModal');
  const corpo = $('#partnerModalBody');
  const acoes = $('#partnerModalActions');
  const modalFeedback = $('#partnerModalFeedback');

  let filtroStatus = 'pendente';
  let pedidos = [];
  const impressoras = {};

  // Ações disponíveis para a instituição em cada status.
  const ACOES = {
    pendente: [
      { label: 'Aceitar', classe: 'primary-action', status: 'aceita' },
      { label: 'Recusar', classe: 'danger-action', status: 'recusada', confirmar: 'Recusar este pedido?' },
    ],
    aceita: [{ label: 'Iniciar produção', classe: 'primary-action', status: 'em_producao' }],
    em_producao: [{ label: 'Concluir', classe: 'primary-action', concluir: true }],
  };

  const nomeImpressora = (id) => {
    const imp = impressoras[id];
    return imp ? `${imp.nome}${imp.modelo ? ` (${imp.modelo})` : ''}` : '—';
  };

  async function carregar() {
    try {
      if (!Object.keys(impressoras).length) {
        const { data } = await api('/impressoras', { query: { limit: 100 } });
        data.forEach((i) => { impressoras[i.id] = i; });
      }
      const res = await api('/solicitacoes', { query: { limit: 100, status: filtroStatus } });
      pedidos = res.data;
      renderizar();
    } catch (err) {
      tbody.innerHTML = '';
      vazio.textContent = errorMessage(err);
      vazio.hidden = false;
    }
  }

  function botoes(p) {
    return (ACOES[p.status] || []).map((a, i) => `
      <button class="${a.classe}" type="button" data-id="${p.id}" data-acao="${i}">${a.label}</button>`).join('');
  }

  function renderizar() {
    tbody.innerHTML = pedidos.map((p) => {
      const st = STATUS_SOLICITACAO[p.status] || { label: p.status, css: '' };
      return `
        <tr>
          <td><strong>${fmt.idCurto(p.id)}</strong><small>${escapeHtml((p.descricao || '').slice(0, 50))}</small></td>
          <td>${escapeHtml(nomeImpressora(p.impressora_id))}</td>
          <td>${fmt.data(p.prazo)}</td>
          <td>${fmt.data(p.criado_em)}</td>
          <td><span class="status ${st.css}">${escapeHtml(st.label)}</span></td>
          <td><div class="row-actions">
            <button class="secondary-action" type="button" data-id="${p.id}" data-acao="detalhes">Detalhes</button>
            ${botoes(p)}
          </div></td>
        </tr>`;
    }).join('');
    vazio.textContent = 'Nenhum pedido aqui.';
    vazio.hidden = pedidos.length > 0;
  }

  // ---- Filtros por aba ------------------------------------------------------
  document.querySelectorAll('.pr-tabs button').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pr-tabs button').forEach((t) => t.classList.toggle('active', t === tab));
      filtroStatus = tab.dataset.status;
      carregar();
    });
  });

  // ---- Ações ----------------------------------------------------------------
  async function mudarStatus(id, status) {
    await api(`/solicitacoes/${id}/status`, { method: 'POST', body: { status } });
  }

  async function executar(id, indice, onErro) {
    const p = pedidos.find((x) => x.id === id);
    const acao = ACOES[p.status]?.[indice];
    if (!acao) return;
    if (acao.concluir) return abrir(id, true);
    if (acao.confirmar && !window.confirm(acao.confirmar)) return;
    try {
      await mudarStatus(id, acao.status);
      fechar();
      carregar();
    } catch (err) {
      onErro(err);
    }
  }

  tbody.addEventListener('click', (event) => {
    const botao = event.target.closest('button[data-acao]');
    if (!botao) return;
    if (botao.dataset.acao === 'detalhes') abrir(botao.dataset.id);
    else executar(botao.dataset.id, Number(botao.dataset.acao), (err) => window.alert(errorMessage(err)));
  });

  // ---- Janela de detalhes / conclusão --------------------------------------
  async function abrir(id, concluir = false) {
    const p = pedidos.find((x) => x.id === id);
    const st = STATUS_SOLICITACAO[p.status] || { label: p.status, css: '' };
    $('#partnerModalTitle').textContent = `Pedido ${fmt.idCurto(p.id)}`;
    corpo.innerHTML = '<p>Carregando...</p>';
    acoes.innerHTML = '';
    modalFeedback.textContent = '';
    modal.hidden = false;

    try {
      const [detalhe, arquivos] = await Promise.all([
        api(`/solicitacoes/${id}`),
        api('/arquivos', { query: { solicitacao_id: id } }).catch(() => []),
      ]);
      const itens = detalhe.itens || [];
      const quantidadeSolicitada = (item) => item.quantidade ?? item.quantidade_pecas ?? item.consumo_estimado ?? 0;
      corpo.innerHTML = `
        <p><span class="status ${st.css}">${escapeHtml(st.label)}</span>
          <span class="hint" style="margin-left:8px">Recebido em ${fmt.dataHora(p.criado_em)}</span></p>
        <div class="form-grid-2" style="margin:14px 0">
          <div class="form-field">Impressora<strong>${escapeHtml(nomeImpressora(p.impressora_id))}</strong></div>
          <div class="form-field">Prazo<strong>${fmt.data(p.prazo)}</strong></div>
          <div class="form-field full">Descrição<span>${escapeHtml(p.descricao || 'Sem descrição.')}</span></div>
        </div>
        <h3 style="font:600 14px 'Space Grotesk',sans-serif;margin:16px 0 8px">${concluir ? 'Informe o consumo real de cada material' : 'Materiais'}</h3>
        ${itens.map((i) => `
          <div class="item-row" style="grid-template-columns:minmax(0,1fr) 150px">
            <div class="form-field">${escapeHtml(i.material?.nome || 'Material')}
            <span class="hint">Pedido: ${fmt.numero(quantidadeSolicitada(i), 2)} ${escapeHtml(i.material?.unidade || '')}</span></div>
            ${concluir
            ? `<label class="form-field">Consumido (${escapeHtml(i.material?.unidade || '')})<input type="number" min="0" step="0.01" data-item="${i.id || i.item_id}" value="${quantidadeSolicitada(i)}" required /></label>`
              : ''}
          </div>`).join('') || '<p class="hint">Sem itens.</p>'}
        <h3 style="font:600 14px 'Space Grotesk',sans-serif;margin:16px 0 8px">Arquivos do modelo</h3>
        <ul class="file-list">${arquivos.length
          ? arquivos.map((a) => `<li style="margin-bottom:6px"><button class="secondary-action" style="width:auto" type="button" data-arquivo="${a.id}">⬇ ${escapeHtml(a.nome_original || a.caminho_storage.split('/').pop())}</button></li>`).join('')
          : '<li class="hint">Nenhum arquivo anexado.</li>'}</ul>`;

      corpo.querySelectorAll('[data-arquivo]').forEach((b) => b.addEventListener('click', async () => {
        try {
          const { url } = await api(`/arquivos/${b.dataset.arquivo}/download`);
          window.open(url, '_blank', 'noopener');
        } catch (err) {
          feedback(modalFeedback, errorMessage(err), 'erro');
        }
      }));

      if (concluir) {
        acoes.innerHTML = '<button class="secondary-action" type="button" data-close-partner>Voltar</button><button class="primary-action" type="button" id="confirmConclude">Concluir produção</button>';
        acoes.querySelector('[data-close-partner]').addEventListener('click', fechar);
        $('#confirmConclude').addEventListener('click', () => concluirPedido(id));
      } else {
        acoes.innerHTML = botoes(p);
        acoes.querySelectorAll('button[data-acao]').forEach((b) => b.addEventListener('click', () => {
          executar(id, Number(b.dataset.acao), (err) => feedback(modalFeedback, errorMessage(err), 'erro'));
        }));
      }
    } catch (err) {
      corpo.innerHTML = '';
      feedback(modalFeedback, errorMessage(err), 'erro');
    }
  }

  async function concluirPedido(id) {
    const campos = [...corpo.querySelectorAll('input[data-item]')];
    const consumo = campos.map((c) => ({ item_id: c.dataset.item, quantidade_consumida: Number(c.value) }));
    if (consumo.some((c) => c.quantidade_consumida < 0 || Number.isNaN(c.quantidade_consumida) || campos.find((x) => x.dataset.item === c.item_id).value === '')) {
      feedback(modalFeedback, 'Informe o consumo de todos os materiais (pode ser 0).', 'erro');
      return;
    }
    const botao = $('#confirmConclude');
    botao.disabled = true;
    try {
      await api(`/solicitacoes/${id}/concluir`, { method: 'POST', body: { consumo } });
      fechar();
      carregar();
    } catch (err) {
      feedback(modalFeedback, errorMessage(err), 'erro');
      botao.disabled = false;
    }
  }

  function fechar() { modal.hidden = true; }
  document.querySelectorAll('[data-close-partner]').forEach((el) => el.addEventListener('click', fechar));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') fechar(); });

  carregar();
}());
