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
  const sendButton = form.querySelector('button[type="submit"]');

  let mensagens = [];
  let busca = '';
  let carregando = false;
  let enviando = false;
  let inicializado = false;
  let atualizarPendente = false;
  let ultimaRenderizacao = '';
  let bloqueadoAte = 0;

  const cacheAnexos = new Map();

  body.innerHTML = '<p class="message-state">Carregando mensagens...</p>';

  function mostrarErro(error) {
    feedback.textContent = errorMessage(error);
    feedback.className = 'message-feedback visible error';

    if (error.status === 429) {
      bloqueadoAte = Date.now() + 60000;
    }
  }

  function formatarHora(value) {
    if (!value) return '';

    return new Date(value).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function renderizar(forcar = false) {
    const assinatura = JSON.stringify([mensagens, busca]);

    if (!forcar && assinatura === ultimaRenderizacao) return;

    const pertoDoFinal =
      body.scrollHeight - body.scrollTop - body.clientHeight < 80;

    const scrollAnterior = body.scrollTop;

    ultimaRenderizacao = assinatura;

    body.innerHTML = mensagens.length ? mensagens.map((mensagem) => {
      const propria = mensagem.remetente_id === usuario?.id;
      const autor = propria ? 'Você' : 'AACD Central';

      const anexos = (mensagem.arquivos || []).map((arquivo) => `
        <button class="message-attachment" type="button"
          data-file-id="${escapeHtml(arquivo.id)}">
          <i class="bi bi-paperclip" aria-hidden="true"></i>
          ${escapeHtml(arquivo.nome_original || 'Baixar arquivo')}
        </button>
      `).join('');

      const textoBusca = `
        ${mensagem.conteudo}
        ${(mensagem.arquivos || []).map(
          arquivo => arquivo.nome_original
        ).join(' ')}
      `.toLocaleLowerCase();

      return `
        <div class="message ${propria ? 'outgoing' : 'incoming'}"
          ${busca && !textoBusca.includes(busca) ? 'hidden' : ''}>

          ${propria ? '' : `
            <span class="message-author">${autor}</span>
          `}

          <p>${escapeHtml(mensagem.conteudo)}</p>

          ${anexos}

          <time>
            ${formatarHora(mensagem.criado_em || mensagem.created_at)}
          </time>

        </div>
      `;
    }).join('') : '<p class="message-state">Nenhuma mensagem ainda.</p>';

    const ultima = mensagens.at(-1);

    preview.textContent = ultima
      ? ultima.conteudo
      : 'Nenhuma mensagem ainda.';

    time.textContent = ultima
      ? formatarHora(ultima.criado_em || ultima.created_at)
      : '';

    body.scrollTop = forcar || pertoDoFinal
      ? body.scrollHeight
      : scrollAnterior;
  }

  async function carregarAnexos(mensagem) {
    const agora = Date.now();
    const cache = cacheAnexos.get(mensagem.id);

    const recente = agora - new Date(
      mensagem.criado_em || mensagem.created_at
    ).getTime() < 120000;

    if (cache && (!recente || agora - cache.consultadoEm < 15000)) {
      return cache.arquivos;
    }

    try {
      const resposta = await api('/arquivos', {
        query: { mensagem_id: mensagem.id }
      });

      const arquivos = Array.isArray(resposta)
        ? resposta
        : resposta?.data || [];

      cacheAnexos.set(mensagem.id, {
        arquivos,
        consultadoEm: agora
      });

      return arquivos;

    } catch (error) {
      if (error.status === 429) {
        bloqueadoAte = Date.now() + 60000;
      }

      return cache?.arquivos || [];
    }
  }

  async function carregar() {
    if (enviando || Date.now() < bloqueadoAte) return;

    if (carregando) {
      atualizarPendente = true;
      return;
    }

    carregando = true;

    try {
      const resposta = await api('/mensagens', {
        query: { limit: 100 }
      });

      const lista = (resposta.data || []).slice().reverse();

      if (enviando) return;

      mensagens = lista.map(mensagem => ({
        ...mensagem,
        arquivos: cacheAnexos.get(mensagem.id)?.arquivos || []
      }));

      renderizar(!inicializado);
      inicializado = true;

      for (const mensagem of mensagens) {
        if (enviando || Date.now() < bloqueadoAte) break;

        mensagem.arquivos = await carregarAnexos(mensagem);
      }

      if (!enviando) renderizar();

    } catch (error) {
      mostrarErro(error);

      if (!inicializado) {
        body.innerHTML = `
          <p class="message-state error">
            Não foi possível carregar as mensagens.
          </p>
        `;
      }

    } finally {
      carregando = false;

      if (atualizarPendente) {
        atualizarPendente = false;
        carregar();
      }
    }
  }

  body.addEventListener('click', async (event) => {
    const botao = event.target.closest('[data-file-id]');

    if (!botao) return;

    botao.disabled = true;

    try {
      const resposta = await api(
        `/arquivos/${botao.dataset.fileId}/download`
      );

      window.open(resposta.url, '_blank', 'noopener');

    } catch (error) {
      mostrarErro(error);

    } finally {
      botao.disabled = false;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (enviando) return;

    const conteudo = input.value.trim();
    const arquivo = fileInput.files[0];

    if (!conteudo && !arquivo) return;

    const texto = conteudo || `Arquivo anexado: ${arquivo.name}`;

    enviando = true;
    sendButton.disabled = true;
    input.disabled = true;
    attachmentButton.disabled = true;

    feedback.textContent = '';
    feedback.className = 'message-feedback';

    let mensagemSalva = false;

    try {
      const mensagem = await api('/mensagens', {
        method: 'POST',
        body: { conteudo: texto }
      });

      mensagemSalva = true;

      if (arquivo) {
        const formData = new FormData();

        formData.append('arquivo', arquivo);
        formData.append('mensagem_id', mensagem.id);

        await api('/arquivos', {
          method: 'POST',
          form: formData
        });

        cacheAnexos.delete(mensagem.id);
      }

    } catch (error) {
      mostrarErro(error);

      if (mensagemSalva) {
        feedback.textContent = `Mensagem enviada, mas o anexo falhou: ${errorMessage(error)}`;
      }

    } finally {
      if (mensagemSalva) {
        input.value = '';
        fileInput.value = '';
      }

      enviando = false;
      sendButton.disabled = false;
      input.disabled = false;
      attachmentButton.disabled = false;

      input.focus();

      await carregar();
    }
  });

  attachmentButton.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const arquivo = fileInput.files[0];

    feedback.textContent = arquivo
      ? `Anexo selecionado: ${arquivo.name}`
      : '';

    feedback.className = arquivo
      ? 'message-feedback visible'
      : 'message-feedback';
  });

  infoButton.addEventListener('click', () => {
    const aberto = infoPanel.hidden;

    infoPanel.hidden = !aberto;
    infoButton.setAttribute('aria-expanded', String(aberto));
  });

  searchButton.addEventListener('click', () => {
    const aberto = searchPanel.hidden;

    searchPanel.hidden = !aberto;
    searchButton.setAttribute('aria-expanded', String(aberto));

    if (aberto) {
      searchInput.focus();
    } else {
      busca = '';
      searchInput.value = '';
      renderizar();
    }
  });

  searchInput.addEventListener('input', () => {
    busca = searchInput.value.trim().toLocaleLowerCase();
    renderizar();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) carregar();
  });

  carregar();

  window.setInterval(() => {
    if (!document.hidden && !enviando && !carregando) {
      carregar();
    }
  }, 5000);

}());