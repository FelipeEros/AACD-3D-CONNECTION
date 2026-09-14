const panels = document.querySelectorAll('.dashboard-panel');
const navItems = document.querySelectorAll('.nav-item');
const title = document.querySelector('#pageTitle');
const subtitle = document.querySelector('#pageSubtitle');
const labels = {
  overview: ['Visão Geral', 'Resumo das atividades da rede de manufatura aditiva.'],
  institutions: ['Instituições', 'Instituições parceiras e histórico de utilização.'],
  printers: ['Impressoras', 'Capacidade e disponibilidade da rede AACD 3D Connect.'],
  materials: ['Materiais', 'Lotes, filamentos suportados e rastreabilidade.'],
  uses: ['Utilizações', 'Histórico de impressões e modelos produzidos.'],
  messages: ['Mensagens', 'Comunicação entre as instituições da rede.'],
  reports: ['Relatórios', 'Indicadores operacionais e impacto social.'],
  settings: ['Configurações', 'Preferências de acesso e da instituição.']
};

function selectPanel(panelName) {
  panels.forEach((panel) => {
    const isSelected = panel.dataset.content === panelName;
    panel.classList.toggle('visible', isSelected);
    panel.style.display = isSelected ? 'block' : 'none';
  });
}

selectPanel('overview');

navItems.forEach((item) => {
  item.addEventListener('click', () => {
    const panelName = item.dataset.panel;
    if (panelName === 'materials') {
      window.location.href = 'materials.html';
      return;
    }
    navItems.forEach((navItem) => navItem.classList.toggle('active', navItem === item));
    selectPanel(panelName);
    title.textContent = labels[panelName][0];
    subtitle.textContent = labels[panelName][1];
  });
});

