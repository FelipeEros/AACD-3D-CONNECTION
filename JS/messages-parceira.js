(function () {
  const { api, escapeHtml, errorMessage, usuario } = window.AACD;
  const body = document.querySelector('#messagesBody');
  const form = document.querySelector('#messageForm');
  const input = document.querySelector('#messageInput');
  const fileInput = document.querySelector('#attachmentInput');
  const attachmentButton = document.querySelector('#attachmentButton');
  const feedback = document.querySelector('#messageFeedback');
  const preview = document.querySelector('#conversationPreview');
  const time = document.querySelector('#conversationTime');
  const infoButton = document.querySelector('#conversationInfoButton');
  const infoPanel = document.querySelector('#conversationInfo');
  const searchButton = document.querySelector('#conversationSearchButton');
  const searchPanel = document.querySelector('#conversationSearch');
  const searchInput = document.querySelector('#conversationSearchInput');
  let mensagens = [];
  let busca = '';

  body.innerHTML = '<p class="message-state">Carregando mensagens...</p>';

  function mostrarErro(error) {
    body.innerHTML = '<p class="message-state error">Não foi possível carregar as mensagens.</p>';
    feedback.textContent = errorMessage(error);
    feedback.classList.add('visible', 'error');
  }

  function formatarHora(value) {
    if (!value) return '';
    return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function renderizar() {
    body.innerHTML = mensagens.length ? mensagens.map((mensagem) => {
      const propria = mensagem.remetente_id === usuario?.id;
      const autor = propria ? 'Você' : 'AACD Central';
      const anexos = (mensagem.arquivos || []).map((arquivo) => `
        <button class="message-attachment" type="button" data-file-id="${escapeHtml(arquivo.id)}">
          <i class="bi bi-paperclip" aria-hidden="true"></i>${escapeHtml(arquivo.nome_original || 'Baixar arquivo')}
        </button>`).join('');
      const textoBusca = `${mensagem.conteudo} ${(mensagem.arquivos || []).map((arquivo) => arquivo.nome_original).join(' ')}`.toLocaleLowerCase();
      return `
        <div class="message ${propria ? 'outgoing' : 'incoming'}" ${busca && !textoBusca.includes(busca) ? 'hidden' : ''}>
          ${propria ? '' : `<span class="message-author">${autor}</span>`}
          <p>${escapeHtml(mensagem.conteudo)}</p>
          ${anexos}
          <time>${formatarHora(mensagem.criado_em || mensagem.created_at)}</time>
        </div>`;
    }).join('') : '<p class="message-state">Nenhuma mensagem ainda.</p>';
    const ultima = mensagens[mensagens.length - 1];
    if (ultima) {
      preview.textContent = ultima.conteudo;
      time.textContent = formatarHora(ultima.criado_em || ultima.created_at);
    } else {
      preview.textContent = 'Nenhuma mensagem ainda.';
      time.textContent = '';
    }
    body.scrollTop = body.scrollHeight;
    body.querySelectorAll('[data-file-id]').forEach((botao) => {
      botao.addEventListener('click', async () => {
        botao.disabled = true;
        try {
          const resposta = await api(`/arquivos/${botao.dataset.fileId}/download`);
          window.open(resposta.url, '_blank', 'noopener');
        } catch (error) {
          mostrarErro(error);
        } finally {
          botao.disabled = false;
        }
      });
    });
  }

  async function carregar() {
    try {
      const resposta = await Promise.race([
        api('/mensagens', { query: { limit: 100 } }),
        new Promise((_, reject) => window.setTimeout(
          () => reject(new Error('O servidor demorou para responder. Verifique se a API está rodando.')),
          10000,
        )),
      ]);
      mensagens = (resposta.data || []).reverse();
      mensagens = await Promise.all(mensagens.map(async (mensagem) => ({
        ...mensagem,
        arquivos: await api('/arquivos', { query: { mensagem_id: mensagem.id } }).catch(() => []),
      })));
      renderizar();
    } catch (error) {
      mostrarErro(error);
    }
  }

  async function enviar(conteudo, arquivo) {
    const mensagem = await api('/mensagens', { method: 'POST', body: { conteudo } });
    if (arquivo) {
      const formData = new FormData();
      formData.append('arquivo', arquivo);
      formData.append('mensagem_id', mensagem.id);
      await api('/arquivos', { method: 'POST', form: formData });
    }
    mensagens.push(mensagem);
    await carregar();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const conteudo = input.value.trim();
    const arquivo = fileInput.files[0];
    if (!conteudo && !arquivo) return;
    const texto = conteudo || `Arquivo anexado: ${arquivo.name}`;
    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    feedback.className = 'message-feedback';
    try {
      await enviar(texto, arquivo);
      input.value = '';
      fileInput.value = '';
    } catch (error) {
      mostrarErro(error);
    } finally {
      botao.disabled = false;
    }
  });

  attachmentButton.addEventListener('click', () => fileInput.click());
  infoButton.addEventListener('click', () => {
    const aberto = infoPanel.hidden;
    infoPanel.hidden = !aberto;
    infoButton.setAttribute('aria-expanded', String(aberto));
  });
  searchButton.addEventListener('click', () => {
    const aberto = searchPanel.hidden;
    searchPanel.hidden = !aberto;
    searchButton.setAttribute('aria-expanded', String(aberto));
    if (aberto) searchInput.focus();
    else {
      busca = '';
      searchInput.value = '';
      renderizar();
    }
  });
  searchInput.addEventListener('input', () => {
    busca = searchInput.value.trim().toLocaleLowerCase();
    renderizar();
  });
  carregar();
}());
