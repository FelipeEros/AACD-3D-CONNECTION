// Tela_Dashboard (AACD): preenche indicadores com dados reais da API.
(function () {
  const { api, escapeHtml, fmt, STATUS_SOLICITACAO } = window.AACD;
  if (!window.AACD.usuario) return;

  const cards = document.querySelectorAll('.stats-grid .stat-card strong');
  const ranking = document.querySelector('.ranking-list');
  const timeline = document.querySelector('.timeline');
  const donut = document.querySelector('.donut');
  const legend = document.querySelector('.materials-legend');
  const RANK_CORES = ['rank-red', 'rank-gray', 'rank-blue', 'rank-brown'];

  // Busca até 1.000 registros em páginas de 100.
  async function listarTudo(path, query = {}) {
    const itens = [];
    for (let offset = 0; offset < 1000; offset += 100) {
      const page = await api(path, { query: { ...query, limit: 100, offset } });
      itens.push(...page.data);
      if (page.data.length < 100) break;
    }
    return itens;
  }

  function vazio(el, texto) {
    el.innerHTML = `<p style="color:#766d6d;font-size:10px;margin:12px 0">${escapeHtml(texto)}</p>`;
  }

  async function carregar() {
    const [resumo, instituicoes, concluidas] = await Promise.all([
      api('/dashboard'),
      listarTudo('/instituicoes'),
      listarTudo('/solicitacoes', { status: 'concluida' }),
    ]);
    const nomes = Object.fromEntries(instituicoes.map((i) => [i.id, i.nome]));

    // Cards
    const valores = [
      resumo.instituicoes?.total ?? instituicoes.length,
      resumo.solicitacoes.por_status.pendente ?? 0,
      resumo.impressoras.total,
      resumo.materiais.total,
    ];
    cards.forEach((el, i) => { el.textContent = fmt.numero(valores[i]); });

    // Instituições que mais produziram (pedidos concluídos)
    const contagem = {};
    concluidas.forEach((s) => { contagem[s.instituicao_id] = (contagem[s.instituicao_id] || 0) + 1; });
    const top = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 4);
    if (!top.length) vazio(ranking, 'Nenhuma impressão concluída ainda.');
    else {
      ranking.innerHTML = top.map(([id, total], i) => `
        <div class="ranking-row">
          <div class="row-label"><strong>${escapeHtml(nomes[id] || 'Instituição')}</strong><span>${fmt.numero(total)} ${total === 1 ? 'impressão' : 'impressões'}</span></div>
          <div class="rank-track"><i class="${RANK_CORES[i]}" style="width:${Math.round((total / top[0][1]) * 100)}%"></i></div>
        </div>`).join('');
    }

    // Atividades recentes = últimas solicitações
    const recentes = resumo.solicitacoes_recentes || [];
    if (!recentes.length) vazio(timeline, 'Nenhuma atividade recente.');
    else {
      timeline.innerHTML = recentes.map((s) => {
        const st = STATUS_SOLICITACAO[s.status] || { label: s.status };
        return `
          <div class="timeline-item ${s.status === 'pendente' ? 'critical' : ''}">
            <span class="timeline-dot"></span>
            <small>${fmt.dataHora(s.created_at)}</small>
            <p>Pedido <b>${fmt.idCurto(s.id)}</b> — ${escapeHtml(nomes[s.instituicao_id] || 'Instituição')}: ${escapeHtml(st.label)}.</p>
          </div>`;
      }).join('');
    }
    document.querySelector('.load-button')?.addEventListener('click', () => { location.href = 'Tela_Pedidos.html'; }, { once: true });

    // Rosca: distribuição dos pedidos por situação
    const ps = resumo.solicitacoes.por_status;
    const grupos = [
      ['Concluídos', ps.concluida || 0, 'var(--red)', 'red-dot'],
      ['Em andamento', (ps.aceita || 0) + (ps.em_producao || 0), '#5d5b5c', 'gray-dot'],
      ['Pendentes', ps.pendente || 0, '#e2dddd', 'light-dot'],
    ];
    const total = grupos.reduce((acc, g) => acc + g[1], 0);
    document.querySelector('.materials-total h2').innerHTML = 'Pedidos por<br />Situação';
    donut.querySelector('strong').textContent = fmt.numero(total);
    donut.querySelector('small').textContent = total === 1 ? 'pedido' : 'pedidos';
    let acumulado = 0;
    donut.style.background = total
      ? `conic-gradient(${grupos.map(([, n, cor]) => {
        const ini = acumulado; acumulado += (n / total) * 100;
        return `${cor} ${ini}% ${acumulado}%`;
      }).join(',')})`
      : '#eee';
    legend.innerHTML = grupos.map(([nome, n, , dot]) => `
      <div class="legend-row"><i class="dot ${dot}"></i><span>${nome}</span><b>${total ? Math.round((n / total) * 100) : 0}%</b></div>`).join('');
  }

  function erro(err) {
    cards.forEach((el) => { el.textContent = '—'; });
    vazio(timeline, window.AACD.errorMessage(err));
  }

  carregar().catch(erro);
  document.querySelector('.refresh-button')?.addEventListener('click', () => carregar().catch(erro));
  document.querySelector('.institutions-panel .link-button')?.addEventListener('click', () => { location.href = 'Tela_Instituicoes.html'; });
}());
