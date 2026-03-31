/* ===================================================
   BARBER TYCOON IDLE — Game Logic
   =================================================== */

'use strict';

// =================== GAME STATE ===================
const SAVE_KEY = 'barberTycoonSave_v2';

const defaultState = {
  money: 0,
  totalEarned: 0,
  clientsServed: 0,
  reputation: 1,
  lastSaveTime: Date.now(),
  upgrades: {
    extraChair:    { level: 0, maxLevel: 4 },
    fasterCut:     { level: 0, maxLevel: 5 },
    hireBarber:    { level: 0, maxLevel: 3 },
    beard:         { level: 0, maxLevel: 3 },
    marketing:     { level: 0, maxLevel: 4 },
    vipChair:      { level: 0, maxLevel: 3 },
    training:      { level: 0, maxLevel: 3 },
    premium:       { level: 0, maxLevel: 2 },
    goldScissors:  { level: 0, maxLevel: 1 },
  },
  achievements: {},
  ownedSkins: { default: true },
  currentSkin: 'default'
};

// =================== AUDIO MANAGER ===================
const audioManager = {
  ctx: null,
  muted: false,
  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { console.warn('Web Audio API not supported'); }
  },
  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  },
  playTone(freq, type, duration, vol=0.1) {
    if (this.muted || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },
  playSnip() {
    this.playTone(800, 'square', 0.1, 0.05);
    setTimeout(() => this.playTone(900, 'square', 0.1, 0.05), 50);
  },
  playCoin() {
    this.playTone(1200, 'sine', 0.15, 0.08);
    setTimeout(() => this.playTone(1600, 'sine', 0.3, 0.08), 50);
  },
  playBuy() {
    this.playTone(400, 'square', 0.1, 0.1);
    setTimeout(() => this.playTone(600, 'square', 0.1, 0.1), 100);
    setTimeout(() => this.playTone(800, 'sine', 0.3, 0.1), 200);
  }
};

// =================== POKI SDK & MOCK ===================
const pokiSDK = {
  initialized: false,
  init() {
    if (typeof PokiSDK !== 'undefined') {
      PokiSDK.init().then(() => {
        console.log("Poki SDK inicializado com sucesso.");
        this.initialized = true;
        PokiSDK.gameplayStart();
      }).catch(() => {
        console.log("Poki SDK falhou (Adblock?). Usando fallback.");
        this.initialized = true;
      });
    }
  },
  rewardedBreak() {
    return new Promise(resolve => {
      game.isPaused = true;

      if (this.initialized && typeof PokiSDK !== 'undefined') {
        PokiSDK.rewardedBreak().then(success => {
          game.isPaused = false;
          resolve(success);
        });
        return;
      }

      // Fallback Visual Mock
      const overlay = document.getElementById('adOverlay');
      const bar = document.getElementById('adProgressBar');
      if (overlay) overlay.classList.remove('hidden');
      
      if (bar) {
        void bar.offsetWidth; // trigger reflow
        bar.style.width = '100%';
      }

      setTimeout(() => {
        game.isPaused = false;
        if (overlay) overlay.classList.add('hidden');
        if (bar) bar.style.width = '0%';
        resolve(true); 
      }, 3000);
    });
  }
};

// =================== UPGRADE DEFINITIONS ===================
const UPGRADES = [
  {
    id: 'extraChair',
    icon: '💺',
    name: 'Cadeira Extra',
    desc: 'Adiciona +1 cadeira de atendimento',
    baseCost: 150,
    costMult: 2.8,
    maxLevel: 4,
    effect: () => {},
  },
  {
    id: 'fasterCut',
    icon: '⚡',
    name: 'Tesoura Veloz',
    desc: 'Reduz 18% no tempo de atendimento',
    baseCost: 200,
    costMult: 2.2,
    maxLevel: 5,
    effect: () => {},
  },
  {
    id: 'hireBarber',
    icon: '💈',
    name: 'Contratar Barbeiro',
    desc: 'Barbeiro automático (sem precisar clicar)',
    baseCost: 500,
    costMult: 4.0,
    maxLevel: 3,
    effect: () => {},
  },
  {
    id: 'beard',
    icon: '🪒',
    name: 'Serviço de Barba',
    desc: '+40% de ganho por cliente',
    baseCost: 300,
    costMult: 3.0,
    maxLevel: 3,
    effect: () => {},
  },
  {
    id: 'marketing',
    icon: '📢',
    name: 'Marketing',
    desc: 'Clientes chegam 25% mais rápido',
    baseCost: 400,
    costMult: 2.5,
    maxLevel: 4,
    effect: () => {},
  },
  {
    id: 'vipChair',
    icon: '👑',
    name: 'Cadeira VIP',
    desc: 'Atrai clientes VIP (pagam 3x mais)',
    baseCost: 700,
    costMult: 3.5,
    maxLevel: 3,
    effect: () => {},
  },
  {
    id: 'training',
    icon: '🎓',
    name: 'Treinamento Pro',
    desc: 'Barbeiros automáticos 2x mais rápidos',
    baseCost: 1000,
    costMult: 3.2,
    maxLevel: 3,
    effect: () => {},
    requires: 'hireBarber',
  },
  {
    id: 'premium',
    icon: '✨',
    name: 'Ambiente Premium',
    desc: '+80% de ganho total por cliente',
    baseCost: 3000,
    costMult: 5.0,
    maxLevel: 2,
    effect: () => {},
  },
  {
    id: 'goldScissors',
    icon: '🏆',
    name: 'Tesoura Dourada',
    desc: 'LENDÁRIA: 2x mais dinheiro em tudo!',
    baseCost: 10000,
    costMult: 1,
    maxLevel: 1,
    effect: () => {},
  },
];

// =================== ACHIEVEMENTS ===================
const ACHIEVEMENTS = [
  { id: 'first_cut',    icon: '✂️',  name: 'Primeiro Corte',   desc: '1 cliente atendido',     condition: s => s.clientsServed >= 1 },
  { id: 'ten_cuts',     icon: '💈',  name: 'Barbeiro Jr.',      desc: '10 clientes atendidos',  condition: s => s.clientsServed >= 10 },
  { id: 'fifty_cuts',   icon: '🔥',  name: 'Na Vibe!',          desc: '50 clientes atendidos',  condition: s => s.clientsServed >= 50 },
  { id: 'hundred',      icon: '💯',  name: 'Cem Cortes!',       desc: '100 clientes',           condition: s => s.clientsServed >= 100 },
  { id: 'rich100',      icon: '💵',  name: 'Primeiros $100',    desc: 'Ganhe $100 no total',    condition: s => s.totalEarned >= 100 },
  { id: 'rich1k',       icon: '💰',  name: 'Milhar!',           desc: 'Ganhe $1.000 no total',  condition: s => s.totalEarned >= 1000 },
  { id: 'rich10k',      icon: '🤑',  name: 'Dez Mil!',          desc: '$10.000 ganhos',         condition: s => s.totalEarned >= 10000 },
  { id: 'vip_served',   icon: '👑',  name: 'Realeza!',          desc: 'Atenda um cliente VIP',  condition: s => s._vipServed >= 1 },
  { id: 'auto_mode',    icon: '🤖',  name: 'Modo Automático',   desc: 'Contrate 1 barbeiro',    condition: s => (s.upgrades.hireBarber?.level || 0) >= 1 },
  { id: 'gold_scissor', icon: '✨',  name: 'Tesoura Lendária',  desc: 'Compre a Tesoura Dourada', condition: s => (s.upgrades.goldScissors?.level || 0) >= 1 },
];

// =================== PRESTIGE PHASES ===================
const PRESTIGE_PHASES = [
  { threshold: 0,       name: '🏪 Barbearia Simples',  bg: 'var(--bg-deep)'   },
  { threshold: 10000,   name: '🏬 Barbearia Moderna',  bg: '#0e0d15'           },
  { threshold: 100000,  name: '💎 Salão Premium',       bg: '#0b0e18'           },
];

// =================== SKINS ===================
const SKINS = [
  { id: 'default', name: 'Original', icon: '💈', cost: 0 },
  { id: 'retro',   name: 'Retrô 80s', icon: '🪩', cost: 5000 },
  { id: 'neon',    name: 'Cyber Neon',icon: '🤖', cost: 25000 },
  { id: 'lux',     name: 'Ouro Luxo', icon: '💎', cost: 100000 }
];

// =================== GAME OBJECT ===================
const game = {
  state: null,
  chairs: [],          // { id, clientId, clientType, progress, timeTotal, barberAuto, auto }
  queue: [],           // { id, type }
  clientIdCounter: 1,
  lastClientTime: 0,
  gameLoop: null,
  lastTick: null,
  tickRate: 100,       // ms per tick (10fps enough for idle)
  isPaused: false,
  boostEndTime: 0,

  // Computed stats (recalculated on upgrade)
  computed: {
    numChairs: 1,
    cutTime: 8000,          // ms per client
    clientInterval: 5000,   // ms between clients
    earningPerClient: 20,
    autoBarbers: 0,
    autoSpeed: 1.0,
    vipChance: 0.05,
    earningMultiplier: 1.0,
  },

  // ========================= INIT =========================
  init() {
    pokiSDK.init();
    audioManager.init();
    this.loadState();
    this.equipSkin(this.state.currentSkin || 'default', true);
    this.recalcComputed();
    this.renderChairs();
    this.renderUpgrades();
    this.renderAchievements();
    this.renderSkins();
    this.updateHUD();
    this.startLoop();
    this.checkOfflineEarnings();
    this.bindEvents();
    this.bindNavTabs();
    console.log('✂️ Barber Tycoon Idle started!');
  },

  // ========================= STATE =========================
  loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        this.state = Object.assign({}, defaultState, saved);
        // Make sure upgrades keys are all present
        for (const up of UPGRADES) {
          if (!this.state.upgrades[up.id]) {
            this.state.upgrades[up.id] = { level: 0, maxLevel: up.maxLevel };
          }
        }
        if (!this.state._vipServed) this.state._vipServed = 0;
      } else {
        this.state = JSON.parse(JSON.stringify(defaultState));
        this.state._vipServed = 0;
      }
    } catch (e) {
      this.state = JSON.parse(JSON.stringify(defaultState));
      this.state._vipServed = 0;
    }
  },

  saveState() {
    this.state.lastSaveTime = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
  },

  // ========================= COMPUTE STATS =========================
  recalcComputed() {
    const s = this.state;
    const upg = s.upgrades;

    // Chairs: 1 base + extra upgrades
    this.computed.numChairs = 1 + (upg.extraChair?.level || 0);

    // Cut time: base 8s, reduced by fasterCut
    let cutTime = 8000;
    cutTime *= Math.pow(0.82, upg.fasterCut?.level || 0);
    // Auto barber training
    const autoSpeedMult = Math.pow(0.55, upg.training?.level || 0);
    this.computed.autoSpeed = autoSpeedMult;
    this.computed.cutTime = cutTime;

    // Client arrival interval: base 4.5s
    let interval = 4500;
    interval *= Math.pow(0.75, upg.marketing?.level || 0);
    // Reputation bonus
    interval *= Math.pow(0.92, Math.min(s.reputation - 1, 20));
    this.computed.clientInterval = Math.max(interval, 800);

    // Earning per client
    let earn = 20;
    earn *= Math.pow(1.4, upg.beard?.level || 0);
    earn *= Math.pow(1.8, upg.premium?.level || 0);
    if (upg.goldScissors?.level >= 1) earn *= 2;
    this.computed.earningPerClient = earn;
    this.computed.earningMultiplier = earn / 20;

    // Auto barbers
    this.computed.autoBarbers = upg.hireBarber?.level || 0;

    // VIP chance
    let vipChance = 0.05;
    vipChance += (upg.vipChair?.level || 0) * 0.1;
    this.computed.vipChance = vipChance;

    // Adjust existing chairs array length
    const needed = this.computed.numChairs;
    while (this.chairs.length < needed) {
      this.chairs.push({ id: this.chairs.length, clientId: null, clientType: null, progress: 0, timeTotal: 0, autoBarber: false });
    }
    // Don't remove chairs (they become empty naturally)
  },

  getUpgradeCost(upgOrId) {
    // Accept either an upgrade object or a string id
    const id = typeof upgOrId === 'string' ? upgOrId : upgOrId.id;
    const def = UPGRADES.find(u => u.id === id);
    if (!def) return Infinity;
    const level = (this.state.upgrades[id]?.level) || 0;
    return Math.floor(def.baseCost * Math.pow(def.costMult, level));
  },

  getIncomePerMinute() {
    const avgClientsPerMin = 60000 / this.computed.clientInterval * this.computed.numChairs;
    const boost = Date.now() < this.boostEndTime ? 2 : 1;
    return Math.round(this.computed.earningPerClient * avgClientsPerMin * boost);
  },

  // ========================= GAME LOOP =========================
  startLoop() {
    this.lastTick = Date.now();
    this.lastClientTime = Date.now();
    
    const loop = () => {
      this.tick();
      this.gameLoop = requestAnimationFrame(loop);
    };
    this.gameLoop = requestAnimationFrame(loop);
    
    // autosave every 15s
    setInterval(() => this.saveState(), 15000);
  },

  tick() {
    if (this.isPaused) {
      this.lastTick = Date.now();
      return;
    }

    const now = Date.now();
    // Limite de delta time para evitar avanços drásticos após voltar de background
    const dt = Math.min(now - this.lastTick, 1000);
    this.lastTick = now;

    // Boost logic
    const btnBoost = document.getElementById('btnBoostAd');
    if (now < this.boostEndTime) {
      const remaining = Math.ceil((this.boostEndTime - now) / 1000);
      if (btnBoost) {
        btnBoost.textContent = `🔥 Boost Ativo! (${remaining}s)`;
        btnBoost.disabled = true;
      }
    } else {
      if (btnBoost && btnBoost.disabled) {
        btnBoost.innerHTML = `<span class="boost-icon">📺</span> Ativar Boost (2x) por 1min`;
        btnBoost.disabled = false;
        this.updateHUD(); // refresh income/min
      }
    }

    // Spawn new client into queue if interval elapsed
    if (now - this.lastClientTime >= this.computed.clientInterval) {
      this.lastClientTime = now;
      this.spawnClient();
    }

    // Assign queued clients to empty chairs
    this.assignClientsToChairs();

    // Progress clients in chairs
    this.progressChairs(dt);

    // Update HUD
    this.updateHUD();
  },

  spawnClient() {
    if (this.queue.length >= 6) return; // max queue
    const isVIP = Math.random() < this.computed.vipChance;
    const emojis = ['👨', '👩', '🧔', '👦', '👧', '🧓', '🧑'];
    const emoji = isVIP ? '🤴' : emojis[Math.floor(Math.random() * emojis.length)];
    this.queue.push({ id: this.clientIdCounter++, type: isVIP ? 'vip' : 'normal', emoji });
    this.renderQueue();
  },

  assignClientsToChairs() {
    if (this.queue.length === 0) return;
    for (let i = 0; i < this.computed.numChairs; i++) {
      const chair = this.chairs[i];
      if (!chair || chair.clientId !== null) continue;
      if (this.queue.length === 0) break;

      const client = this.queue.shift();
      const isAuto = i < this.computed.autoBarbers;
      chair.clientId = client.id;
      chair.clientType = client.type;
      chair.clientEmoji = client.emoji;
      chair.progress = 0;
      const cutMult = isAuto ? this.computed.autoSpeed : 1.0;
      chair.timeTotal = this.computed.cutTime * cutMult;
      chair.autoBarber = isAuto;
      chair.canManualClick = !isAuto;

      this.renderQueue();
      this.renderChairCard(i);
    }
  },

  progressChairs(dt) {
    for (let i = 0; i < this.chairs.length; i++) {
      const chair = this.chairs[i];
      if (!chair || chair.clientId === null) continue;
      if (!chair.autoBarber && chair.canManualClick) continue; // wait for click

      chair.progress += dt;
      const pct = Math.min(chair.progress / chair.timeTotal, 1);

      // Update progress bar
      const el = document.getElementById(`chair-${i}`);
      if (el) {
        const bar = el.querySelector('.progress-bar');
        if (bar) bar.style.width = (pct * 100) + '%';
        const timeEl = el.querySelector('.service-time');
        const remaining = Math.max(0, (chair.timeTotal - chair.progress) / 1000);
        if (timeEl) timeEl.textContent = remaining.toFixed(1) + 's restando';
      }

      if (pct >= 1) {
        this.finishClient(i);
      }
    }
  },

  finishClient(chairIdx) {
    const chair = this.chairs[chairIdx];
    const isVIP = chair.clientType === 'vip';
    let earned = this.computed.earningPerClient;
    if (isVIP) {
      earned *= 3;
      this.state._vipServed = (this.state._vipServed || 0) + 1;
      this.showToast(`👑 Cliente VIP: +$${this.formatMoney(earned)}!`, 'vip');
    }

    this.state.money += earned;
    this.state.totalEarned += earned;
    this.state.clientsServed++;
    audioManager.playCoin();

    // Reputation grows slowly
    if (this.state.clientsServed % 10 === 0) {
      this.state.reputation = Math.min(this.state.reputation + 0.5, 10);
    }

    // Show floating money particle
    const el = document.getElementById(`chair-${chairIdx}`);
    if (el) this.spawnMoneyParticle(el, `+$${this.formatMoney(earned)}`);

    // Animate money display
    const md = document.getElementById('moneyDisplay');
    if (md) { md.parentElement.classList.add('bump'); setTimeout(() => md.parentElement.classList.remove('bump'), 150); }

    // Reset chair
    chair.clientId = null;
    chair.clientType = null;
    chair.clientEmoji = null;
    chair.progress = 0;
    chair.timeTotal = 0;
    chair.autoBarber = false;
    chair.canManualClick = false;

    this.renderChairCard(chairIdx);
    this.updateUpgradeAffordability();
    this.checkAchievements();
    this.checkPrestige();
  },

  // ========================= MANUAL CLICK =========================
  manualClick(chairIdx) {
    const chair = this.chairs[chairIdx];
    if (!chair || chair.clientId === null) return;
    if (chair.autoBarber) return; // auto barbeiro gerencia isso

    audioManager.playSnip();
    // Boost progress significantly on click
    chair.progress += 800; // each click = 0.8s progress
    if (!chair.autoBarber) chair.autoBarber = false; // still manual

    const el = document.getElementById(`chair-${chairIdx}`);
    if (el) {
      // Scissors spin effect
      const sci = el.querySelector('.barber-character');
      if (sci) { sci.classList.add('scissors-spin'); setTimeout(() => sci.classList.remove('scissors-spin'), 400); }
    }

    const pct = Math.min(chair.progress / chair.timeTotal, 1);
    if (pct >= 1) {
      this.finishClient(chairIdx);
    } else {
      const bar = document.querySelector(`#chair-${chairIdx} .progress-bar`);
      if (bar) bar.style.width = (pct * 100) + '%';
    }
  },

  // ========================= UPGRADE BUY =========================
  buyUpgrade(id) {
    const def = UPGRADES.find(u => u.id === id);
    const upg = this.state.upgrades[id];
    if (!def || !upg) return;
    if (upg.level >= def.maxLevel) return;

    // Check prerequisite
    if (def.requires) {
      const reqLevel = this.state.upgrades[def.requires]?.level || 0;
      if (reqLevel < 1) {
        this.showToast(`⚠️ Requer: ${UPGRADES.find(u => u.id === def.requires)?.name}`, 'warning');
        return;
      }
    }

    const cost = this.getUpgradeCost(upg);
    if (this.state.money < cost) {
      this.showToast(`💸 Dinheiro insuficiente!`, 'warning');
      return;
    }

    this.state.money -= cost;
    upg.level++;
    audioManager.playBuy();

    this.recalcComputed();
    this.renderChairs();         // rebuild chairs if needed
    this.renderUpgrades();       // re-render upgrade cards
    this.updateHUD();

    // Animate the card
    const card = document.getElementById(`upgrade-${id}`);
    if (card) { card.classList.add('bought'); setTimeout(() => card.classList.remove('bought'), 400); }

    this.showToast(`✅ ${def.name} — Nível ${upg.level}!`);
    this.checkAchievements();

    const mult = document.getElementById('multiplierBadge');
    if (mult) mult.classList.add('num-pop', 'level-flash');
    setTimeout(() => mult?.classList.remove('num-pop', 'level-flash'), 400);
  },

  // ========================= RENDER =========================
  renderChairs() {
    const area = document.getElementById('chairsArea');
    if (!area) return;
    area.innerHTML = '';
    for (let i = 0; i < this.computed.numChairs; i++) {
      const div = document.createElement('div');
      div.id = `chair-${i}`;
      div.className = 'chair-card empty';
      div.innerHTML = this.buildChairHTML(i);
      area.appendChild(div);
    }
    // Attach click events
    for (let i = 0; i < this.computed.numChairs; i++) {
      const cz = document.querySelector(`#chair-${i} .click-zone`);
      if (cz) {
        const idx = i;
        cz.addEventListener('click', () => this.manualClick(idx));
      }
    }
  },

  buildChairHTML(i) {
    const chair = this.chairs[i];
    const hasClient = chair && chair.clientId !== null;
    const isVIP = hasClient && chair.clientType === 'vip';
    const autoBarberActive = hasClient && chair.autoBarber;
    const pct = hasClient ? Math.min(chair.progress / chair.timeTotal, 1) * 100 : 0;
    const remaining = hasClient ? Math.max(0, (chair.timeTotal - chair.progress) / 1000).toFixed(1) : '';
    const canClick = hasClient && !autoBarberActive;

    const barberEmojis = ['💇', '💈', '🧑‍🦲'];
    const barberEmoji = i < this.computed.autoBarbers ? '🤖' : barberEmojis[i % barberEmojis.length];

    return `
      <div class="chair-label">Cadeira ${i + 1}${i < this.computed.autoBarbers ? ' 🤖' : ''}</div>
      <div class="chair-scene">
        <div class="barber-character">${barberEmoji}</div>
        ${hasClient ? `
          <div class="client-character">${chair.clientEmoji || '👨'}</div>
          <div class="client-type-label ${isVIP ? 'vip' : 'normal'}">${isVIP ? '👑 VIP' : 'Normal'}</div>
        ` : `<div class="chair-emoji">💺</div>`}
      </div>
      ${hasClient ? `
        <div class="progress-wrap">
          <div class="progress-bar" style="width:${pct}%"></div>
        </div>
        <div class="service-time">${remaining}s restando</div>
        <div class="click-zone">
          ${autoBarberActive ? '⚙️ Automático' : '✂️ Clique pra cortar!'}
          ${(this.state.clientsServed === 0 && i === 0 && !autoBarberActive) ? '<div class="tutorial-pointer">👆 Clique aqui!</div>' : ''}
        </div>
      ` : `<div class="service-time">Aguardando cliente...</div>`}
    `;
  },

  renderChairCard(i) {
    const el = document.getElementById(`chair-${i}`);
    if (!el) return;
    const chair = this.chairs[i];
    const hasClient = chair && chair.clientId !== null;
    const isVIP = hasClient && chair.clientType === 'vip';
    const autoBarberActive = hasClient && chair.autoBarber;

    el.className = 'chair-card ' + (hasClient ? 'active' : 'empty') + (isVIP ? ' vip-client' : '') + ((!autoBarberActive && hasClient) ? ' can-click' : '');
    el.innerHTML = this.buildChairHTML(i);

    // Re-attach click
    const cz = el.querySelector('.click-zone');
    if (cz && !autoBarberActive) {
      cz.addEventListener('click', () => this.manualClick(i));
    }
  },

  renderQueue() {
    const area = document.getElementById('queueArea');
    const count = document.getElementById('queueCount');
    if (!area) return;

    count.textContent = this.queue.length + (this.queue.length === 1 ? ' cliente' : ' clientes');

    if (this.queue.length === 0) {
      area.innerHTML = '<span class="empty-queue">Nenhum cliente esperando...</span>';
      return;
    }
    area.innerHTML = this.queue.map(c => `
      <div class="queue-client ${c.type === 'vip' ? 'vip-queue' : ''}">
        <span class="q-emoji">${c.emoji}</span>
        <span class="q-label">${c.type === 'vip' ? 'VIP' : '#' + c.id}</span>
      </div>
    `).join('');
  },

  renderUpgrades() {
    const list = document.getElementById('upgradesList');
    if (!list) return;
    list.innerHTML = UPGRADES.map(def => {
      const upg = this.state.upgrades[def.id] || { level: 0 };
      const level = upg.level || 0;
      const maxed = level >= def.maxLevel;
      const cost = maxed ? 0 : this.getUpgradeCost(def.id);
      const affordable = !maxed && this.state.money >= cost;

      // Check prerequisite lock
      let locked = false;
      if (def.requires) {
        const reqLevel = this.state.upgrades[def.requires]?.level || 0;
        if (reqLevel < 1) locked = true;
      }

      let cardClass = 'upgrade-card';
      if (maxed) cardClass += ' maxed';
      else if (locked) cardClass += ' locked';
      else if (affordable) cardClass += ' affordable';

      let costLabel = '';
      if (maxed) costLabel = '<span class="upgrade-maxed-tag">✅ MÁXIMO</span>';
      else if (locked) costLabel = `<span class="upgrade-cost too-expensive">🔒 Bloqueado</span>`;
      else costLabel = `<span class="upgrade-cost ${affordable ? '' : 'too-expensive'}">$${this.formatMoney(cost)}</span>`;

      return `
        <div class="upgrade-card ${cardClass}" id="upgrade-${def.id}" ${!maxed && !locked ? `onclick="game.buyUpgrade('${def.id}')"` : ''}>
          <div class="upgrade-top">
            <div class="upgrade-icon">${def.icon}</div>
            <div class="upgrade-info">
              <div class="upgrade-name">${def.name}</div>
              <div class="upgrade-desc">${def.desc}</div>
            </div>
          </div>
          <div class="upgrade-bottom">
            ${costLabel}
            <span class="upgrade-level">Nível ${level}/${def.maxLevel}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  updateUpgradeAffordability() {
    for (const def of UPGRADES) {
      const card = document.getElementById(`upgrade-${def.id}`);
      if (!card) continue;
      const upg = this.state.upgrades[def.id] || { level: 0 };
      const level = upg.level || 0;
      const maxed = level >= def.maxLevel;
      if (maxed) continue;

      const cost = this.getUpgradeCost(def.id);
      const affordable = this.state.money >= cost;
      const costEl = card.querySelector('.upgrade-cost');
      if (costEl) {
        costEl.className = 'upgrade-cost' + (affordable ? '' : ' too-expensive');
      }

      const wasAffordable = card.classList.contains('affordable');
      if (affordable && !wasAffordable) {
        card.classList.add('affordable');
        this.showToast(`💡 Pode comprar: ${def.name}!`);
      } else if (!affordable && wasAffordable) {
        card.classList.remove('affordable');
      }
    }
  },

  renderAchievements() {
    const list = document.getElementById('achievementsList');
    if (!list) return;
    list.innerHTML = ACHIEVEMENTS.map(a => {
      const unlocked = this.state.achievements[a.id];
      return `
        <div class="achievement-badge ${unlocked ? 'unlocked' : 'locked'}" title="${a.desc}">
          ${a.icon} ${a.name}
        </div>
      `;
    }).join('');
  },

  checkAchievements() {
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (!this.state.achievements[a.id] && a.condition(this.state)) {
        this.state.achievements[a.id] = true;
        changed = true;
        this.showToast(`🏆 Conquista desbloqueada: ${a.icon} ${a.name}!`, 'gold');
      }
    }
    if (changed) this.renderAchievements();
  },

  checkPrestige() {
    for (let i = PRESTIGE_PHASES.length - 1; i >= 0; i--) {
      const phase = PRESTIGE_PHASES[i];
      if (this.state.totalEarned >= phase.threshold) {
        const badge = document.getElementById('prestigeBadge');
        if (badge && badge.textContent !== phase.name) {
          badge.textContent = phase.name;
          if (i > 0) {
            document.getElementById('prestigeText').textContent =
              `Parabéns! Sua barbearia evoluiu para "${phase.name}"! Continue crescendo!`;
            document.getElementById('prestigePopup').classList.remove('hidden');
          }
        }
        break;
      }
    }
  },

  updateHUD() {
    const s = this.state;
    const md = document.getElementById('moneyDisplay');
    if (md) md.textContent = '$' + this.formatMoney(s.money);

    const te = document.getElementById('totalEarned');
    if (te) te.textContent = '$' + this.formatMoney(s.totalEarned);

    const cs = document.getElementById('clientsServed');
    if (cs) cs.textContent = s.clientsServed;

    const ipm = document.getElementById('incomePerMin');
    if (ipm) ipm.textContent = '$' + this.formatMoney(this.getIncomePerMinute());

    const rep = document.getElementById('reputation');
    if (rep) rep.textContent = s.reputation.toFixed(1) + '⭐';

    const mb = document.getElementById('multiplierBadge');
    if (mb) mb.textContent = 'x' + this.computed.earningMultiplier.toFixed(1);
  },

  // ========================= OFFLINE EARNINGS =========================
  checkOfflineEarnings() {
    const now = Date.now();
    const last = this.state.lastSaveTime || now;
    const elapsed = now - last; // ms

    // Only show if away for >30s AND has auto barbers
    if (elapsed < 30000 || this.computed.autoBarbers < 1) return;

    // Cap at 4 hours
    const capped = Math.min(elapsed, 4 * 60 * 60 * 1000);
    const perMs = this.computed.earningPerClient / (this.computed.cutTime * this.computed.autoSpeed);
    const earned = perMs * capped * this.computed.autoBarbers * 0.5;
    if (earned < 1) return;

    this._offlineEarned = earned;
    document.getElementById('offlineAmount').textContent = '+$' + this.formatMoney(earned);
    document.getElementById('offlinePopup').classList.remove('hidden');
  },

  collectOffline(double = false) {
    const amount = (this._offlineEarned || 0) * (double ? 2 : 1);
    this.state.money += amount;
    this.state.totalEarned += amount;
    document.getElementById('offlinePopup').classList.add('hidden');
    this.showToast(`💰 +$${this.formatMoney(amount)} coletados!`, 'green');
    this.updateHUD();
  },

  // ========================= PARTICLES =========================
  spawnMoneyParticle(relEl, text) {
    const container = document.getElementById('particles');
    if (!container) return;
    const rect = relEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const span = document.createElement('span');
    span.className = 'money-particle';
    span.textContent = text;
    span.style.left = (rect.left - containerRect.left + rect.width / 2 - 20) + 'px';
    span.style.top = (rect.top - containerRect.top) + 'px';
    container.appendChild(span);
    setTimeout(() => span.remove(), 1300);
  },

  // ========================= TOAST =========================
  showToast(msg, type = '') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3100);
  },

  // ========================= FORMAT MONEY =========================
  formatMoney(n) {
    n = Math.floor(n);
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  },

  // ========================= SKINS =========================
  renderSkins() {
    const grid = document.getElementById('skinsGrid');
    if (!grid) return;
    grid.innerHTML = SKINS.map(s => {
      const isOwned = this.state.ownedSkins[s.id];
      const isEquipped = this.state.currentSkin === s.id;
      let statusClass = isEquipped ? 'equipped' : (isOwned ? 'owned' : 'buy');
      let statusText = isEquipped ? '✅ Selecionado' : (isOwned ? 'Equipar' : `Acion. $${this.formatMoney(s.cost)}`);

      return `
        <div class="skin-card" onclick="${isOwned ? `game.equipSkin('${s.id}')` : `game.buySkin('${s.id}')`}">
          <div class="skin-icon">${s.icon}</div>
          <div class="skin-name">${s.name}</div>
          <div class="skin-status ${statusClass}">${statusText}</div>
        </div>
      `;
    }).join('');
  },

  buySkin(id) {
    const s = SKINS.find(x => x.id === id);
    if (!s || this.state.ownedSkins[id]) return;
    if (this.state.money < s.cost) {
      this.showToast('Dinheiro insuficiente para comprar esse visual!', 'warning');
      return;
    }
    this.state.money -= s.cost;
    this.state.ownedSkins[id] = true;
    audioManager.playBuy();
    this.equipSkin(id);
    this.renderSkins();
    this.updateHUD();
    this.showToast(`Novo visual desbloqueado: ${s.name} 🎉`, 'gold');
  },

  equipSkin(id, isInit = false) {
    if (!this.state.ownedSkins[id]) return;
    this.state.currentSkin = id;
    
    // Remove old skin classes
    document.body.className = '';
    if (id !== 'default') {
      document.body.classList.add(`skin-${id}`);
    }
    if (!isInit) {
      this.renderSkins();
      this.showToast(`Visual equipado: ${SKINS.find(x=>x.id===id).name}`, 'green');
    }
  },

  // ========================= AD BOOST =========================
  startAdBoost() {
    pokiSDK.rewardedBreak().then((success) => {
      if (success) {
        this.boostEndTime = Date.now() + 60000; // 1 minuto
        audioManager.playBuy();
        this.showToast('🔥 Boost 2x ativado por 1 minuto!', 'vip');
        this.updateHUD();
      }
    });
  },

  // ========================= EVENTS =========================
  bindEvents() {
    document.getElementById('offlineCollect')?.addEventListener('click', () => this.collectOffline(false));
    document.getElementById('offlineDouble')?.addEventListener('click', () => {
      pokiSDK.rewardedBreak().then(success => {
        if (success) {
          audioManager.playCoin();
          this.collectOffline(true);
        }
      });
    });
    document.getElementById('prestigeOk')?.addEventListener('click', () => {
      document.getElementById('prestigePopup').classList.add('hidden');
    });

    // New Buttons
    document.getElementById('btnSkins')?.addEventListener('click', () => {
      document.getElementById('skinsModal').classList.remove('hidden');
    });
    document.getElementById('closeSkins')?.addEventListener('click', () => {
      document.getElementById('skinsModal').classList.add('hidden');
    });

    const btnSound = document.getElementById('btnSound');
    btnSound?.addEventListener('click', () => {
      const muted = audioManager.toggleMute();
      btnSound.textContent = muted ? '🔇' : '🔊';
      btnSound.classList.toggle('muted', muted);
    });

    document.getElementById('btnBoostAd')?.addEventListener('click', () => this.startAdBoost());

    // Save on page hide
    window.addEventListener('visibilitychange', () => {
      if (document.hidden) this.saveState();
    });
    window.addEventListener('beforeunload', () => this.saveState());
  },

  bindNavTabs() {
    const tabs = document.querySelectorAll('.nav-btn');
    const scene = document.querySelector('.barber-scene');
    const panel = document.querySelector('.upgrades-panel');

    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;

        if (tab === 'game') {
          scene?.classList.remove('hide-mobile');
          panel?.classList.remove('show-mobile');
        } else if (tab === 'upgrades') {
          scene?.classList.add('hide-mobile');
          panel?.classList.add('show-mobile');
        } else if (tab === 'stats') {
          scene?.classList.remove('hide-mobile');
          panel?.classList.remove('show-mobile');
          this.showToast(`📊 Atendidos: ${this.state.clientsServed} | Total: $${this.formatMoney(this.state.totalEarned)}`);
        }
      });
    });
  },
};

// ========================= START =========================
window.addEventListener('DOMContentLoaded', () => game.init());
