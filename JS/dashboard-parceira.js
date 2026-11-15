// Tela_Dashboard_Parceira: recursos da própria instituição.
(function () {
  const { api, escapeHtml, fmt } = window.AACD;
  if (!window.AACD.usuario) return;

  const cards = document.querySelectorAll('.summary-grid .summary-card');
  const colunas = document.querySelectorAll('.resource-column');

  const nomeMaterial = (r) => r.nome ?? r.material_nome ?? r.material ?? 'Material';
  const saldo = (r) => Number(r.saldo ?? r.saldo_atual ?? r.quantidade ?? 0);
  const minimo = (r) => Number(r.estoque_minimo ?? r.minimo ?? 0);

  async function carregar() {
    const [resumo, saldos] = await Promise.all([
      api('/dashboard'),
      api('/estoque/saldo', { query: { limit: 100 } }).then((r) => r.data).catch(() => []),
    ]);
    const imp = resumo.impressoras;
    const ocupadas = imp.por_status.ocupada || 0;
    const disponiveis = imp.por_status.disponivel || 0;
    const online = ocupadas + disponiveis;

    // Card 1: impressoras online / total
    cards[0].querySelector('strong').innerHTML = `${online}<small>/${imp.total}</small>`;

    // Card 2: materiais abaixo do mínimo
    const alertas = resumo.materiais.alertas_estoque;
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
    const lista = [...saldos].sort((a, b) => (saldo(a) - minimo(a)) - (saldo(b) - minimo(b))).slice(0, 3);
    const titulo = colunas[1].querySelector('h3').outerHTML;
    colunas[1].innerHTML = titulo + (lista.length ? lista.map((r) => {
      const critico = minimo(r) > 0 && saldo(r) <= minimo(r);
      const pct = minimo(r) > 0 ? Math.min(100, Math.round((saldo(r) / (minimo(r) * 2)) * 100)) : 100;
      return `
        <div class="resource-row"><span>${escapeHtml(nomeMaterial(r))} (Estoque)</span>
          <strong class="${critico ? 'red-text' : ''}">${fmt.numero(saldo(r), 2)} ${escapeHtml(r.unidade || '')}</strong></div>
        <div class="progress-track"><span class="${critico ? 'progress-red' : 'progress-gray'}" style="width:${pct}%"></span></div>`;
    }).join('') : '<p class="resource-note">Nenhum material cadastrado.</p>');
  }

  carregar().catch((err) => {
    document.querySelector('.resource-note').textContent = window.AACD.errorMessage(err);
  });
}());
