/**
 * ProfitRank - Gamified Profit & Goal Tracker
 * Inspired by hand-drawn Tier Roadmap (Bronze -> Silver -> Gold -> Diamond -> Ace)
 */

// Default Milestones from User's hand-drawn paper sketch
const DEFAULT_TIERS_CONFIG = [
  {
    id: 'bronze',
    name: 'Bronze',
    icon: '🥉',
    min: 0,
    max: 1000,
    color: '#cd7f32',
    milestones: [50, 100, 250, 500, 800, 1000]
  },
  {
    id: 'silver',
    name: 'Silver',
    icon: '🥈',
    min: 1000,
    max: 2000,
    color: '#cbd5e1',
    milestones: [1200, 1400, 1600, 1800, 2000]
  },
  {
    id: 'gold',
    name: 'Gold',
    icon: '🥇',
    min: 2000,
    max: 5000,
    color: '#f59e0b',
    milestones: [2600, 3200, 3800, 4400, 5000]
  },
  {
    id: 'diamond',
    name: 'Diamond',
    icon: '💎',
    min: 5000,
    max: 8000,
    color: '#38bdf8',
    milestones: [5600, 6200, 6800, 7400, 8000]
  },
  {
    id: 'ace',
    name: 'Ace',
    icon: '👑',
    min: 8000,
    max: 10000,
    color: '#f43f5e',
    milestones: [8500, 9000, 9500, 10000]
  }
];

const STORAGE_KEY = 'PROFIT_RANK_DATA_V1';

// Initial App State
let appState = {
  currency: '$',
  totalProfit: 0,
  ledger: [], // [{ id, date, amount, note }]
  checkedMilestones: {}, // { 'bronze-0': true, ... }
  tiers: JSON.parse(JSON.stringify(DEFAULT_TIERS_CONFIG)),
  syncMode: true, // Auto-check milestones when profit changes
  soundEnabled: true,
  lastCelebratedTier: 'bronze'
};

/* ==========================================================================
   Web Audio API Sound Synthesizer (No external dependencies)
   ========================================================================== */
class SoundEngine {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  playCheckSound() {
    if (!appState.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  playRankUpSound() {
    if (!appState.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5 fanfare
      notes.forEach((freq, idx) => {
        const now = this.ctx.currentTime + idx * 0.09;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.25);
      });
    } catch (e) {
      console.warn('Rank up audio error:', e);
    }
  }

  playVictoryFanfare() {
    if (!appState.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const chord = [523.25, 659.25, 783.99, 1046.50]; // C Major triumph
      chord.forEach((freq, idx) => {
        const now = this.ctx.currentTime + idx * 0.1;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.7);
      });
    } catch (e) {
      console.warn('Victory audio error:', e);
    }
  }
}

const sounds = new SoundEngine();

/* ==========================================================================
   Confetti Particle Engine
   ========================================================================== */
class ConfettiCannon {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.particles = [];
    this.animationId = null;

    if (this.canvas) {
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  fire(duration = 2500) {
    if (!this.canvas || !this.ctx) return;
    this.resize();

    const colors = ['#f59e0b', '#38bdf8', '#10b981', '#f43f5e', '#a855f7', '#fbbf24', '#ffffff'];
    const count = 120;

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: this.canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: this.canvas.height * 0.65,
        vx: (Math.random() - 0.5) * 18,
        vy: -(Math.random() * 18 + 12),
        size: Math.random() * 8 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 12,
        opacity: 1,
        gravity: 0.55
      });
    }

    if (!this.animationId) {
      this.animate();
    }

    setTimeout(() => {
      // Particles will naturally fade out
    }, duration);
  }

  animate() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rSpeed;
      p.opacity -= 0.007;

      if (p.opacity <= 0 || p.y > this.canvas.height) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = p.opacity;
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animationId = requestAnimationFrame(() => this.animate());
    } else {
      this.animationId = null;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

const confetti = new ConfettiCannon('confetti-canvas');

/* ==========================================================================
   State & Vercel Blob Cloud Storage Handlers
   ========================================================================== */
let cloudSyncState = {
  status: 'idle', // 'idle' | 'loading' | 'saving' | 'connected' | 'error'
  lastSyncTime: null,
  errorMessage: null
};

let cloudSaveTimeout = null;

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: '✅',
    error: '❌',
    info: '☁️',
    warning: '⚠️'
  };

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '☁️'}</span>
    <span class="toast-text">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function updateCloudSyncUI() {
  const pill = document.getElementById('cloud-sync-pill');
  const dot = document.getElementById('cloud-sync-dot');
  const text = document.getElementById('cloud-sync-text');
  const settingsBadge = document.getElementById('settings-cloud-badge');
  const infoStatus = document.getElementById('cloud-info-status');
  const infoTime = document.getElementById('cloud-info-time');

  if (!pill) return;

  let label = 'Cloud Synced';
  let dotClass = 'sync-connected';
  let badgeClass = 'status-connected';
  let statusText = 'Connected to Vercel Blob';

  switch (cloudSyncState.status) {
    case 'loading':
      label = 'Loading Cloud...';
      dotClass = 'sync-loading';
      badgeClass = 'status-syncing';
      statusText = 'Fetching latest data...';
      break;
    case 'saving':
      label = 'Saving Cloud...';
      dotClass = 'sync-saving';
      badgeClass = 'status-syncing';
      statusText = 'Writing changes to Blob...';
      break;
    case 'connected':
      label = 'Cloud Synced ☁️';
      dotClass = 'sync-connected';
      badgeClass = 'status-connected';
      statusText = 'Connected & in sync';
      break;
    case 'error':
      label = 'Cloud Offline ⚠️';
      dotClass = 'sync-error';
      badgeClass = 'status-error';
      statusText = cloudSyncState.errorMessage || 'Sync failed';
      break;
    default:
      label = 'Connecting...';
      dotClass = 'sync-loading';
      badgeClass = '';
      statusText = 'Connecting...';
  }

  if (dot) {
    dot.className = `sync-dot ${dotClass}`;
  }
  if (text) {
    text.textContent = label;
  }
  pill.title = cloudSyncState.errorMessage 
    ? `Cloud error: ${cloudSyncState.errorMessage} (Click to open Settings)` 
    : `Vercel Blob Storage: ${statusText}`;

  if (settingsBadge) {
    settingsBadge.textContent = cloudSyncState.status.toUpperCase();
    settingsBadge.className = `badge-status ${badgeClass}`;
  }
  if (infoStatus) {
    infoStatus.textContent = statusText;
  }
  if (infoTime) {
    if (cloudSyncState.lastSyncTime) {
      const date = new Date(cloudSyncState.lastSyncTime);
      infoTime.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } else {
      infoTime.textContent = 'Never';
    }
  }
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      appState = { ...appState, ...saved };
      if (!appState.tiers || !appState.tiers.length) {
        appState.tiers = JSON.parse(JSON.stringify(DEFAULT_TIERS_CONFIG));
      }
    }
  } catch (e) {
    console.error('Failed to load state from localStorage', e);
  }
}

async function fetchCloudState() {
  cloudSyncState.status = 'loading';
  updateCloudSyncUI();

  try {
    const res = await fetch('/api/state');
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `HTTP ${res.status}`);
    }

    const json = await res.json();

    if (json.exists && json.data) {
      appState = { ...appState, ...json.data };
      if (!appState.tiers || !appState.tiers.length) {
        appState.tiers = JSON.parse(JSON.stringify(DEFAULT_TIERS_CONFIG));
      }
      cloudSyncState.lastSyncTime = json.lastUpdated || new Date().toISOString();
      cloudSyncState.status = 'connected';
      cloudSyncState.errorMessage = null;

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      } catch (e) {}

      renderAll();
      showToast('Synced latest data from Vercel Blob', 'success');
    } else {
      // First run: push current state to Blob
      cloudSyncState.status = 'connected';
      cloudSyncState.lastSyncTime = new Date().toISOString();
      await pushStateToCloud(true);
      showToast('Initialized cloud storage with current data', 'info');
    }
  } catch (err) {
    console.warn('Vercel Blob sync note:', err.message);
    cloudSyncState.status = 'error';
    cloudSyncState.errorMessage = err.message;
    // Fall back to local state
    loadLocalState();
    renderAll();
  } finally {
    updateCloudSyncUI();
  }
}

async function pushStateToCloud(immediate = false) {
  if (cloudSaveTimeout) {
    clearTimeout(cloudSaveTimeout);
    cloudSaveTimeout = null;
  }

  const executeSave = async () => {
    cloudSyncState.status = 'saving';
    updateCloudSyncUI();

    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appState)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }

      const json = await res.json();
      cloudSyncState.status = 'connected';
      cloudSyncState.lastSyncTime = json.lastUpdated || new Date().toISOString();
      cloudSyncState.errorMessage = null;
    } catch (err) {
      console.error('Failed to save to Vercel Blob:', err);
      cloudSyncState.status = 'error';
      cloudSyncState.errorMessage = err.message;
    } finally {
      updateCloudSyncUI();
    }
  };

  if (immediate) {
    await executeSave();
  } else {
    cloudSyncState.status = 'saving';
    updateCloudSyncUI();
    cloudSaveTimeout = setTimeout(executeSave, 600);
  }
}

function saveState(immediate = false) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
  pushStateToCloud(immediate);
}

/* ==========================================================================
   Core Calculations & Helpers
   ========================================================================== */
function formatNumber(num) {
  return Number(num).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2
  });
}

function getUltimateGoal() {
  const aceTier = appState.tiers.find(t => t.id === 'ace');
  if (aceTier && aceTier.milestones && aceTier.milestones.length) {
    return aceTier.milestones[aceTier.milestones.length - 1];
  }
  return 10000;
}

function getAllMilestonesFlat() {
  const list = [];
  appState.tiers.forEach(tier => {
    tier.milestones.forEach((val, idx) => {
      list.push({
        key: `${tier.id}-${idx}`,
        tierId: tier.id,
        val: val,
        label: `${tier.name} • ${appState.currency}${formatNumber(val)}`
      });
    });
  });
  return list;
}

function determineCurrentTier(profit) {
  for (let i = appState.tiers.length - 1; i >= 0; i--) {
    const tier = appState.tiers[i];
    if (profit >= tier.min) {
      return tier;
    }
  }
  return appState.tiers[0];
}

function getNextMilestone(profit) {
  const all = getAllMilestonesFlat().sort((a, b) => a.val - b.val);
  for (const m of all) {
    if (profit < m.val) {
      return m;
    }
  }
  return null;
}

/* ==========================================================================
   UI Rendering
   ========================================================================== */
function renderAll() {
  updateCurrencyDisplay();
  renderMilestoneColumns();
  renderHeroStats();
  renderRoadmapTrack();
  renderLedgerTable();
  updateSoundIcon();
}

function updateCurrencyDisplay() {
  document.querySelectorAll('.currency-sym').forEach(el => {
    el.textContent = appState.currency;
  });
  const currencySelect = document.getElementById('currency-select');
  if (currencySelect) {
    currencySelect.value = appState.currency;
  }
}

function renderMilestoneColumns() {
  const currentTier = determineCurrentTier(appState.totalProfit);

  appState.tiers.forEach(tier => {
    const listEl = document.getElementById(`milestones-list-${tier.id}`);
    const progressEl = document.getElementById(`tier-progress-${tier.id}`);
    const countEl = document.getElementById(`tier-count-${tier.id}`);
    const statusEl = document.getElementById(`tier-badge-status-${tier.id}`);
    const colEl = document.getElementById(`tier-col-${tier.id}`);

    if (!listEl) return;

    let checkedCount = 0;
    const totalCount = tier.milestones.length;

    // Check tier active status
    const isUnlocked = appState.totalProfit >= tier.min;
    const isCompleted = appState.totalProfit >= tier.max;
    const isCurrent = currentTier.id === tier.id;

    if (colEl) {
      colEl.classList.toggle('current-active', isCurrent);
    }

    if (statusEl) {
      if (isCompleted) {
        statusEl.textContent = 'Cleared ✓';
        statusEl.className = 'tier-status-indicator completed';
      } else if (isUnlocked) {
        statusEl.textContent = 'Active';
        statusEl.className = 'tier-status-indicator active';
      } else {
        statusEl.textContent = 'Locked';
        statusEl.className = 'tier-status-indicator';
      }
    }

    // Build milestone checkpoint items
    listEl.innerHTML = '';
    tier.milestones.forEach((val, idx) => {
      const key = `${tier.id}-${idx}`;
      const isChecked = Boolean(appState.checkedMilestones[key]);
      if (isChecked) checkedCount++;

      const item = document.createElement('div');
      item.className = `milestone-item ${isChecked ? 'checked' : ''}`;
      item.dataset.key = key;
      item.dataset.tier = tier.id;
      item.dataset.val = val;

      item.innerHTML = `
        <div class="milestone-val-box">
          <span class="milestone-val">
            <span class="curr">${appState.currency}</span>${formatNumber(val)}
          </span>
          <span class="milestone-label">${tier.name} Checkpoint #${idx + 1}</span>
        </div>
        <div class="milestone-checkbox" role="checkbox" aria-checked="${isChecked}"></div>
      `;

      item.addEventListener('click', () => handleMilestoneClick(key, val, tier.id));
      listEl.appendChild(item);
    });

    // Update tier column progress bar
    if (progressEl) {
      const pct = (checkedCount / totalCount) * 100;
      progressEl.style.width = `${pct}%`;
    }
    if (countEl) {
      countEl.textContent = `${checkedCount}/${totalCount}`;
    }
  });
}

function renderHeroStats() {
  const currentTier = determineCurrentTier(appState.totalProfit);
  const ultimateGoal = getUltimateGoal();

  // Total profit text
  const totalProfitNumEl = document.getElementById('total-profit-num');
  if (totalProfitNumEl) {
    totalProfitNumEl.textContent = formatNumber(appState.totalProfit);
  }

  // Goal Difference
  const diffEl = document.getElementById('goal-difference-text');
  const remainingVal = Math.max(0, ultimateGoal - appState.totalProfit);
  if (diffEl) {
    if (appState.totalProfit >= ultimateGoal) {
      diffEl.innerHTML = `<strong style="color: #34d399">Goal Conquered! Outstanding Ace Master!</strong>`;
    } else {
      diffEl.innerHTML = `Need <strong id="remaining-to-goal">${appState.currency}${formatNumber(remainingVal)}</strong> to reach Ace (10K)`;
    }
  }

  // Current tier pill in header
  const tierPill = document.getElementById('current-tier-pill');
  const tierNameEl = document.getElementById('current-tier-name');
  if (tierPill && tierNameEl) {
    tierPill.className = `tier-badge-pill tier-${currentTier.id}`;
    tierPill.querySelector('.tier-pill-icon').textContent = currentTier.icon;
    tierNameEl.textContent = `${currentTier.name} Tier`;
  }

  // Journey status text
  const journeyTitle = document.getElementById('journey-status-title');
  if (journeyTitle) {
    journeyTitle.textContent = `${currentTier.icon} ${currentTier.name} League`;
  }

  // Next milestone info
  const nextMilestone = getNextMilestone(appState.totalProfit);
  const nextInfo = document.getElementById('next-milestone-info');
  if (nextInfo) {
    if (nextMilestone) {
      nextInfo.innerHTML = `Next milestone: <span id="next-milestone-val" class="highlight-val">${appState.currency}${formatNumber(nextMilestone.val)}</span> (${appState.currency}${formatNumber(nextMilestone.val - appState.totalProfit)} away)`;
    } else {
      nextInfo.innerHTML = `<span style="color: #34d399; font-weight: 700;">All Roadmap Checkpoints Completed! 🏆</span>`;
    }
  }

  // Stepper dots
  document.querySelectorAll('.tier-dot').forEach(dot => {
    const tierId = dot.dataset.tier;
    const tierObj = appState.tiers.find(t => t.id === tierId);
    if (tierObj && appState.totalProfit >= tierObj.min) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });

  // Progress Ring
  const circle = document.getElementById('master-progress-circle');
  const percentageEl = document.getElementById('overall-percentage');
  const circumference = 2 * Math.PI * 40; // r=40 -> ~251.32
  const progressRatio = Math.min(1, Math.max(0, appState.totalProfit / ultimateGoal));
  const offset = circumference - (progressRatio * circumference);

  if (circle) {
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = offset;
  }
  if (percentageEl) {
    percentageEl.textContent = `${Math.round(progressRatio * 100)}%`;
  }
}

function renderRoadmapTrack() {
  const allMilestones = getAllMilestonesFlat();
  const totalCount = allMilestones.length;
  const checkedCount = Object.values(appState.checkedMilestones).filter(Boolean).length;

  const countEl = document.getElementById('completed-checkpoints-count');
  if (countEl) {
    countEl.textContent = `${checkedCount} / ${totalCount} Checkpoints Reached`;
  }

  const barFill = document.getElementById('master-progress-bar-fill');
  if (barFill) {
    const ultimateGoal = getUltimateGoal();
    const ratio = Math.min(1, Math.max(0, appState.totalProfit / ultimateGoal));
    barFill.style.width = `${ratio * 100}%`;
  }
}

function renderLedgerTable() {
  const tbody = document.getElementById('ledger-table-body');
  const emptyState = document.getElementById('ledger-empty-state');
  const badgeCount = document.getElementById('ledger-badge-count');
  const totalEntriesEl = document.getElementById('ledger-total-entries');
  const totalSumEl = document.getElementById('ledger-total-sum');

  if (badgeCount) badgeCount.textContent = appState.ledger.length;
  if (totalEntriesEl) totalEntriesEl.textContent = appState.ledger.length;

  const accumulatedSum = appState.ledger.reduce((acc, curr) => acc + curr.amount, 0);
  if (totalSumEl) {
    totalSumEl.textContent = `${appState.currency}${formatNumber(accumulatedSum)}`;
  }

  if (!tbody) return;

  if (appState.ledger.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = '';
  // Show newest first
  [...appState.ledger].reverse().forEach(entry => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${entry.date}</td>
      <td class="ledger-amount">+${appState.currency}${formatNumber(entry.amount)}</td>
      <td>${escapeHtml(entry.note || 'Profit log')}</td>
      <td>
        <button class="ledger-del-btn" data-id="${entry.id}" title="Remove entry">🗑️</button>
      </td>
    `;

    tr.querySelector('.ledger-del-btn').addEventListener('click', () => {
      deleteLedgerEntry(entry.id);
    });

    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateSoundIcon() {
  const icon = document.getElementById('sound-icon');
  if (icon) {
    icon.textContent = appState.soundEnabled ? '🔊' : '🔇';
  }
}

/* ==========================================================================
   User Interactions & Event Handlers
   ========================================================================== */
function handleMilestoneClick(key, val, tierId) {
  sounds.init();
  const willBeChecked = !appState.checkedMilestones[key];
  appState.checkedMilestones[key] = willBeChecked;

  if (willBeChecked) {
    sounds.playCheckSound();

    // If syncMode is active and user clicked a higher milestone than current profit,
    // optionally lift current profit to match this milestone
    if (appState.syncMode && appState.totalProfit < val) {
      const prevTier = determineCurrentTier(appState.totalProfit);
      appState.totalProfit = val;
      syncMilestonesWithProfit();
      checkTierPromotion(prevTier);
    }
  }

  saveState();
  renderAll();
}

function handleLogProfit(amount, note) {
  sounds.init();
  if (isNaN(amount) || amount <= 0) return;

  const prevTier = determineCurrentTier(appState.totalProfit);

  // Add to total
  appState.totalProfit += amount;

  // Add ledger entry
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  appState.ledger.push({
    id: Date.now() + Math.random().toString(36).substr(2, 4),
    date: formattedDate,
    amount: amount,
    note: note.trim()
  });

  if (appState.syncMode) {
    syncMilestonesWithProfit();
  }

  sounds.playCheckSound();
  confetti.fire(1200);

  checkTierPromotion(prevTier);

  saveState();
  renderAll();
}

function syncMilestonesWithProfit() {
  appState.tiers.forEach(tier => {
    tier.milestones.forEach((val, idx) => {
      const key = `${tier.id}-${idx}`;
      if (appState.totalProfit >= val) {
        appState.checkedMilestones[key] = true;
      }
    });
  });
}

function checkTierPromotion(prevTier) {
  const newTier = determineCurrentTier(appState.totalProfit);
  const ultimateGoal = getUltimateGoal();

  if (appState.totalProfit >= ultimateGoal && appState.lastCelebratedTier !== 'goal-conquered') {
    appState.lastCelebratedTier = 'goal-conquered';
    triggerCelebrationModal(
      '👑',
      'LEGENDARY VICTORY!',
      'Ace Master 10K Achieved!',
      `Incredible work! You have cleared all checkpoints and reached your full ${appState.currency}${formatNumber(ultimateGoal)} profit goal!`,
      appState.totalProfit
    );
    sounds.playVictoryFanfare();
    confetti.fire(4000);
    return;
  }

  const tierOrder = ['bronze', 'silver', 'gold', 'diamond', 'ace'];
  const prevIdx = tierOrder.indexOf(prevTier.id);
  const newIdx = tierOrder.indexOf(newTier.id);

  if (newIdx > prevIdx) {
    appState.lastCelebratedTier = newTier.id;
    triggerCelebrationModal(
      newTier.icon,
      'RANK PROMOTION!',
      `Promoted to ${newTier.name} Tier!`,
      `Congratulations! Your profits surpassed ${appState.currency}${formatNumber(newTier.min)}. You're climbing higher towards Ace!`,
      appState.totalProfit
    );
    sounds.playRankUpSound();
    confetti.fire(3000);
  }
}

function triggerCelebrationModal(icon, tag, title, desc, profitVal) {
  const modal = document.getElementById('celebration-modal');
  const badgeEl = document.getElementById('celebration-badge');
  const tagEl = document.getElementById('celebration-tag');
  const titleEl = document.getElementById('celebration-title');
  const descEl = document.getElementById('celebration-desc');
  const valEl = document.getElementById('celebration-profit-val');

  if (badgeEl) badgeEl.textContent = icon;
  if (tagEl) tagEl.textContent = tag;
  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc;
  if (valEl) valEl.textContent = `${appState.currency}${formatNumber(profitVal)}`;

  if (modal) modal.classList.add('open');
}

function deleteLedgerEntry(id) {
  const idx = appState.ledger.findIndex(item => item.id === id);
  if (idx !== -1) {
    const item = appState.ledger[idx];
    appState.ledger.splice(idx, 1);
    
    // Optionally ask or adjust total profit if user wants
    if (confirm(`Remove entry +${appState.currency}${formatNumber(item.amount)}? Deduct this from total profit as well?`)) {
      appState.totalProfit = Math.max(0, appState.totalProfit - item.amount);
      // Re-evaluate checkboxes
      if (appState.syncMode) {
        // Reset and re-sync
        appState.checkedMilestones = {};
        syncMilestonesWithProfit();
      }
    }
    saveState();
    renderAll();
  }
}

/* ==========================================================================
   Modals Management
   ========================================================================== */
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
  }
}

function setupModalClosers() {
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close-modal');
      closeModal(modalId);
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('open');
      }
    });
  });
}

/* ==========================================================================
   Customize Milestones Modal Setup
   ========================================================================== */
function openCustomizeModal() {
  const container = document.getElementById('customize-inputs-container');
  if (!container) return;

  container.innerHTML = '';
  appState.tiers.forEach(tier => {
    tier.milestones.forEach((val, idx) => {
      const div = document.createElement('div');
      div.className = 'customize-item';
      div.innerHTML = `
        <label>${tier.icon} ${tier.name} #${idx + 1}</label>
        <input type="number" step="any" data-tier="${tier.id}" data-idx="${idx}" value="${val}">
      `;
      container.appendChild(div);
    });
  });

  openModal('customize-milestones-modal');
}

function saveCustomMilestones() {
  const inputs = document.querySelectorAll('#customize-inputs-container input');
  inputs.forEach(input => {
    const tierId = input.dataset.tier;
    const idx = parseInt(input.dataset.idx, 10);
    const val = parseFloat(input.value);

    const tier = appState.tiers.find(t => t.id === tierId);
    if (tier && !isNaN(val) && val >= 0) {
      tier.milestones[idx] = val;
    }
  });

  // Re-sort milestones in each tier
  appState.tiers.forEach(tier => {
    tier.milestones.sort((a, b) => a - b);
    tier.max = tier.milestones[tier.milestones.length - 1];
  });

  if (appState.syncMode) {
    syncMilestonesWithProfit();
  }

  saveState();
  renderAll();
  closeModal('customize-milestones-modal');
}

/* ==========================================================================
   Export / Import Handlers
   ========================================================================== */
function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `profitrank-backup-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported && typeof imported === 'object') {
        appState = { ...appState, ...imported };
        saveState(true);
        renderAll();
        showToast('Backup restored and synced to Vercel Blob!', 'success');
        closeModal('settings-modal');
      }
    } catch (err) {
      showToast('Error reading backup: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

/* ==========================================================================
   Initialization & Event Listeners
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Load local cache first for instant UI response
  loadLocalState();
  setupModalClosers();
  renderAll();

  // Connect to Vercel Blob cloud storage
  fetchCloudState();

  // Cloud Sync Pill click opens Settings modal
  const syncPill = document.getElementById('cloud-sync-pill');
  if (syncPill) {
    syncPill.addEventListener('click', () => {
      openModal('settings-modal');
    });
  }

  // Cloud Sync Now (Push)
  const syncNowBtn = document.getElementById('cloud-sync-now-btn');
  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', async () => {
      showToast('Saving data to Vercel Blob...', 'info');
      await pushStateToCloud(true);
      if (cloudSyncState.status === 'connected') {
        showToast('Successfully saved to Vercel Blob!', 'success');
      } else {
        showToast('Cloud save failed: ' + (cloudSyncState.errorMessage || 'Check Vercel token'), 'error');
      }
    });
  }

  // Cloud Pull (Reload)
  const cloudPullBtn = document.getElementById('cloud-pull-btn');
  if (cloudPullBtn) {
    cloudPullBtn.addEventListener('click', async () => {
      showToast('Fetching latest from Vercel Blob...', 'info');
      await fetchCloudState();
    });
  }

  // Quick Log Form
  const quickLogForm = document.getElementById('quick-log-form');
  if (quickLogForm) {
    quickLogForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('log-profit-input');
      const noteInput = document.getElementById('log-note-input');
      const val = parseFloat(input.value);
      if (!isNaN(val) && val > 0) {
        handleLogProfit(val, noteInput.value || '');
        input.value = '';
        noteInput.value = '';
      }
    });
  }

  // Currency select change
  const currencySelect = document.getElementById('currency-select');
  if (currencySelect) {
    currencySelect.addEventListener('change', (e) => {
      appState.currency = e.target.value;
      saveState();
      renderAll();
    });
  }

  // Sound toggle
  const soundBtn = document.getElementById('sound-toggle-btn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      appState.soundEnabled = !appState.soundEnabled;
      sounds.init();
      if (appState.soundEnabled) sounds.playCheckSound();
      updateSoundIcon();
      saveState();
    });
  }

  // History / Ledger toggle button
  const historyBtn = document.getElementById('history-toggle-btn');
  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      renderLedgerTable();
      openModal('history-modal');
    });
  }

  // Clear Ledger button
  const clearLedgerBtn = document.getElementById('clear-ledger-btn');
  if (clearLedgerBtn) {
    clearLedgerBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear your profit entry ledger? (Your total profit will remain unchanged)')) {
        appState.ledger = [];
        saveState();
        renderLedgerTable();
      }
    });
  }

  // Settings toggle
  const settingsBtn = document.getElementById('settings-toggle-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      const syncToggle = document.getElementById('sync-mode-toggle');
      if (syncToggle) syncToggle.checked = appState.syncMode;
      openModal('settings-modal');
    });
  }

  // Sync mode toggle in settings
  const syncToggle = document.getElementById('sync-mode-toggle');
  if (syncToggle) {
    syncToggle.addEventListener('change', (e) => {
      appState.syncMode = e.target.checked;
      const tag = document.getElementById('sync-mode-tag');
      if (tag) {
        tag.textContent = appState.syncMode ? '⚡ Auto-checks milestones' : 'Manual milestone check';
      }
      saveState();
    });
  }

  // Manual Edit Profit
  const quickEditBtn = document.getElementById('quick-edit-profit-btn');
  const manualProfitInput = document.getElementById('manual-profit-input');
  const saveManualProfitBtn = document.getElementById('save-manual-profit-btn');

  if (quickEditBtn) {
    quickEditBtn.addEventListener('click', () => {
      if (manualProfitInput) manualProfitInput.value = appState.totalProfit;
      openModal('edit-profit-modal');
    });
  }

  if (saveManualProfitBtn) {
    saveManualProfitBtn.addEventListener('click', () => {
      const val = parseFloat(manualProfitInput.value);
      if (!isNaN(val) && val >= 0) {
        const prevTier = determineCurrentTier(appState.totalProfit);
        appState.totalProfit = val;
        if (appState.syncMode) {
          appState.checkedMilestones = {};
          syncMilestonesWithProfit();
        }
        checkTierPromotion(prevTier);
        saveState();
        renderAll();
        closeModal('edit-profit-modal');
      }
    });
  }

  // Customize Milestones
  const customizeBtn = document.getElementById('customize-milestones-btn');
  if (customizeBtn) {
    customizeBtn.addEventListener('click', openCustomizeModal);
  }

  const saveCustomMilestonesBtn = document.getElementById('save-custom-milestones-btn');
  if (saveCustomMilestonesBtn) {
    saveCustomMilestonesBtn.addEventListener('click', saveCustomMilestones);
  }

  const restoreDefaultMilestonesBtn = document.getElementById('restore-default-milestones-btn');
  if (restoreDefaultMilestonesBtn) {
    restoreDefaultMilestonesBtn.addEventListener('click', () => {
      if (confirm('Reset milestones to default paper layout?')) {
        appState.tiers = JSON.parse(JSON.stringify(DEFAULT_TIERS_CONFIG));
        if (appState.syncMode) syncMilestonesWithProfit();
        saveState();
        renderAll();
        closeModal('customize-milestones-modal');
      }
    });
  }

  // Export Data
  const exportBtn = document.getElementById('export-data-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportData);
  }

  // Import Data
  const importFileInput = document.getElementById('import-data-file');
  if (importFileInput) {
    importFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importData(e.target.files[0]);
      }
    });
  }

  // Danger Hard Reset
  const hardResetBtn = document.getElementById('hard-reset-btn');
  if (hardResetBtn) {
    hardResetBtn.addEventListener('click', async () => {
      if (confirm('⚠️ Erase all data, reset profits to 0, and clear all checkboxes?')) {
        localStorage.removeItem(STORAGE_KEY);
        appState.totalProfit = 0;
        appState.ledger = [];
        appState.checkedMilestones = {};
        appState.tiers = JSON.parse(JSON.stringify(DEFAULT_TIERS_CONFIG));
        saveState(true);
        renderAll();
        showToast('All data erased and reset locally & in cloud', 'warning');
        closeModal('settings-modal');
      }
    });
  }

  // Board Header Reset
  const resetAllBtn = document.getElementById('reset-all-btn');
  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', () => {
      if (confirm('Reset current progress to 0?')) {
        appState.totalProfit = 0;
        appState.checkedMilestones = {};
        saveState(true);
        renderAll();
        showToast('Progress reset to 0', 'info');
      }
    });
  }
});
