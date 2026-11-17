// Tela_Dashboard_Parceira: recursos da própria instituição.
(function () {
  const { api, escapeHtml, fmt } = window.AACD;
  if (!window.AACD.usuario) return;

  const cards = document.querySelectorAll('.summary-grid .summary-card');
  const colunas = document.querySelectorAll('.resource-column');
  const conteudo = document.querySelector('.page-content');
  conteudo.classList.add('dashboard-data-pending');

  const nomeMaterial = (r) => r.nome ?? r.material_nome ?? r.material ?? 'Material';
  const saldo = (r) => Number(r.saldo ?? r.saldo_atual ?? r.quantidade ?? 0);
  const minimo = (r) => Number(r.estoque_minimo ?? r.minimo ?? 0);

  async function carregar() {
    const [resumo, saldos, materiais] = await Promise.all([
      api('/dashboard'),
      api('/estoque/saldo', { query: { limit: 100 } }).then((r) => r.data).catch(() => []),
      api('/materiais', { query: { limit: 100 } }).then((r) => r.data).catch(() => []),
    ]);
    const imp = resumo.impressoras;
    const ocupadas = imp.por_status.ocupada || 0;
    const disponiveis = imp.por_status.disponivel || 0;
    const online = ocupadas + disponiveis;

    // Card 1: impressoras online / total
    cards[0].querySelector('strong').innerHTML = `${online}<small>/${imp.total}</small>`;

    // Card 2: materiais abaixo do mínimo
    const materiaisPorId = new Map(materiais.map((material) => [material.id, material]));
    const saldosComMinimo = saldos.map((item) => ({
      ...item,
      ...materiaisPorId.get(item.material_id),
      saldoAtual: saldo(item),
      estoqueMinimo: minimo(materiaisPorId.get(item.material_id) || item),
    }));
    const alertas = saldosComMinimo.filter((item) => (
      item.estoqueMinimo > 0 && item.saldoAtual <= item.estoqueMinimo
    )).length;
    const tag = cards[1].querySelector('.metric-tag');
    cards[1].querySelector('strong').textContent = fmt.numero(alertas);
    cards[1].querySelector('p').textContent = alertas === 1 ? 'Material abaixo do mínimo' : 'Materiais abaixo do mínimo';
    tag.textContent = alertas ? 'CRÍTICO' : 'OK';
    tag.classList.toggle('critical', alertas > 0);

    // Ocupação das impressoras
    const [linhaUso, linhaDisp] = colunas[0].querySelectorAll('.resource-row strong');
    linhaUso.textContent = ocupadas;
    linhaDisp.textContent = disponiveis;
    colunas[0].querySelector('.progress-track span').style.width = `${imp.total ? Math.round((ocupadas / imp.total) * 100) : 0}%`;

    // Estoque: os 3 materiais com menor folga em relação ao mínimo
    const lista = [...saldosComMinimo].sort((a, b) => (
      (a.saldoAtual - a.estoqueMinimo) - (b.saldoAtual - b.estoqueMinimo)
    )).slice(0, 3);
    const titulo = colunas[1].querySelector('h3').outerHTML;
    colunas[1].innerHTML = titulo + (lista.length ? lista.map((r) => {
      const critico = r.estoqueMinimo > 0 && r.saldoAtual <= r.estoqueMinimo;
      const pct = r.estoqueMinimo > 0
        ? Math.min(100, Math.round((r.saldoAtual / (r.estoqueMinimo * 2)) * 100))
        : 100;
      return `
        <div class="resource-row"><span>${escapeHtml(nomeMaterial(r))} (Estoque)</span>
          <strong class="${critico ? 'red-text' : ''}">${fmt.numero(r.saldoAtual, 2)} ${escapeHtml(r.unidade || '')}</strong></div>
        <div class="progress-track"><span class="${critico ? 'progress-red' : 'progress-gray'}" style="width:${pct}%"></span></div>`;
    }).join('') : '<p class="resource-note">Nenhum material cadastrado.</p>');
  }

  carregar().catch((err) => {
    cards.forEach((card) => {
      card.querySelector('strong').innerHTML = '—';
    });
    cards[0].querySelector('p').textContent = 'Dados indisponíveis';
    cards[1].querySelector('p').textContent = 'Dados indisponíveis';
    cards[1].querySelector('.metric-tag').textContent = '—';
    cards[1].querySelector('.metric-tag').classList.remove('critical');
    colunas.forEach((coluna) => {
      coluna.innerHTML = `<h3>${escapeHtml(coluna.querySelector('h3').textContent)}</h3><p class="resource-note">Dados indisponíveis.</p>`;
    });
    document.querySelector('.resource-note').textContent = window.AACD.errorMessage(err);
  }).finally(() => {
    conteudo.classList.remove('dashboard-data-pending');
  });
}());
