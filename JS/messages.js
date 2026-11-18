document.addEventListener('DOMContentLoaded', async () => {
  const { api, escapeHtml, fmt, errorMessage, requireLogin } = window.AACD;
  const usuario = requireLogin('aacd');

  if (!usuario) return;

  const list = document.querySelector('.conversation-list');
  const body = document.querySelector('.chat-body');
  const name = document.getElementById('chatContactName');
  const date = document.getElementById('chatDate');
  const form = document.getElementById('messageForm');
  const input = document.getElementById('messageInput');
  const fileInput = document.getElementById('attachmentInput');
  const attachmentButton = document.getElementById('attachmentButton');
  const searchButton = document.getElementById('conversationSearchButton');
  const searchPanel = document.getElementById('conversationSearch');
  const searchInput = document.getElementById('conversationSearchInput');
  const sendButton = form.querySelector('[type="submit"]');

  const notice = document.createElement('p');
  notice.setAttribute('role', 'status');
  notice.style.color = '#c92732';
  notice.style.margin = '0 16px';
  form.before(notice);

  const chats = new Map();

  let activeId = null;
  let sending = false;
  let loading = false;
  let refreshQueued = false;
  let generation = 0;
  let blockedUntil = 0;
  let lastRender = '';

  const rows = result => Array.isArray(result) ? result : result?.data || [];
  const timestamp = message => message.criado_em || message.created_at;

  function report(error) {
    notice.textContent = errorMessage(error);

    if (error.status === 429) {
      blockedUntil = Date.now() + 60000;
    }
  }

  function controls() {
    input.disabled = !activeId || sending;
    sendButton.disabled = !activeId || sending;
    attachmentButton.disabled = !activeId || sending;
  }

  function renderList() {
    list.innerHTML = [...chats.values()].map(chat => {
      const last = chat.messages.at(-1);

      return `
        <article
          class="conversation-item ${chat.id === activeId ? 'active' : ''}"
          data-chat-id="${escapeHtml(chat.id)}"
          tabindex="0"
          role="button"
        >
          <div class="item-meta">
            <span class="meta-time">
              ${last ? escapeHtml(fmt.hora(timestamp(last))) : ''}
            </span>
          </div>

          <div class="conversation-body">
            <div class="conversation-row">
              <div class="conversation-copy">
                <strong>${escapeHtml(chat.nome)}</strong>
                <span>
                  ${escapeHtml(last?.conteudo || 'Abrir conversa')}
                </span>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('') || '<p>Nenhuma instituição aprovada.</p>';
  }

  function filterMessages() {
    const query = searchInput.value.trim().toLocaleLowerCase();

    body.querySelectorAll('.message-row').forEach(row => {
      row.hidden = !row.textContent.toLocaleLowerCase().includes(query);
    });
  }

  function renderChat(force = false) {
    const chat = chats.get(activeId);

    if (!chat) return;

    const signature = JSON.stringify([activeId, chat.messages]);

    if (!force && signature === lastRender) return;

    const nearBottom =
      body.scrollHeight - body.scrollTop - body.clientHeight < 80;

    const oldScroll = body.scrollTop;

    lastRender = signature;

    name.textContent = chat.nome;

    date.textContent = chat.messages.length
      ? fmt.data(timestamp(chat.messages.at(-1)))
      : '';

    body.innerHTML = chat.messages.map(message => {
      const own = message.remetente_id === usuario.id;

      const files = (message.arquivos || []).map(file => `
        <div class="attachment-box">
          <div class="file-icon">
            <i class="bi bi-file-earmark-arrow-down" aria-hidden="true"></i>
          </div>

          <div class="file-info">
            <strong>${escapeHtml(file.nome_original)}</strong>
          </div>

          <button
            type="button"
            data-file-id="${escapeHtml(file.id)}"
            aria-label="Download"
          >
            <i class="bi bi-download" aria-hidden="true"></i>
          </button>
        </div>
      `).join('');

      return `
        <div class="message-row ${own ? 'outgoing' : 'incoming'}">
          <div class="message-bubble ${own ? 'inner-pink' : ''}">
            <div class="message-meta">
              ${escapeHtml(own ? 'Você' : chat.nome)}

              <span>
                • ${escapeHtml(fmt.dataHora(timestamp(message)))}
              </span>
            </div>

            <p style="white-space:pre-wrap;overflow-wrap:anywhere">
              ${escapeHtml(message.conteudo)}
            </p>

            ${files}
          </div>
        </div>
      `;
    }).join('') || '<p>Nenhuma mensagem ainda.</p>';

    filterMessages();

    body.scrollTop = force || nearBottom
      ? body.scrollHeight
      : oldScroll;

    renderList();
  }

  async function refresh() {
    if (!activeId || sending || Date.now() < blockedUntil) return;

    if (loading) {
      refreshQueued = true;
      return;
    }

    loading = true;

    const id = activeId;
    const version = generation;

    try {
      const chat = chats.get(id);

      const result = await api('/mensagens', {
        query: {
          instituicao_id: id,
          limit: 100
        }
      });

      const messages = rows(result).slice().reverse();

      const previous = new Map(
        chat.messages.map(message => [message.id, message])
      );

      const now = Date.now();

      for (const message of messages) {
        const old = previous.get(message.id);

        message.arquivos = old?.arquivos || [];

        const recent =
          now - new Date(timestamp(message)).getTime() < 120000;

        if (!old || (recent && now - (old.filesChecked || 0) >= 30000)) {
          if (generation !== version || sending) return;

          message.arquivos = rows(await api('/arquivos', {
            query: {
              mensagem_id: message.id
            }
          }));

          message.filesChecked = now;
        } else {
          message.filesChecked = old.filesChecked;
        }
      }

      if (generation !== version || sending) return;

      chat.messages = messages;

      renderChat();

    } catch (error) {
      if (generation === version) {
        report(error);
      }
    } finally {
      loading = false;

      if (refreshQueued) {
        refreshQueued = false;
        refresh();
      }
    }
  }

  function selectChat(id) {
    if (!chats.has(id) || sending) return;

    activeId = id;
    generation++;

    searchInput.value = '';
    input.value = '';
    fileInput.value = '';

    input.placeholder = `Digite sua mensagem para ${chats.get(id).nome}`;

    notice.textContent = '';

    renderChat(true);
    controls();
    refresh();
  }

  list.addEventListener('click', event => {
    const item = event.target.closest('[data-chat-id]');

    if (item) {
      selectChat(item.dataset.chatId);
    }
  });

  list.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      const item = event.target.closest('[data-chat-id]');

      if (item) {
        event.preventDefault();
        selectChat(item.dataset.chatId);
      }
    }
  });

  searchButton.addEventListener('click', () => {
    searchPanel.hidden = !searchPanel.hidden;

    searchButton.setAttribute(
      'aria-expanded',
      String(!searchPanel.hidden)
    );

    if (!searchPanel.hidden) {
      searchInput.focus();
    } else {
      searchInput.value = '';
      filterMessages();
    }
  });

  searchInput.addEventListener('input', filterMessages);

  attachmentButton.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.accept = '.stl,.obj,.3mf,.pdf,.png,.jpg,.jpeg';

  fileInput.addEventListener('change', () => {
    notice.textContent = fileInput.files[0]
      ? `Anexo selecionado: ${fileInput.files[0].name}`
      : '';
  });

  body.addEventListener('click', async event => {
    const button = event.target.closest('[data-file-id]');

    if (!button) return;

    button.disabled = true;

    try {
      const result = await api(
        `/arquivos/${button.dataset.fileId}/download`
      );

      const link = document.createElement('a');

      link.href = result.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      link.click();

    } catch (error) {
      report(error);
    } finally {
      button.disabled = false;
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();

    if (!activeId || sending) return;

    const file = fileInput.files[0];

    const conteudo = input.value.trim() ||
      (file ? `Arquivo anexado: ${file.name}` : '');

    if (!conteudo) return;

    sending = true;
    generation++;

    controls();

    notice.textContent = '';

    let saved = false;

    try {
      const message = await api('/mensagens', {
        method: 'POST',
        body: {
          instituicao_id: activeId,
          conteudo
        }
      });

      saved = true;

      if (file) {
        const data = new FormData();

        data.append('arquivo', file);
        data.append('mensagem_id', message.id);

        await api('/arquivos', {
          method: 'POST',
          form: data
        });
      }

    } catch (error) {
      report(error);

      if (saved) {
        notice.textContent =
          `Mensagem enviada, mas o anexo falhou: ${errorMessage(error)}`;
      }
    } finally {
      if (saved) {
        input.value = '';
        fileInput.value = '';
      }

      sending = false;

      controls();
      refresh();
    }
  });

  list.textContent = 'Carregando instituições...';
  body.textContent = 'Selecione uma instituição.';
  name.textContent = 'Mensagens';
  date.textContent = '';
  input.placeholder = 'Digite sua mensagem';

  controls();

  try {
    const result = await api('/mensagens/conversas', {
      query: {
        limit: 100
      }
    });

    rows(result)
      .filter(chat => chat.status === 'aprovada')
      .forEach(chat => {
        chats.set(chat.id, {
          ...chat,
          messages: []
        });
      });

    renderList();

    if (chats.size) {
      selectChat(chats.keys().next().value);
    }

  } catch (error) {
    list.textContent = 'Não foi possível carregar as instituições.';
    report(error);
  }

  setInterval(() => {
    if (!document.hidden && !loading) {
      refresh();
    }
  }, 5000);
});