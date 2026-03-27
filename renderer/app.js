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
const modalEditableTitle = document.getElementById('modal-editable-title');
const inputHours = document.getElementById('input-hours');
const inputMinutes = document.getElementById('input-minutes');
const inputSessionSites = document.getElementById('input-session-sites');
const inputSessionApps = document.getElementById('input-session-apps');
const btnDeletePreset = document.getElementById('btn-delete-preset');
const inputSessionIcon = document.getElementById('input-session-icon');
const modalIconPreview = document.getElementById('modal-icon-preview');
const rowIconUpload = document.getElementById('row-icon-upload');

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
let modalMode = 'session'; // 'session', 'template', 'edit-template'
let editingTemplateIdx = -1;
let selectedIconData = null;

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
  window.openModal = (mode, tIdx = -1) => {
    modalMode = mode;
    editingTemplateIdx = tIdx;
    selectedIconData = null;
    
    // Reset defaults
    btnDeletePreset.style.display = (mode === 'edit-template') ? 'block' : 'none';
    rowIconUpload.style.display = (mode === 'session') ? 'none' : 'flex'; 

    if (mode === 'template') {
      modalEditableTitle.innerText = "Focus Session";
      btnStartSessionSubmit.innerText = "Create Template";
      inputHours.value = 1;
      inputMinutes.value = 0;
      inputSessionSites.value = '';
      inputSessionApps.value = '';
      modalIconPreview.innerHTML = '<i class="ph ph-star"></i>';
    } else if (mode === 'session') {
      modalEditableTitle.innerText = "Focus Session";
      btnStartSessionSubmit.innerText = "Start Now";
      inputHours.value = Math.floor(appConfig.defaultDuration / 3600) || 1;
      inputMinutes.value = Math.floor((appConfig.defaultDuration % 3600) / 60) || 0;
      inputSessionSites.value = '';
      inputSessionApps.value = '';
    } else if (mode === 'edit-template') {
      const t = appConfig.templates[tIdx];
      modalEditableTitle.innerText = t.name;
      btnStartSessionSubmit.innerText = "Update";
      inputHours.value = Math.floor((t.duration || 3600) / 3600);
      inputMinutes.value = Math.floor(((t.duration || 3600) % 3600) / 60);
      inputSessionSites.value = (t.sites || []).join(', ');
      inputSessionApps.value = (t.apps || []).join(', ');
      
      if (t.iconData) {
        modalIconPreview.innerHTML = `<img src="${t.iconData}">`;
        selectedIconData = t.iconData;
      } else {
        const pIcon = t.pIcon || 'star';
        modalIconPreview.innerHTML = `<i class="ph ph-${pIcon}"></i>`;
      }
    }

    modalNewBlock.classList.add('active');
  };

  btnNewBlock.addEventListener('click', () => window.openModal('template'));
  btnBlockNow.addEventListener('click', () => window.openModal('session'));
  btnScheduleSession?.addEventListener('click', () => window.openModal('session'));

  btnCloseModals.forEach(btn => {
    btn.addEventListener('click', () => {
      modalNewBlock.classList.remove('active');
    });
  });

  // Icon upload logic
  inputSessionIcon.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        selectedIconData = event.target.result;
        modalIconPreview.innerHTML = `<img src="${selectedIconData}">`;
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  });

  // Delete Template logic
  btnDeletePreset.addEventListener('click', async () => {
    if (editingTemplateIdx > -1) {
      if (confirm('Are you sure you want to delete this template?')) {
        appConfig.templates.splice(editingTemplateIdx, 1);
        await window.focusAPI.saveConfig(appConfig);
        renderPresets(appConfig.templates);
        modalNewBlock.classList.remove('active');
      }
    }
  });
}

function setupActions() {
  btnStartSessionSubmit.addEventListener('click', async () => {
    const name = modalEditableTitle.innerText.trim() || "Focus Session";
    const duration = (parseInt(inputHours.value || 0) * 3600) + (parseInt(inputMinutes.value || 0) * 60);
    const sitesRaw = inputSessionSites.value.split(',').map(s => s.trim()).filter(s => s);
    const appsRaw = inputSessionApps.value.split(',').map(a => a.trim()).filter(a => a);

    if (modalMode === 'template' || modalMode === 'edit-template') {
      const templateData = {
        name,
        desc: `Duration: ${Math.floor(duration/3600)}h ${Math.floor((duration%3600)/60)}m`,
        pIcon: 'star', // fallback
        iconData: selectedIconData || null,
        sites: sitesRaw,
        apps: appsRaw,
        duration: duration
      };

      if (modalMode === 'template') {
        appConfig.templates.push(templateData);
      } else {
        // preserve iconData if not changed? 
        // selectedIconData is null if not changed, but we set it in openModal from t.iconData
        appConfig.templates[editingTemplateIdx] = templateData;
      }

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
    const card = document.createElement('div');
    card.className = 'preset-card';
    card.style.cursor = 'pointer';
    
    let iconHTML = '';
    if (t.iconData) {
      iconHTML = `<div class="preset-icon-circle"><img src="${t.iconData}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;"></div>`;
    } else {
      const pIcon = t.pIcon || iconMap[t.icon] || 'star';
      iconHTML = `<i class="ph ph-${pIcon} preset-icon"></i>`;
    }

    card.innerHTML = `
      <div class="preset-left">
        ${iconHTML}
        <div class="preset-details">
          <h4>${t.name}</h4>
          <p>${t.desc}</p>
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="add-btn start-preset-btn" data-index="${i}">Start Now</button>
      </div>
    `;
    
    // Whole card click opens setup (Update/Delete)
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('start-preset-btn')) return;
      // Use the closeModal logic if we want to ensure only one modal
      // We need to call the setupModals' local openModal. 
      // Let's expose it or just trigger it.
      // Easiest is to just call a global one or find a way.
      // I'll define openModal as a higher scope function.
      window.openModal('edit-template', i);
    });

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
