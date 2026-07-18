const UPGRADES = [
  { id: 'finger', icon: '👆', type: 'click', power: 1, costBase: 10, costMult: 1.14 },
  { id: 'glove', icon: '🧤', type: 'click', power: 3, costBase: 50, costMult: 1.16 },
  { id: 'brain', icon: '🧠', type: 'click', power: 8, costBase: 250, costMult: 1.18 },
  { id: 'golden', icon: '✋', type: 'click', power: 25, costBase: 2500, costMult: 1.2 },
  { id: 'legend', icon: '💎', type: 'click', power: 100, costBase: 50000, costMult: 1.22 },
  { id: 'bot', icon: '🤖', type: 'auto', power: 2, costBase: 30, costMult: 1.15 },
  { id: 'factory', icon: '🏭', type: 'auto', power: 12, costBase: 300, costMult: 1.17 },
  { id: 'temple', icon: '🏛️', type: 'auto', power: 55, costBase: 5000, costMult: 1.19 },
  { id: 'satellite', icon: '🛰️', type: 'auto', power: 250, costBase: 75000, costMult: 1.21 },
  { id: 'galaxy', icon: '🌌', type: 'auto', power: 1200, costBase: 2000000, costMult: 1.23 },
  { id: 'mult', icon: '✨', type: 'mult', power: 1.5, costBase: 1000, costMult: 2.2, maxLevel: 15 },
  { id: 'omega', icon: 'Ω', type: 'mult', power: 2, costBase: 100000, costMult: 3, maxLevel: 8 },
];

const SUPER_AUTO_POWER = 250;
const IAP = [
  { id: 'coins_pack', icon: '💰', type: 'coins', amount: 50000 },
  { id: 'coins_mega', icon: '💎', type: 'coins', amount: 1000000 },
  { id: 'permanent_x2', icon: '⚡', type: 'mult2' },
  { id: 'super_auto', icon: '🚀', type: 'auto' },
  { id: 'no_ads', icon: '🚫', type: 'noads' },
];

const PROGRESS_GOAL = 10000000;
const PRESTIGE_MIN_SCORE = 1000000;

const ACHIEVEMENTS = [
  { id: 'first', icon: '🎯', check: (s) => s.totalClicks >= 1 },
  { id: '100', icon: '💯', check: (s) => s.totalClicks >= 100 },
  { id: '1k', icon: '⭐', check: (s) => s.score >= 1000 },
  { id: '67k', icon: '🔥', check: (s) => s.score >= 67000 },
  { id: '1m', icon: '👑', check: (s) => s.score >= 1000000 },
  { id: '10m', icon: '🏛️', check: (s) => s.score >= 10000000 },
  { id: 'max', icon: '🏆', check: (s) => UPGRADES.every((u) => (s.levels[u.id] || 0) >= 30) },
  { id: 'prestige', icon: '🔄', check: (s) => s.prestigeCount >= 1 },
];

const Game = (() => {
  const state = {
    score: 0,
    totalClicks: 0,
    levels: {},
    unlockedAch: {},
    soundOn: true,
    nickname: '',
    permanentX2: false,
    superAuto: false,
    noAds: false,
    prestigeCount: 0,
    prestigeBonus: 0,
    lastSave: 0,
  };

  let clickPower = 1;
  let autoPerSec = 0;
  let multiplier = 1;
  let boostUntil = 0;
  let lastTick = performance.now();
  let saveDebounce = null;

  const $ = (id) => document.getElementById(id);

  function spendableScore() {
    return Math.floor(state.score);
  }

  function formatNum(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
    if (n >= 1000) return Math.floor(n).toLocaleString(currentLang === 'ru' ? 'ru-RU' : 'en-US');
    return Math.floor(n).toString();
  }

  function getUpgradeCost(up, level) {
    return Math.floor(up.costBase * Math.pow(up.costMult, level));
  }

  function recalcStats() {
    clickPower = 1;
    autoPerSec = 0;
    multiplier = 1;

    UPGRADES.forEach((up) => {
      const lv = state.levels[up.id] || 0;
      if (!lv) return;
      if (up.type === 'click') clickPower += up.power * lv;
      if (up.type === 'auto') autoPerSec += up.power * lv;
      if (up.type === 'mult') multiplier *= Math.pow(up.power, lv);
    });

    if (state.superAuto) autoPerSec += SUPER_AUTO_POWER;
    if (state.prestigeBonus > 0) {
      clickPower += state.prestigeBonus;
      autoPerSec += state.prestigeBonus * 2;
    }
  }

  function premiumMult() {
    return state.permanentX2 ? 2 : 1;
  }

  function getClickGain() {
    let gain = clickPower * multiplier * premiumMult();
    if (Date.now() < boostUntil) gain *= 2;
    return Math.max(1, Math.floor(gain));
  }

  function getAutoGain() {
    let gain = autoPerSec * multiplier * premiumMult();
    if (Date.now() < boostUntil) gain *= 2;
    return gain;
  }

  function getProgressPercent() {
    const pct = (state.score / PROGRESS_GOAL) * 100;
    return Math.min(100, Math.max(0, pct));
  }

  function playClickSound() {
    if (!state.soundOn) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 440 + Math.random() * 120;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch (_) { /* no audio */ }
  }

  function spawnFloat(x, y, text) {
    const container = $('float-container');
    const el = document.createElement('span');
    el.className = 'float-text';
    el.textContent = '+' + text;
    const rect = container.getBoundingClientRect();
    el.style.left = (x - rect.left) + 'px';
    el.style.top = (y - rect.top) + 'px';
    container.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  function doClick(ev) {
    if (SdkBridge.isPaused()) return;

    const gain = getClickGain();
    state.score += gain;
    state.totalClicks += 1;

    const btn = $('btn-click');
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 100);

    if (ev) {
      const x = ev.clientX ?? ev.touches?.[0]?.clientX ?? 0;
      const y = ev.clientY ?? ev.touches?.[0]?.clientY ?? 0;
      spawnFloat(x, y, formatNum(gain));
    }

    playClickSound();
    checkAchievements();
    updateUI();
    scheduleSave();
  }

  function flash(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function buyUpgrade(id, el) {
    const up = UPGRADES.find((u) => u.id === id);
    if (!up) return;

    const lv = state.levels[id] || 0;
    if (up.maxLevel && lv >= up.maxLevel) {
      flash(el, 'shake');
      return;
    }

    const cost = getUpgradeCost(up, lv);
    if (spendableScore() < cost) {
      flash(el, 'shake');
      const status = $('save-status');
      if (status) {
        status.textContent = t('notEnough');
        status.className = 'save-status';
        setTimeout(() => { status.textContent = ''; }, 1500);
      }
      return;
    }

    state.score -= cost;
    state.levels[id] = lv + 1;
    flash(el, 'bought');
    recalcStats();
    checkAchievements();
    updateUI();
    scheduleSave();
  }

  function canPrestige() {
    return spendableScore() >= PRESTIGE_MIN_SCORE;
  }

  function doPrestige() {
    if (!canPrestige()) return;
    state.prestigeCount += 1;
    state.prestigeBonus += 5 + state.prestigeCount * 2;
    state.score = 0;
    state.levels = {};
    recalcStats();
    checkAchievements();
    updateUI();
    scheduleSave();
    buildUpgrades();
  }

  function checkAchievements() {
    let changed = false;
    ACHIEVEMENTS.forEach((ach) => {
      if (state.unlockedAch[ach.id]) return;
      if (ach.check(state)) {
        state.unlockedAch[ach.id] = true;
        changed = true;
      }
    });
    if (changed) renderAchievements();
  }

  function scheduleSave() {
    clearTimeout(saveDebounce);
    saveDebounce = setTimeout(() => saveGame(false), 3000);
  }

  async function saveGame(manual) {
    const ok = await SdkBridge.saveProgress({
      score: state.score,
      totalClicks: state.totalClicks,
      levels: state.levels,
      unlockedAch: state.unlockedAch,
      soundOn: state.soundOn,
      nickname: state.nickname,
      permanentX2: state.permanentX2,
      superAuto: state.superAuto,
      noAds: state.noAds,
      prestigeCount: state.prestigeCount,
      prestigeBonus: state.prestigeBonus,
    });

    SdkBridge.submitScore(state.score);

    const status = $('save-status');
    if (manual) {
      status.textContent = ok ? t('saved') : t('saveError');
      status.className = 'save-status' + (ok ? ' saved' : '');
      setTimeout(() => { status.textContent = ''; }, 2000);
    }
  }

  const upgradeNodes = {};

  function buildUpgrades() {
    const list = $('upgrades-list');
    list.innerHTML = '';

    UPGRADES.forEach((up) => {
      const li = document.createElement('li');
      li.className = 'upgrade-item';
      li.dataset.id = up.id;
      li.innerHTML = `
        <div class="upgrade-icon">${up.icon}</div>
        <div class="upgrade-info">
          <div class="upgrade-name">${t('upgrade_' + up.id)}</div>
          <div class="upgrade-desc">${t('upgrade_' + up.id + '_desc')}</div>
        </div>
        <div class="upgrade-meta">
          <div class="upgrade-cost"></div>
          <div class="upgrade-level"></div>
        </div>
      `;
      li.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        buyUpgrade(up.id, li);
      });
      li.addEventListener('animationend', () => {
        li.classList.remove('shake', 'bought');
      });
      list.appendChild(li);
      upgradeNodes[up.id] = {
        li,
        cost: li.querySelector('.upgrade-cost'),
        level: li.querySelector('.upgrade-level'),
      };
    });

    refreshUpgrades();
  }

  function refreshPrestigeItem() {
    const list = $('upgrades-list');
    const existing = list.querySelector('.prestige-item');

    if (!canPrestige()) {
      if (existing) existing.remove();
      return;
    }

    if (existing) {
      existing.querySelector('.upgrade-desc').textContent =
        `+${5 + (state.prestigeCount + 1) * 2} к клику, сброс улучшений`;
      existing.querySelector('.upgrade-level').textContent = String(state.prestigeCount);
      return;
    }

    const li = document.createElement('li');
    li.className = 'upgrade-item prestige-item can-buy';
    li.innerHTML = `
      <div class="upgrade-icon">🔄</div>
      <div class="upgrade-info">
        <div class="upgrade-name">${t('ach_prestige')}</div>
        <div class="upgrade-desc">+${5 + (state.prestigeCount + 1) * 2} к клику, сброс улучшений</div>
      </div>
      <div class="upgrade-meta">
        <div class="upgrade-cost">1M+</div>
        <div class="upgrade-level">${state.prestigeCount}</div>
      </div>
    `;
    li.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      doPrestige();
    });
    list.appendChild(li);
  }

  function refreshUpgrades() {
    UPGRADES.forEach((up) => {
      const node = upgradeNodes[up.id];
      if (!node) return;
      const lv = state.levels[up.id] || 0;
      const maxed = !!(up.maxLevel && lv >= up.maxLevel);
      const cost = getUpgradeCost(up, lv);
      const canBuy = !maxed && spendableScore() >= cost;
      node.li.classList.toggle('can-buy', canBuy);
      node.li.classList.toggle('locked', !canBuy && !maxed);
      node.li.classList.toggle('maxed', maxed);
      node.cost.textContent = maxed ? 'MAX' : formatNum(cost);
      node.level.textContent = `${t('level')} ${lv}${up.maxLevel ? '/' + up.maxLevel : ''}`;
    });
  }

  function renderAchievements() {
    const list = $('achievements-list');
    list.innerHTML = '';

    ACHIEVEMENTS.forEach((ach) => {
      const unlocked = !!state.unlockedAch[ach.id];
      const li = document.createElement('li');
      li.className = 'achievement-item' + (unlocked ? ' unlocked' : '');
      li.innerHTML = `
        <span class="badge">${ach.icon}</span>
        <div class="upgrade-info">
          <div class="upgrade-name">${t('ach_' + ach.id)}</div>
          <div class="upgrade-desc">${t('ach_' + ach.id + '_desc')}</div>
        </div>
      `;
      list.appendChild(li);
    });
  }

  const BAD_ROOTS_RU = [
    'хуй', 'хуи', 'хуё', 'хуе', 'хую', 'хуя', 'хуйн', 'хуев', 'хуёв', 'хуес', 'хуёс',
    'наху', 'нахуй', 'похуй', 'похую', 'охуе', 'охуи', 'охуя', 'охуэ', 'дохуя', 'нихуя',
    'пизд', 'пезд', 'пизж', 'спизд', 'распизд', 'пиздец', 'пиздат', 'опизден',
    'еб', 'ёб', 'еба', 'ебё', 'ебе', 'ебу', 'ебл', 'ебан', 'ебат', 'ебуч', 'ебись',
    'бляд', 'блят', 'муд', 'мудак', 'гандон', 'гондон', 'пидор', 'пидар', 'сука', 'суки',
    'фак', 'нигер', 'негр',
  ];
  const BAD_ROOTS_EN = [
    'fuck', 'fuk', 'fuc', 'fck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'asshole',
    'faggot', 'nigger', 'nigga', 'retard', 'rape', 'nazi',
  ];

  function normalizeName(name) {
    const lower = (name || '').toLowerCase();
    const toCyr = {
      a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о',
      p: 'р', t: 'т', u: 'у', x: 'х', y: 'у', i: 'и', n: 'н',
      '0': 'о', '3': 'е', '1': 'и', '4': 'ч', '6': 'б', '@': 'а',
    };
    const toLat = {
      '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
      '@': 'a', '$': 's',
    };

    let cyr = '';
    let lat = '';
    for (const ch of lower) {
      cyr += toCyr[ch] || ch;
      lat += toLat[ch] || ch;
    }

    const strip = (s) => s.replace(/[^a-zа-яё0-9]/g, '');
    const collapse = (s) => s.replace(/(.)\1{2,}/g, '$1$1');

    return {
      cyr: collapse(strip(cyr)),
      lat: collapse(strip(lat)),
    };
  }

  function isBadName(name) {
    const { cyr, lat } = normalizeName(name);
    for (const root of BAD_ROOTS_RU) {
      if (cyr.includes(root)) return true;
    }
    for (const root of BAD_ROOTS_EN) {
      if (lat.includes(root)) return true;
    }
    return false;
  }

  function ownDisplayName() {
    const n = (state.nickname || '').trim();
    return n || t('youLabel');
  }

  function showNameHint(key, ok) {
    const hint = $('name-hint');
    if (!hint) return;
    hint.textContent = t(key);
    hint.className = 'name-hint' + (ok ? ' ok' : ' err');
  }

  function saveNickname() {
    const input = $('nickname-input');
    if (!input) return;

    const raw = input.value.replace(/\s+/g, ' ').trim();

    if (raw.length < 2) {
      showNameHint('nameShort', false);
      return;
    }
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9 _-]+$/.test(raw)) {
      showNameHint('nameChars', false);
      return;
    }
    if (isBadName(raw)) {
      showNameHint('nameBad', false);
      return;
    }

    state.nickname = raw;
    input.value = raw;
    showNameHint('nameSaved', true);
    saveGame(false);
    renderLeaders();
  }

  let leadersBusy = false;

  function leaderRow(rank, name, score, isMe, avatar) {
    const li = document.createElement('li');
    li.className = 'leader-item' + (isMe ? ' me' : '');
    li.innerHTML = `
      <span class="leader-rank">${rank}</span>
      ${avatar
        ? `<img class="leader-avatar" src="${avatar}" alt="" loading="lazy" draggable="false">`
        : '<span class="leader-avatar empty"></span>'}
      <span class="leader-name">${name}</span>
      <span class="leader-score">${formatNum(score)}</span>
    `;
    return li;
  }

  async function renderLeaders() {
    if (leadersBusy) return;
    leadersBusy = true;

    const list = $('leaders-list');
    const status = $('leaders-status');
    const authBtn = $('btn-auth');

    list.innerHTML = '';
    status.classList.remove('hidden');
    status.textContent = t('leadersLoading');
    authBtn.classList.add('hidden');

    try {
      await SdkBridge.submitScore(state.score);
      const data = await SdkBridge.getLeaderboard(10);
      const entries = (data && data.entries) || [];
      const myRank = (data && data.userRank) || 0;
      const myScore = spendableScore();
      let meRendered = false;

      if (entries.length) {
        status.classList.add('hidden');
        entries.forEach((entry) => {
          const isMe = myRank > 0 && entry.rank === myRank;
          if (isMe) meRendered = true;
          const player = entry.player || {};
          const name = isMe
            ? ownDisplayName()
            : (player.publicName || t('youLabel'));
          let avatar = '';
          try {
            if (typeof player.getAvatarSrc === 'function') avatar = player.getAvatarSrc('small');
          } catch (_) { /* no avatar */ }
          list.appendChild(leaderRow(entry.rank, name, entry.score, isMe, avatar));
        });
      } else {
        const fallback = SdkBridge.getLocalLeaderboard(ownDisplayName(), myScore);
        fallback.forEach((row) => {
          list.appendChild(leaderRow(row.rank, row.name, row.score, row.isMe));
        });
        status.textContent = t('leadersOffline');
        status.classList.remove('hidden');
        meRendered = fallback.some((r) => r.isMe);
      }

      if (!meRendered) {
        const rank = myRank > 0 ? myRank : (entries.length ? entries.length + 1 : 1);
        list.appendChild(leaderRow(rank, ownDisplayName(), myScore, true));
      }

      if (!SdkBridge.isAuthorized()) {
        authBtn.classList.remove('hidden');
      }
    } catch (e) {
      console.warn('Leaders render:', e);
      const fallback = SdkBridge.getLocalLeaderboard(ownDisplayName(), spendableScore());
      fallback.forEach((row) => {
        list.appendChild(leaderRow(row.rank, row.name, row.score, row.isMe));
      });
      status.textContent = t('leadersOffline');
      status.classList.remove('hidden');
    } finally {
      leadersBusy = false;
    }
  }

  const shopNodes = {};
  let shopBuilt = false;

  function isOwned(id) {
    if (id === 'permanent_x2') return state.permanentX2;
    if (id === 'super_auto') return state.superAuto;
    if (id === 'no_ads') return state.noAds;
    return false;
  }

  function buildShop() {
    const list = $('shop-list');
    list.innerHTML = '';
    IAP.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'shop-item';
      li.innerHTML = `
        <div class="shop-icon">${p.icon}</div>
        <div class="upgrade-info">
          <div class="upgrade-name">${t('iap_' + p.id)}</div>
          <div class="upgrade-desc">${t('iap_' + p.id + '_desc')}</div>
        </div>
        <button type="button" class="shop-buy" data-id="${p.id}">${t('buy')}</button>
      `;
      const btn = li.querySelector('.shop-buy');
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        buyIap(p.id, btn);
      });
      list.appendChild(li);
      shopNodes[p.id] = { li, btn };
    });
    shopBuilt = true;
  }

  function priceHtmlFor(c) {
    let iconUrl = '';
    try {
      if (typeof c.getPriceCurrencyImage === 'function') {
        iconUrl = c.getPriceCurrencyImage('svg') || c.getPriceCurrencyImage('medium') || '';
      }
    } catch (_) { /* no icon */ }

    const val = (c.priceValue != null && c.priceValue !== '')
      ? String(c.priceValue)
      : '';

    if (val && iconUrl) {
      return `<span class="price-val">${val}</span><img class="yan-icon" src="${iconUrl}" alt="Яны" draggable="false">`;
    }
    if (val) {
      return `<span class="price-val">${val}</span> ${c.priceCurrencyCode || 'YAN'}`;
    }
    return c.price || t('buy');
  }

  function refreshShop() {
    IAP.forEach((p) => {
      const node = shopNodes[p.id];
      if (!node) return;
      if (isOwned(p.id)) {
        node.btn.textContent = t('owned');
        node.btn.disabled = true;
        node.li.classList.add('owned');
      } else {
        node.li.classList.remove('owned');
        node.btn.disabled = false;
        if (node.priceHtml) node.btn.innerHTML = node.priceHtml;
        else node.btn.textContent = t('buy');
      }
    });
  }

  async function renderShop() {
    if (!shopBuilt) buildShop();

    const catalog = await SdkBridge.getCatalog();
    catalog.forEach((c) => {
      const node = shopNodes[c.id];
      if (!node) return;
      node.priceHtml = priceHtmlFor(c);
    });

    refreshShop();
  }

  function showShopStatus(msg, ok) {
    const el = $('shop-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'shop-status' + (ok ? ' ok' : ' err');
    el.classList.remove('hidden');
    setTimeout(() => { el.classList.add('hidden'); }, 2500);
  }

  async function applyPurchase(id, token) {
    const product = IAP.find((x) => x.id === id);
    if (!product) return;

    if (product.type === 'coins') {
      state.score += product.amount;
      await SdkBridge.consume(token);
    } else if (product.type === 'mult2') {
      state.permanentX2 = true;
    } else if (product.type === 'auto') {
      state.superAuto = true;
    } else if (product.type === 'noads') {
      state.noAds = true;
    }

    recalcStats();
    saveGame(false);
    updateUI();
    refreshShop();
  }

  async function buyIap(id, btn) {
    if (!SdkBridge.paymentsAvailable()) {
      showShopStatus(t('purchaseOffline'), false);
      return;
    }
    if (btn) btn.disabled = true;

    const result = await SdkBridge.purchase(id);
    if (!result) {
      showShopStatus(t('purchaseFail'), false);
      if (btn && !isOwned(id)) btn.disabled = false;
      return;
    }

    await applyPurchase(id, result.purchaseToken);
    showShopStatus(t('purchaseOk'), true);
  }

  async function restorePurchases() {
    const purchases = await SdkBridge.getPurchases();
    for (const pur of purchases) {
      const id = pur.productID;
      const product = IAP.find((x) => x.id === id);
      if (!product) continue;

      if (product.type === 'coins') {
        state.score += product.amount;
        await SdkBridge.consume(pur.purchaseToken);
      } else if (product.type === 'mult2') {
        state.permanentX2 = true;
      } else if (product.type === 'auto') {
        state.superAuto = true;
      } else if (product.type === 'noads') {
        state.noAds = true;
      }
    }
    recalcStats();
  }

  function updateUI() {
    $('score').textContent = formatNum(state.score);
    $('per-sec').textContent = formatNum(getAutoGain());
    $('total-clicks').textContent = formatNum(state.totalClicks);

    const pct = getProgressPercent();
    $('progress-text').textContent = pct.toFixed(1) + '%';
    $('progress-bar').style.width = pct + '%';

    const boostEl = $('boost-indicator');
    if (Date.now() < boostUntil) {
      boostEl.classList.remove('hidden');
    } else {
      boostEl.classList.add('hidden');
    }

    refreshUpgrades();
    refreshPrestigeItem();
  }

  function gameLoop(now) {
    if (!SdkBridge.isPaused()) {
      const dt = Math.min((now - lastTick) / 1000, 0.5);
      lastTick = now;

      const auto = getAutoGain();
      if (auto > 0 && dt > 0) {
        state.score += auto * dt;
        checkAchievements();
      }
    } else {
      lastTick = now;
    }

    updateUI();
    requestAnimationFrame(gameLoop);
  }

  const BOOST_DURATION = 20000;

  function activateBoost() {
    SdkBridge.showRewarded(() => {
      boostUntil = Date.now() + BOOST_DURATION;
      $('btn-reward').disabled = true;
      setTimeout(() => {
        $('btn-reward').disabled = false;
      }, BOOST_DURATION);
    });
  }

  let lastAdTime = 0;
  const AD_COOLDOWN = 90000;

  function maybeShowInterstitial() {
    if (state.noAds) return;
    const now = Date.now();
    if (now - lastAdTime < AD_COOLDOWN) return;
    if (state.totalClicks < 30) return;
    lastAdTime = now;
    SdkBridge.showFullscreen(() => {});
  }

  function setupTabs() {
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const id = tab.dataset.tab;
        const wasActive = tab.classList.contains('active');

        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        $('panel-' + id).classList.add('active');

        if (id === 'leaders') renderLeaders();
        if (id === 'shop') renderShop();

        if (!wasActive && id !== 'upgrades') maybeShowInterstitial();
      });
    });
  }

  function applySave(data) {
    if (!data) return;
    state.score = data.score || 0;
    state.totalClicks = data.totalClicks || 0;
    state.levels = data.levels || {};
    state.unlockedAch = data.unlockedAch || {};
    state.soundOn = data.soundOn !== false;
    state.nickname = typeof data.nickname === 'string' ? data.nickname : '';
    state.permanentX2 = !!data.permanentX2;
    state.superAuto = !!data.superAuto;
    state.noAds = !!data.noAds;
    state.prestigeCount = data.prestigeCount || 0;
    state.prestigeBonus = data.prestigeBonus || 0;
    recalcStats();
  }

  function onPause() {
    saveGame(false);
  }

  function onResume() {
    lastTick = performance.now();
  }

  async function start() {
    $('loader-text').textContent = t('loading');

    const saved = await SdkBridge.init();
    applySave(saved);
    await restorePurchases();

    $('loader').classList.add('hidden');
    $('app').classList.remove('hidden');
    SdkBridge.signalReady();
    SdkBridge.gameplayStart();

    applyI18n();
    buildUpgrades();
    renderAchievements();
    updateUI();
    setupTabs();

    $('btn-auth').addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      const ok = await SdkBridge.authorize();
      if (ok) renderLeaders();
    });

    const nameInput = $('nickname-input');
    if (nameInput) {
      nameInput.value = state.nickname || '';
      $('btn-name-save').addEventListener('pointerdown', (e) => {
        e.preventDefault();
        saveNickname();
      });
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveNickname();
        }
      });
    }

    let lastPointer = 0;
    $('btn-click').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastPointer < 80) return;
      lastPointer = now;
      doClick(e);
    });

    $('btn-reward').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      activateBoost();
    });
    $('btn-save').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      saveGame(true);
    });

    $('btn-sound').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      state.soundOn = !state.soundOn;
      $('btn-sound').textContent = state.soundOn ? '🔊' : '🔇';
      scheduleSave();
    });
    $('btn-sound').textContent = state.soundOn ? '🔊' : '🔇';

    lastTick = performance.now();
    lastAdTime = Date.now();
    requestAnimationFrame(gameLoop);

    setInterval(() => saveGame(false), 60000);
  }

  return { start, onPause, onResume };
})();

function isEditable(el) {
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

['contextmenu', 'selectstart', 'dragstart'].forEach((evt) => {
  document.addEventListener(evt, (e) => {
    if (isEditable(e.target)) return;
    e.preventDefault();
  }, { capture: true });
});

document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

document.addEventListener('touchmove', (e) => {
  const scrollable = e.target.closest && e.target.closest('.panel.active');
  if (!scrollable) {
    e.preventDefault();
    return;
  }
  if (scrollable.scrollHeight <= scrollable.clientHeight) {
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener('pointerdown', (e) => {
  if (isEditable(e.target)) return;
  if (e.pointerType === 'mouse' && e.button !== 0) {
    e.preventDefault();
  }
}, { capture: true });

document.addEventListener('dblclick', (e) => {
  if (isEditable(e.target)) return;
  e.preventDefault();
});

document.addEventListener('DOMContentLoaded', () => Game.start());
