const SdkBridge = (() => {
  let ysdk = null;
  let player = null;
  let leaderboards = null;
  let payments = null;
  let paused = false;

  const STORAGE_KEY = 'clicker67_save';
  const LOCAL_LEADERS_KEY = 'clicker67_local_leaders';
  const LEADERBOARD_NAME = 'score';

  const DEMO_LEADERS = [
    { name: 'Алекс', score: 2450000 },
    { name: 'Мария', score: 1870000 },
    { name: 'Игорь', score: 920000 },
    { name: 'Нина', score: 540000 },
    { name: 'Денис', score: 310000 },
    { name: 'Катя', score: 175000 },
    { name: 'Олег', score: 98000 },
    { name: 'Юля', score: 67000 },
    { name: 'Виктор', score: 42000 },
  ];

  async function init() {
    try {
      if (typeof YaGames !== 'undefined') {
        ysdk = await YaGames.init();
        const lang = ysdk.environment?.i18n?.lang;
        if (lang) setLanguage(lang);

        try {
          player = await ysdk.getPlayer({ scopes: false });
        } catch (e) {
          console.warn('Player init:', e);
        }

        try {
          leaderboards = await ysdk.getLeaderboards();
        } catch (e) {
          console.warn('Leaderboards init:', e);
        }

        try {
          payments = await ysdk.getPayments({ signed: false });
        } catch (e) {
          console.warn('Payments init:', e);
        }

      } else {
        console.info('SDK not found — local mode');
        setLanguage(navigator.language);
      }
    } catch (e) {
      console.warn('SDK init failed:', e);
      setLanguage(navigator.language);
    }

    document.addEventListener('visibilitychange', () => {
      paused = document.hidden;
      if (paused) {
        gameplayStop();
        if (typeof Game !== 'undefined') Game.onPause();
      } else {
        gameplayStart();
        if (typeof Game !== 'undefined') Game.onResume();
      }
    });

    return loadProgress();
  }

  function isPaused() {
    return paused;
  }

  async function loadProgress() {
    let data = null;

    if (player) {
      try {
        data = await player.getData();
        if (data && Object.keys(data).length) return data;
      } catch (e) {
        console.warn('Cloud load:', e);
      }
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Local load:', e);
    }

    return null;
  }

  async function saveProgress(state) {
    const payload = { ...state, savedAt: Date.now() };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Local save:', e);
    }

    if (player) {
      try {
        await player.setData(payload, true);
        return true;
      } catch (e) {
        console.warn('Cloud save:', e);
        return false;
      }
    }

    return true;
  }

  function signalReady() {
    ysdk?.features?.LoadingAPI?.ready?.();
  }

  function gameplayStart() {
    ysdk?.features?.GameplayAPI?.start?.();
  }

  function gameplayStop() {
    ysdk?.features?.GameplayAPI?.stop?.();
  }

  function showRewarded(onReward) {
    if (!ysdk?.adv?.showRewardedVideo) {
      if (onReward) onReward();
      return;
    }

    if (!onReward) return;

    let rewarded = false;
    gameplayStop();
    ysdk.adv.showRewardedVideo({
      callbacks: {
        onOpen: () => gameplayStop(),
        onRewarded: () => {
          rewarded = true;
          if (onReward) onReward();
        },
        onClose: () => {
          gameplayStart();
        },
        onError: () => {
          gameplayStart();
        },
      },
    });
  }

  async function submitScore(score) {
    if (!leaderboards) return false;
    const value = Math.max(0, Math.floor(score));
    try {
      await leaderboards.setLeaderboardScore(LEADERBOARD_NAME, value);
      return true;
    } catch (e) {
      console.warn('Leaderboard submit:', e);
      return false;
    }
  }

  async function getLeaderboard(limit = 10) {
    if (!leaderboards) return null;

    const authorized = isAuthorized();
    try {
      return await leaderboards.getLeaderboardEntries(LEADERBOARD_NAME, {
        quantityTop: limit,
        includeUser: authorized,
        quantityAround: authorized ? 3 : 0,
      });
    } catch (e) {
      console.warn('Leaderboard fetch:', e);
      // Повтор без includeUser — часто падает для неавторизованных игроков.
      try {
        return await leaderboards.getLeaderboardEntries(LEADERBOARD_NAME, {
          quantityTop: limit,
        });
      } catch (e2) {
        console.warn('Leaderboard fetch retry:', e2);
        return null;
      }
    }
  }

  function isAuthorized() {
    return !!(player && player.getMode && player.getMode() !== 'lite');
  }

  async function authorize() {
    if (!ysdk) return false;
    try {
      await ysdk.auth.openAuthDialog();
      player = await ysdk.getPlayer();
      return true;
    } catch (e) {
      console.warn('Auth:', e);
      return false;
    }
  }

  // ===== Внутриигровые покупки (Payments API) =====
  function paymentsAvailable() {
    return !!payments;
  }

  async function getCatalog() {
    if (!payments) return [];
    try {
      return await payments.getCatalog();
    } catch (e) {
      console.warn('Catalog:', e);
      return [];
    }
  }

  async function purchase(id) {
    if (!payments) return null;
    try {
      return await payments.purchase({ id });
    } catch (e) {
      console.warn('Purchase:', e);
      return null;
    }
  }

  async function getPurchases() {
    if (!payments) return [];
    try {
      const res = await payments.getPurchases();
      return Array.from(res || []);
    } catch (e) {
      console.warn('Purchases:', e);
      return [];
    }
  }

  async function consume(token) {
    if (!payments || !token) return false;
    try {
      await payments.consumePurchase(token);
      return true;
    } catch (e) {
      console.warn('Consume:', e);
      return false;
    }
  }

  function showFullscreen(onClose) {
    if (!ysdk?.adv?.showFullscreenAdv) {
      if (onClose) onClose(false);
      return;
    }

    gameplayStop();
    ysdk.adv.showFullscreenAdv({
      callbacks: {
        onOpen: () => gameplayStop(),
        onClose: (wasShown) => {
          gameplayStart();
          if (onClose) onClose(wasShown);
        },
        onError: () => {
          gameplayStart();
          if (onClose) onClose(false);
        },
      },
    });
  }

  function getLocalLeaderboard(playerName, playerScore) {
    let stored = [];
    try {
      const raw = localStorage.getItem(LOCAL_LEADERS_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (_) { /* ignore */ }

    const rows = DEMO_LEADERS.map((d) => ({ name: d.name, score: d.score }));
    const mine = { name: playerName, score: Math.max(0, Math.floor(playerScore)), isMe: true };
    rows.push(mine);

    stored.forEach((s) => {
      if (s && s.name && s.score > 0) rows.push({ name: s.name, score: s.score });
    });

    rows.sort((a, b) => b.score - a.score);

    const seen = new Set();
    const unique = [];
    for (const row of rows) {
      const key = row.name + ':' + row.score;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(row);
    }

    const top = unique.slice(0, 10).map((row, i) => ({
      rank: i + 1,
      name: row.name,
      score: row.score,
      isMe: !!row.isMe,
    }));

    try {
      localStorage.setItem(LOCAL_LEADERS_KEY, JSON.stringify(
        top.filter((r) => !r.isMe).map((r) => ({ name: r.name, score: r.score }))
      ));
    } catch (_) { /* ignore */ }

    return top;
  }

  return {
    init,
    signalReady,
    gameplayStart,
    isPaused,
    saveProgress,
    showRewarded,
    showFullscreen,
    submitScore,
    getLeaderboard,
    getLocalLeaderboard,
    isAuthorized,
    authorize,
    paymentsAvailable,
    getCatalog,
    purchase,
    getPurchases,
    consume,
  };
})();
