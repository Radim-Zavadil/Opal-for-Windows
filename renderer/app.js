// DOM Elements
const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');
const presetsContainer = document.getElementById('presets-container');
const btnNewBlock = document.getElementById('btn-new-block');
const btnBlockNow = document.getElementById('btn-block-now');
const modalNewBlock = document.getElementById('modal-new-block');
const btnCloseModals = document.querySelectorAll('.close-modal, .close-modal-btn');
const btnStartSessionSubmit = document.getElementById('btn-start-session-submit');

// State Elements
const activeSessionContainer = document.getElementById('active-session-container');
const sessionNameEl = document.getElementById('session-name');
const sessionTimeEl = document.getElementById('session-time');
const sessionCountEl = document.getElementById('session-count');
const btnStopSession = document.getElementById('btn-stop-session');

// Settings Elements
const settingDefaultDuration = document.getElementById('setting-default-duration');
const btnSaveSettings = document.getElementById('btn-save-settings');

// Modals Inputs
const inputSessionName = document.getElementById('input-session-name');
const inputSessionDuration = document.getElementById('input-session-duration');
const inputSessionSites = document.getElementById('input-session-sites');
const inputSessionApps = document.getElementById('input-session-apps');

// State Variables
let appConfig = null;
let currentSessionState = null;

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  console.log('App connecting via preload API...');
  
  // Load initial data
  appConfig = await window.focusAPI.getConfig();
  currentSessionState = await window.focusAPI.getSessionState();

  // Populate UI
  settingDefaultDuration.value = Math.floor(appConfig.defaultDuration / 60);
  renderPresets(appConfig.templates);
  updateSessionUI(currentSessionState);

  // Setup Event Listeners
  setupNavigation();
  setupModals();
  setupActions();

  // Listen to IPC events
  window.focusAPI.onSessionTick((state) => {
    updateSessionUI(state);
  });

  window.focusAPI.onSessionEnded(() => {
    window.focusAPI.getSessionState().then(state => {
      updateSessionUI({ active: false });
    });
  });
});

function setupNavigation() {
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = item.getAttribute('data-target');
      
      // Update active nav
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      // Update active view
      views.forEach(v => v.classList.remove('active'));
      document.getElementById(targetId).classList.add('active');
    });
  });
}

function setupModals() {
  const openModal = () => {
    inputSessionDuration.value = Math.floor(appConfig.defaultDuration / 60);
    inputSessionName.value = 'Custom Block';
    inputSessionSites.value = appConfig.sites.join(', ');
    inputSessionApps.value = appConfig.apps.join(', ');
    modalNewBlock.classList.add('active');
  };

  btnNewBlock.addEventListener('click', openModal);
  btnBlockNow.addEventListener('click', openModal);

  btnCloseModals.forEach(btn => {
    btn.addEventListener('click', () => {
      modalNewBlock.classList.remove('active');
    });
  });
}

function setupActions() {
  btnStartSessionSubmit.addEventListener('click', async () => {
    const name = inputSessionName.value || 'Custom Block';
    const duration = parseInt(inputSessionDuration.value) * 60; // to seconds
    const sitesRaw = inputSessionSites.value.split(',').map(s => s.trim()).filter(s => s);
    const appsRaw = inputSessionApps.value.split(',').map(a => a.trim()).filter(a => a);

    const success = await window.focusAPI.startSession({
      name,
      duration,
      sites: sitesRaw,
      apps: appsRaw
    });

    if (success) {
      modalNewBlock.classList.remove('active');
      currentSessionState = await window.focusAPI.getSessionState();
      updateSessionUI(currentSessionState);
    } else {
      alert("A session is already active.");
    }
  });

  btnStopSession.addEventListener('click', async () => {
    await window.focusAPI.stopSession();
  });

  btnSaveSettings.addEventListener('click', async () => {
    appConfig.defaultDuration = parseInt(settingDefaultDuration.value) * 60;
    await window.focusAPI.saveConfig(appConfig);
    alert('Settings saved!');
  });
}

function renderPresets(templates) {
  presetsContainer.innerHTML = '';
  templates.forEach(t => {
    const card = document.createElement('div');
    card.className = 'preset-card';
    card.innerHTML = `
      <div class="preset-left">
        <span class="preset-icon">${t.icon}</span>
        <div class="preset-details">
          <h4>${t.name}</h4>
          <p>${t.desc}</p>
        </div>
      </div>
      <button class="add-btn" onclick="startPreset('${t.name}')">+ Add</button>
    `;
    presetsContainer.appendChild(card);
  });
}

// Exposed to window so inline onclick can use it
window.startPreset = async (name) => {
  const template = appConfig.templates.find(t => t.name === name);
  if (template) {
    inputSessionName.value = template.name;
    modalNewBlock.classList.add('active');
  }
};

function updateSessionUI(state) {
  if (state.active) {
    activeSessionContainer.style.display = 'block';
    sessionNameEl.innerText = state.name;
    sessionCountEl.innerText = state.blockedCount;
    sessionTimeEl.innerText = \`Remaining \${formatTime(state.remainingTime)}\`;
    btnBlockNow.disabled = true;
    btnBlockNow.style.opacity = 0.5;
  } else {
    activeSessionContainer.style.display = 'none';
    btnBlockNow.disabled = false;
    btnBlockNow.style.opacity = 1;
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  if (h > 0) {
    return \`\${h}:\${m.toString().padStart(2, '0')}:\${s.toString().padStart(2, '0')}\`;
  }
  return \`\${m.toString().padStart(2, '0')}:\${s.toString().padStart(2, '0')}\`;
}
