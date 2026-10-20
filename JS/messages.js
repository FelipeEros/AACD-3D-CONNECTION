document.addEventListener('DOMContentLoaded', () => {
  const chats = {
    einstein: {
      name: 'Hospital Israelita Albert Einstein',
      date: 'Hoje, 14 de Maio',
      messages: [
        {
          type: 'incoming',
          author: 'Dr. Carlos Almeida',
          time: '09:15',
          text: 'Bom dia equipe AACD. Enviamos ontem no final do dia os novos modelos STL referentes ao paciente pediátrico João Silva. Tivemos um leve ajuste na angulação tibial.'
        },
        {
          type: 'outgoing',
          author: 'Você',
          time: '10:17',
          text: 'Recebemos e vamos validar o ajuste antes de liberar a impressão. Em breve confirmamos a nova versão.'
        },
        {
          type: 'incoming',
          author: 'Dr. Carlos Almeida',
          time: '10:42',
          text: 'Excelente, o relatório técnico parece muito consistente com nossas expectativas clínicas. Os arquivos STL foram aprovados. Podemos prosseguir com a impressão.'
        }
      ]
    },
    sirio: {
      name: 'Hospital Sírio-Libanês',
      date: 'Ontem',
      messages: [
        {
          type: 'incoming',
          author: 'Equipe clínica',
          time: '08:20',
          text: 'Precisamos ajustar as dimensões do protótipo de órtese pediátrica para manter a produção mais segura.'
        },
        {
          type: 'outgoing',
          author: 'Você',
          time: '08:49',
          text: 'Perfeito. Vamos recalcular as medidas e te retorno com a versão revisada em breve.'
        }
      ]
    },
    dorsaoluiz: {
      name: 'Rede D\'Or São Luiz',
      date: '12 Abr',
      messages: [
        {
          type: 'incoming',
          author: 'Coordenação',
          time: '15:10',
          text: 'Qual é o prazo estimado para a entrega dos guias cirúrgicos?'
        },
        {
          type: 'outgoing',
          author: 'Você',
          time: '15:28',
          text: 'O prazo previsto é de 5 dias úteis após a aprovação final dos arquivos enviados.'
        }
      ]
    }
  };

  const conversationItems = document.querySelectorAll('.conversation-item');
  const chatContactName = document.getElementById('chatContactName');
  const chatDate = document.getElementById('chatDate');
  const messageForm = document.getElementById('messageForm');
  const messageInput = document.getElementById('messageInput');
  const chatBody = document.querySelector('.chat-body');
  let activeChatId = 'einstein';

  function renderChat(chatId) {
    const chat = chats[chatId] || chats.einstein;
    activeChatId = chatId;

    const html = chat.messages.map((message) => {
      const bubbleClass = message.type === 'incoming' ? 'incoming' : 'outgoing';
      const attachment = message.type === 'incoming' && message.text.includes('relatório')
        ? `
          <div class="attachment-box">
            <div class="file-icon"><i class="bi bi-file-earmark-arrow-down" aria-hidden="true"></i></div>
            <div class="file-info">
              <strong>analise_estrutura_v2.pdf</strong>
              <span>2.4 MB • Relatório Técnico</span>
            </div>
            <button type="button" aria-label="Download"><i class="bi bi-download" aria-hidden="true"></i></button>
          </div>
        `
        : '';

      return `
        <div class="message-row ${bubbleClass}">
          <div class="message-bubble ${message.type === 'incoming' ? '' : 'inner-pink'}">
            <div class="message-meta">${message.author} <span>• ${message.time}</span></div>
            <p>${message.text}</p>
            ${attachment}
          </div>
        </div>
      `;
    }).join('');

    if (chatContactName) chatContactName.textContent = chat.name;
    if (chatDate) chatDate.textContent = chat.date;
    if (chatBody) chatBody.innerHTML = html;

    conversationItems.forEach((item) => {
      const isActive = item.dataset.chatId === chatId;
      item.classList.toggle('active', isActive);
    });
  }

  conversationItems.forEach((item) => {
    item.addEventListener('click', () => {
      renderChat(item.dataset.chatId || 'einstein');
    });
  });

  if (messageForm && messageInput && chatBody) {
    messageForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const value = messageInput.value.trim();
      if (!value) return;

      const chat = chats[activeChatId] || chats.einstein;
      chat.messages.push({
        type: 'outgoing',
        author: 'Você',
        time: 'agora',
        text: value
      });

      renderChat(activeChatId);
      messageInput.value = '';
      chatBody.scrollTop = chatBody.scrollHeight;
    });

    messageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        messageForm.requestSubmit();
      }
    });
  }

  renderChat(activeChatId);
});
