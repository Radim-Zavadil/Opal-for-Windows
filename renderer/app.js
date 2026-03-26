// DOM Elements
const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');
const presetsContainer = document.getElementById('presets-container');
const btnNewBlock = document.getElementById('btn-new-block');
const btnBlockNow = document.getElementById('btn-block-now');
const modalNewBlock = document.getElementById('modal-new-block');
const btnCloseModals = document.querySelectorAll('.close-modal, .close-modal-btn');
const btnStartSessionSubmit = document.getElementById('btn-start-session-submit');

// Modal Elements
const modalTitle = document.getElementById('modal-title');
const inputSessionName = document.getElementById('input-session-name');
const inputSessionDuration = document.getElementById('input-session-duration');
const inputSessionSites = document.getElementById('input-session-sites');
const inputSessionApps = document.getElementById('input-session-apps');

// State Elements
const activeSessionContainer = document.getElementById('active-session-container');
const sessionNameEl = document.getElementById('session-name');
const sessionTimeEl = document.getElementById('session-time');
const sessionCountEl = document.getElementById('session-count');
const btnStopSession = document.getElementById('btn-stop-session');

// Settings Elements
const settingDefaultDuration = document.getElementById('setting-default-duration');
const btnSaveSettings = document.getElementById('btn-save-settings');

// Active Session View Elements
const viewActiveSession = document.getElementById('view-active-session');
const btnBackToBlocks = document.getElementById('btn-back-to-blocks');
const detailSessionTitle = document.getElementById('detail-session-title');
const timelineFill = document.getElementById('timeline-fill');
const bgUpload = document.getElementById('bg-upload');
const activeSessionBg = document.getElementById('active-session-bg');
const btnScheduleSession = document.getElementById('btn-schedule-session');

// State Variables
let appConfig = null;
let currentSessionState = null;
let isTemplateMode = false;

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  if (!window.focusAPI) {
    console.error('focusAPI is not available! IPC is broken.');
    return;
  }

  // Load initial data
  appConfig = await window.focusAPI.getConfig();
  currentSessionState = await window.focusAPI.getSessionState();

  // Populate UI
  settingDefaultDuration.value = Math.floor(appConfig.defaultDuration / 60);
  renderPresets(appConfig.templates);
  updateSessionUI(currentSessionState);

  // Restore background
  const savedBg = localStorage.getItem('customBackground');
  if (savedBg) {
    activeSessionBg.style.backgroundImage = `url(${savedBg})`;
  }

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
      
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      views.forEach(v => v.classList.remove('active'));
      document.getElementById(targetId).classList.add('active');
    });
  });
}

function setupModals() {
  const openModal = (mode) => {
    isTemplateMode = mode === 'template';
    modalTitle.innerText = isTemplateMode ? "Create New Template" : "Start Block Session";
    btnStartSessionSubmit.innerText = isTemplateMode ? "Create Template" : "Start Blocking";
    
    inputSessionDuration.value = Math.floor(appConfig.defaultDuration / 60);
    inputSessionName.value = isTemplateMode ? 'New Block Template' : 'Custom Block';
    inputSessionSites.value = '';
    inputSessionApps.value = '';
    modalNewBlock.classList.add('active');
  };

  btnNewBlock.addEventListener('click', () => openModal('template'));
  btnBlockNow.addEventListener('click', () => openModal('session'));
  btnScheduleSession.addEventListener('click', () => openModal('session'));

  btnCloseModals.forEach(btn => {
    btn.addEventListener('click', () => {
      modalNewBlock.classList.remove('active');
    });
  });
}

function setupActions() {
  btnStartSessionSubmit.addEventListener('click', async () => {
    const name = inputSessionName.value || (isTemplateMode ? 'New Block Template' : 'Custom Block');
    const duration = parseInt(inputSessionDuration.value) * 60;
    const sitesRaw = inputSessionSites.value.split(',').map(s => s.trim()).filter(s => s);
    const appsRaw = inputSessionApps.value.split(',').map(a => a.trim()).filter(a => a);

    if (isTemplateMode) {
      // Save as template
      appConfig.templates.push({
        name,
        desc: `Duration: ${Math.round(duration/60)}m`,
        icon: 'star',
        sites: sitesRaw,
        apps: appsRaw,
        duration: duration
      });
      await window.focusAPI.saveConfig(appConfig);
      renderPresets(appConfig.templates);
      modalNewBlock.classList.remove('active');
    } else {
      // Start session immediately
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
    }
  });

  btnStopSession.addEventListener('click', async (e) => {
    e.stopPropagation();
    await window.focusAPI.stopSession();
    if (document.getElementById('view-active-session').classList.contains('active')) {
      views.forEach(v => v.classList.remove('active'));
      document.getElementById('view-blocks').classList.add('active');
    }
  });

  btnSaveSettings.addEventListener('click', async () => {
    appConfig.defaultDuration = parseInt(settingDefaultDuration.value) * 60;
    await window.focusAPI.saveConfig(appConfig);
    alert('Settings saved!');
  });

  // Active session card click -> detail view
  document.querySelector('.active-session-card').addEventListener('click', (e) => {
    if (e.target.id === 'btn-stop-session') return;
    views.forEach(v => v.classList.remove('active'));
    document.getElementById('view-active-session').classList.add('active');
    detailSessionTitle.innerText = currentSessionState.name;
    // Set initial timeline state
    updateTimeline(currentSessionState);
  });

  // Detail view back button
  btnBackToBlocks.addEventListener('click', () => {
    views.forEach(v => v.classList.remove('active'));
    document.getElementById('view-blocks').classList.add('active');
  });

  // Background upload logic
  bgUpload.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target.result;
        activeSessionBg.style.backgroundImage = `url(${result})`;
        try {
          localStorage.setItem('customBackground', result);
        } catch(err) {
           console.error('Image too large to persist locally', err);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  });
}

function renderPresets(templates) {
  presetsContainer.innerHTML = '';
  // Fallback map in case of old emoji formats in config
  const iconMap = { '💻': 'laptop', '☀️': 'sun', '🕯️': 'candle', '🛋️': 'armchair', '🛏️': 'bed' };

  templates.forEach((t, i) => {
    const pIcon = t.pIcon || iconMap[t.icon] || 'star';
    const card = document.createElement('div');
    card.className = 'preset-card';
    card.innerHTML = `
      <div class="preset-left">
        <i class="ph ph-${pIcon} preset-icon"></i>
        <div class="preset-details">
          <h4>${t.name}</h4>
          <p>${t.desc}</p>
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="add-btn start-preset-btn" data-index="${i}">Start</button>
      </div>
    `;
    presetsContainer.appendChild(card);
  });

  document.querySelectorAll('.presets-list .start-preset-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const idx = e.target.getAttribute('data-index');
      const template = templates[idx];
      if (template) {
        if (currentSessionState && currentSessionState.active) {
            alert('A session is already active!');
            return;
        }
        const success = await window.focusAPI.startSession({
          name: template.name,
          duration: template.duration || appConfig.defaultDuration,
          sites: template.sites || appConfig.sites,
          apps: template.apps || appConfig.apps
        });
        if (success) {
           currentSessionState = await window.focusAPI.getSessionState();
           updateSessionUI(currentSessionState);
        }
      }
    });
  });
}

function updateSessionUI(state) {
  if (state.active) {
    activeSessionContainer.style.display = 'block';
    sessionNameEl.innerText = state.name;
    sessionCountEl.innerText = state.blockedCount || 0;
    sessionTimeEl.innerText = `Remaining ${formatTime(state.remainingTime)}`;
    btnBlockNow.disabled = true;
    btnBlockNow.style.opacity = 0.5;
    
    updateTimeline(state);
  } else {
    activeSessionContainer.style.display = 'none';
    btnBlockNow.disabled = false;
    btnBlockNow.style.opacity = 1;
    timelineFill.style.width = '0%';
  }
}

function updateTimeline(state) {
  if (!state || !state.active) return;
  const total = state.totalDuration || appConfig.defaultDuration;
  
  // Progress goes from 0 to 100 as time elapses. With margin-left auto, this fills from right to left.
  const elapsed = total - state.remainingTime;
  const progress = Math.min((elapsed / total) * 100, 100);
  timelineFill.style.width = `${progress}%`;
  
  const detailTimeEl = document.getElementById('detail-session-time');
  if (detailTimeEl) {
    detailTimeEl.innerText = formatTime(state.remainingTime);
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
