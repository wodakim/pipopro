(() => {
  const SAVE_KEY = 'pipopipette_save_v1';
  const TIMER_PRESETS = { BLITZ: 10, CLASSIC: 30, STRATEGIC: 60, FREE: null };

  const GameState = {
    phase: 'home',
    gridSize: 5,
    quality: 'MEDIUM',
    theme: 'NOTEBOOK',
    timerMode: 'CLASSIC',
    vibration: true,
    pseudo: 'Joueur',
    economy: { gems: 120, streak: 0, lastDailyClaim: 0 },
    audio: { music: 50, sfx: 60 },
    stats: { matches: 0, p1Wins: 0, p2Wins: 0, draws: 0 },
    missions: { linesDrawn: 0, boxesClosed: 0, winsToday: 0 },
    online: {
      region: 'EUW', mode: 'RANKED', state: 'idle', roomCode: '', latencyMs: 80, packetLoss: 0,
      queueHandle: null, netLog: [], party: ['Vous'],
    },
    currentPlayer: 1,
    scores: { 1: 0, 2: 0 },
    linesH: new Set(),
    linesV: new Set(),
    boxes: new Map(),
    turnHistory: [],
    inputLocked: false,
    timeLeft: 30,
    timerHandle: null,
    paused: false,
    debug: { enabled: false, lastTs: 0, fps: 0 },
    canvas: { size: 720, pad: 28, step: 100 },
    hoverSegment: null,
    newsIndex: 0,
  };

  const UI = {
    home: document.getElementById('homeScreen'),
    online: document.getElementById('onlineScreen'),
    game: document.getElementById('gameScreen'),
    settings: document.getElementById('settingsScreen'),
    canvas: document.getElementById('boardCanvas'),
    timer: document.getElementById('timerBox'),
    timerFill: document.getElementById('timerFill'),
    turn: document.getElementById('turnLabel'),
    linesCount: document.getElementById('linesCount'),
    friendlyTag: document.getElementById('friendlyTag'),
    p1Score: document.getElementById('p1Score'),
    p2Score: document.getElementById('p2Score'),
    p1Box: document.getElementById('p1Box'),
    p2Box: document.getElementById('p2Box'),
    turnHistory: document.getElementById('turnHistory'),
    netLog: document.getElementById('netLog'),
    partyList: document.getElementById('partyList'),
    missionList: document.getElementById('missionList'),
    pseudoLabel: document.getElementById('pseudoLabel'),
    gemLabel: document.getElementById('gemLabel'),
    streakLabel: document.getElementById('streakLabel'),
    gridSizeLabel: document.getElementById('gridSizeLabel'),
    gridSizeInput: document.getElementById('gridSizeInput'),
    timerModeInput: document.getElementById('timerModeInput'),
    themeInput: document.getElementById('themeInput'),
    qualityInput: document.getElementById('qualityInput'),
    vibrationInput: document.getElementById('vibrationInput'),
    pseudoInput: document.getElementById('pseudoInput'),
    musicVolume: document.getElementById('musicVolume'),
    sfxVolume: document.getElementById('sfxVolume'),
    regionInput: document.getElementById('regionInput'),
    onlineModeInput: document.getElementById('onlineModeInput'),
    latencyInput: document.getElementById('latencyInput'),
    packetLossInput: document.getElementById('packetLossInput'),
    latencyLabel: document.getElementById('latencyLabel'),
    packetLossLabel: document.getElementById('packetLossLabel'),
    matchStatus: document.getElementById('matchStatus'),
    roomCodeLabel: document.getElementById('roomCodeLabel'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    newsTicker: document.getElementById('newsTicker'),
    debugPanel: document.getElementById('debugPanel'),
    debugStats: document.getElementById('debugStats'),
    fxLayer: document.getElementById('fxLayer'),
    srAnnouncer: document.getElementById('srAnnouncer'),
    statMatches: document.getElementById('statMatches'),
    statP1Wins: document.getElementById('statP1Wins'),
    statP2Wins: document.getElementById('statP2Wins'),
  };

  const ctx = UI.canvas.getContext('2d');
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function applyBodyClasses() {
    document.body.classList.remove('quality-low', 'quality-medium', 'quality-ultra', 'theme-night', 'theme-retro');
    document.body.classList.add(`quality-${GameState.quality.toLowerCase()}`);
    if (GameState.theme === 'NIGHT') document.body.classList.add('theme-night');
    if (GameState.theme === 'RETRO') document.body.classList.add('theme-retro');
  }

  function defaultSave() {
    return {
      gridSize: 5, timerMode: 'CLASSIC', quality: 'MEDIUM', theme: 'NOTEBOOK', vibration: true,
      pseudo: 'Joueur', music: 50, sfx: 60, gems: 120, streak: 0, lastDailyClaim: 0,
      onlineRegion: 'EUW', onlineMode: 'RANKED', onlineLatencyMs: 80, onlinePacketLoss: 0,
      missions: { linesDrawn: 0, boxesClosed: 0, winsToday: 0 },
      stats: { matches: 0, p1Wins: 0, p2Wins: 0, draws: 0 },
    };
  }

  const Storage = {
    load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        Object.assign(GameState, {
          gridSize: clamp(parsed.gridSize || 5, 5, 20),
          timerMode: parsed.timerMode || 'CLASSIC',
          quality: parsed.quality || 'MEDIUM',
          theme: parsed.theme || 'NOTEBOOK',
          vibration: parsed.vibration !== false,
          pseudo: parsed.pseudo || 'Joueur',
        });
        GameState.audio.music = clamp(parsed.music ?? 50, 0, 100);
        GameState.audio.sfx = clamp(parsed.sfx ?? 60, 0, 100);
        GameState.economy.gems = parsed.gems ?? 120;
        GameState.economy.streak = parsed.streak ?? 0;
        GameState.economy.lastDailyClaim = parsed.lastDailyClaim ?? 0;
        GameState.online.region = parsed.onlineRegion || 'EUW';
        GameState.online.mode = parsed.onlineMode || 'RANKED';
        GameState.online.latencyMs = clamp(parsed.onlineLatencyMs ?? 80, 20, 350);
        GameState.online.packetLoss = clamp(parsed.onlinePacketLoss ?? 0, 0, 20);
        GameState.missions.linesDrawn = parsed.missions?.linesDrawn || 0;
        GameState.missions.boxesClosed = parsed.missions?.boxesClosed || 0;
        GameState.missions.winsToday = parsed.missions?.winsToday || 0;
        GameState.stats = {
          matches: parsed.stats?.matches || 0,
          p1Wins: parsed.stats?.p1Wins || 0,
          p2Wins: parsed.stats?.p2Wins || 0,
          draws: parsed.stats?.draws || 0,
        };
      } catch (_) {}
    },
    save() {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        gridSize: GameState.gridSize, timerMode: GameState.timerMode, quality: GameState.quality, theme: GameState.theme,
        vibration: GameState.vibration, pseudo: GameState.pseudo, music: GameState.audio.music, sfx: GameState.audio.sfx,
        gems: GameState.economy.gems, streak: GameState.economy.streak, lastDailyClaim: GameState.economy.lastDailyClaim,
        onlineRegion: GameState.online.region, onlineMode: GameState.online.mode,
        onlineLatencyMs: GameState.online.latencyMs, onlinePacketLoss: GameState.online.packetLoss,
        missions: GameState.missions, stats: GameState.stats,
      }));
    },
    reset() {
      localStorage.setItem(SAVE_KEY, JSON.stringify(defaultSave()));
      this.load();
    },
  };

  function fxPop(text) {
    const el = document.createElement('div');
    el.className = 'fx-pop';
    el.textContent = text;
    el.style.left = `${20 + Math.random() * 60}%`;
    el.style.top = `${45 + Math.random() * 20}%`;
    UI.fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function addGems(amount, reason) {
    GameState.economy.gems += amount;
    UI.gemLabel.textContent = `Gemmes: ${GameState.economy.gems}`;
    fxPop(`+${amount}💎`);
    announce(`+${amount} gemmes: ${reason}`);
    Storage.save();
  }

  function isSameDay(tsA, tsB) {
    if (!tsA || !tsB) return false;
    const a = new Date(tsA), b = new Date(tsB);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function claimDailyReward() {
    const now = Date.now();
    if (isSameDay(GameState.economy.lastDailyClaim, now)) {
      UIController.modal('Daily', 'Déjà récupéré aujourd’hui. Reviens demain 🔥');
      return;
    }
    const reward = 40 + GameState.economy.streak * 5;
    GameState.economy.lastDailyClaim = now;
    addGems(reward, 'reward quotidienne');
    UIController.modal('Daily claim', `Tu gagnes ${reward} gemmes !`);
  }

  function updateMissions(deltaLines = 0, deltaBoxes = 0, didWin = false) {
    GameState.missions.linesDrawn += deltaLines;
    GameState.missions.boxesClosed += deltaBoxes;
    if (didWin) GameState.missions.winsToday += 1;
    Storage.save();
    UIController.renderMissions();
  }

  const OnlineService = {
    setStatus(text) { UI.matchStatus.textContent = `Statut: ${text}`; },
    log(event) {
      const ts = new Date().toLocaleTimeString();
      GameState.online.netLog.unshift(`[${ts}] ${event}`);
      GameState.online.netLog = GameState.online.netLog.slice(0, 8);
      UIController.renderNetLog();
    },
    clearQueue() { if (GameState.online.queueHandle) clearTimeout(GameState.online.queueHandle); GameState.online.queueHandle = null; },
    startQueue() {
      this.clearQueue();
      GameState.online.state = 'queueing';
      const eta = 1200 + GameState.online.latencyMs * 6;
      this.setStatus(`file ${GameState.online.mode} (${GameState.online.region}) ~${Math.round(eta / 1000)}s`);
      this.log(`queue:start region=${GameState.online.region} mode=${GameState.online.mode} ping=${GameState.online.latencyMs}ms loss=${GameState.online.packetLoss}%`);
      GameState.online.queueHandle = setTimeout(() => {
        if (Math.random() * 100 < GameState.online.packetLoss * 0.8) {
          GameState.online.state = 'idle';
          this.setStatus('erreur réseau simulée, réessayez');
          this.log('queue:fail simulated_packet_drop');
          return;
        }
        GameState.online.state = 'matched';
        this.setStatus('opposant trouvé (mock): Rival_2042');
        this.log('queue:matched peer=Rival_2042');
        UIController.modal('Match trouvé', 'Contrat online validé. Étape suivante: session websocket + synchronisation serveur authoritative.');
      }, eta);
    },
    cancelQueue() { this.clearQueue(); GameState.online.state = 'idle'; this.setStatus('idle'); this.log('queue:cancel'); },
    createRoom() {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      GameState.online.roomCode = code;
      GameState.online.state = 'room_host';
      GameState.online.party = ['Vous', 'Invité_1'];
      this.setStatus(`room créée: ${code}`);
      this.log(`room:create code=${code}`);
      UIController.renderParty();
      UI.roomCodeLabel.textContent = code;
    },
    joinRoom() {
      const raw = window.prompt('Entrez le room code:');
      if (!raw) return;
      const code = raw.trim().toUpperCase().slice(0, 8);
      GameState.online.roomCode = code;
      GameState.online.state = 'room_joined';
      GameState.online.party = ['Host_Alpha', 'Vous'];
      this.setStatus(`room join: ${code} (mock)`);
      this.log(`room:join code=${code}`);
      UIController.renderParty();
      UI.roomCodeLabel.textContent = code;
    },
  };

  const Rules = {
    totalLines() { const n = GameState.gridSize; return n * (n - 1) * 2; },
    drawnLines() { return GameState.linesH.size + GameState.linesV.size; },
    isGameFinished() { return this.drawnLines() >= this.totalLines(); },
    hasLine(kind, x, y) { const k = `${x},${y}`; return kind === 'H' ? GameState.linesH.has(k) : GameState.linesV.has(k); },
    addLine(seg) { const k = `${seg.x},${seg.y}`; seg.kind === 'H' ? GameState.linesH.add(k) : GameState.linesV.add(k); },
    isBoxComplete(x, y) { return this.hasLine('H', x, y) && this.hasLine('H', x, y + 1) && this.hasLine('V', x, y) && this.hasLine('V', x + 1, y); },
    findCompletedBoxes(seg) {
      const r = []; const n = GameState.gridSize;
      if (seg.kind === 'H') {
        if (seg.y > 0 && this.isBoxComplete(seg.x, seg.y - 1)) r.push(`${seg.x},${seg.y - 1}`);
        if (seg.y < n - 1 && this.isBoxComplete(seg.x, seg.y)) r.push(`${seg.x},${seg.y}`);
      } else {
        if (seg.x > 0 && this.isBoxComplete(seg.x - 1, seg.y)) r.push(`${seg.x - 1},${seg.y}`);
        if (seg.x < n - 1 && this.isBoxComplete(seg.x, seg.y)) r.push(`${seg.x},${seg.y}`);
      }
      return r.filter((box) => !GameState.boxes.has(box));
    },
  };

  const Renderer = {
    resize() {
      const rect = UI.canvas.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      UI.canvas.width = Math.floor(rect.width * ratio);
      UI.canvas.height = Math.floor(rect.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      GameState.canvas.size = Math.min(rect.width, rect.height);
      GameState.canvas.pad = clamp(GameState.canvas.size * 0.055, 14, 30);
      GameState.canvas.step = (GameState.canvas.size - GameState.canvas.pad * 2) / (GameState.gridSize - 1);
      this.drawAll();
    },
    toPx(x, y) { const { pad, step } = GameState.canvas; return { px: pad + x * step, py: pad + y * step }; },
    drawAll() { ctx.clearRect(0, 0, UI.canvas.clientWidth, UI.canvas.clientHeight); this.drawBoxes(); this.drawLines(); this.drawHoverSegment(); this.drawDots(); },
    drawBoxes() {
      GameState.boxes.forEach((owner, key) => {
        const [x, y] = key.split(',').map(Number); const p = this.toPx(x, y); const s = GameState.canvas.step;
        ctx.fillStyle = owner === 1 ? 'rgba(56,182,255,0.24)' : 'rgba(255,107,152,0.24)';
        ctx.fillRect(p.px + 2, p.py + 2, s - 4, s - 4);
      });
    },
    drawLines() {
      ctx.lineWidth = GameState.quality === 'ULTRA' ? 5 : 4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = GameState.theme === 'RETRO' ? '#7a4d1f' : '#11357a';
      ctx.shadowColor = GameState.quality !== 'LOW' ? 'rgba(8,14,40,0.26)' : 'transparent';
      ctx.shadowBlur = GameState.quality !== 'LOW' ? 2 : 0;
      GameState.linesH.forEach((k) => { const [x, y] = k.split(',').map(Number); const a = this.toPx(x, y), b = this.toPx(x + 1, y); ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke(); });
      GameState.linesV.forEach((k) => { const [x, y] = k.split(',').map(Number); const a = this.toPx(x, y), b = this.toPx(x, y + 1); ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke(); });
      ctx.shadowBlur = 0;
    },
    drawHoverSegment() {
      const s = GameState.hoverSegment;
      if (!s || GameState.phase !== 'game' || GameState.quality === 'LOW') return;
      const a = this.toPx(s.x, s.y), b = s.kind === 'H' ? this.toPx(s.x + 1, s.y) : this.toPx(s.x, s.y + 1);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(53,126,244,0.45)'; ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
    },
    drawDots() {
      ctx.fillStyle = GameState.theme === 'RETRO' ? '#603913' : '#102b5f';
      const r = GameState.gridSize > 14 ? 2.4 : 3.6;
      for (let y = 0; y < GameState.gridSize; y++) {
        for (let x = 0; x < GameState.gridSize; x++) {
          const p = this.toPx(x, y); ctx.beginPath(); ctx.arc(p.px, p.py, r, 0, Math.PI * 2); ctx.fill();
        }
      }
    },
  };

  function pointToSegmentDistance(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    if (!l2) return Math.hypot(px - a.x, py - a.y);
    let t = ((px - a.x) * dx + (py - a.y) * dy) / l2; t = clamp(t, 0, 1);
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }

  function getNearestSegment(clientX, clientY) {
    const rect = UI.canvas.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    const { pad, step } = GameState.canvas; const n = GameState.gridSize;
    const threshold = Math.max(12, step * 0.26); let best = null;
    for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n - 1; gx++) {
      const d = pointToSegmentDistance(x, y, { x: pad + gx * step, y: pad + gy * step }, { x: pad + (gx + 1) * step, y: pad + gy * step });
      if (d < threshold && (!best || d < best.d)) best = { kind: 'H', x: gx, y: gy, d };
    }
    for (let gy = 0; gy < n - 1; gy++) for (let gx = 0; gx < n; gx++) {
      const d = pointToSegmentDistance(x, y, { x: pad + gx * step, y: pad + gy * step }, { x: pad + gx * step, y: pad + (gy + 1) * step });
      if (d < threshold && (!best || d < best.d)) best = { kind: 'V', x: gx, y: gy, d };
    }
    if (!best || Rules.hasLine(best.kind, best.x, best.y)) return null;
    return best;
  }

  function vibrate(ms) { if (GameState.vibration && navigator.vibrate) navigator.vibrate(ms); }
  function announce(msg) { UI.srAnnouncer.textContent = msg; }
  function pushHistory(msg) { GameState.turnHistory.unshift(msg); GameState.turnHistory = GameState.turnHistory.slice(0, 6); UIController.renderHistory(); }
  function resetTurnTimer() { GameState.timeLeft = TIMER_PRESETS[GameState.timerMode] ?? null; }
  function switchPlayer() { GameState.currentPlayer = GameState.currentPlayer === 1 ? 2 : 1; resetTurnTimer(); }

  function applyMove(segment) {
    if (!segment || GameState.inputLocked || GameState.paused || GameState.phase !== 'game') return;
    GameState.inputLocked = true;
    Rules.addLine(segment);
    const completed = Rules.findCompletedBoxes(segment);
    updateMissions(1, completed.length, false);
    if (completed.length) {
      completed.forEach((box) => { GameState.boxes.set(box, GameState.currentPlayer); GameState.scores[GameState.currentPlayer] += 1; });
      pushHistory(`J${GameState.currentPlayer}: +${completed.length} carré${completed.length > 1 ? 's' : ''}`);
      announce(`J${GameState.currentPlayer} ferme ${completed.length} carré${completed.length > 1 ? 's' : ''}.`);
      addGems(2 * completed.length, 'combo carré');
      vibrate(26);
    } else {
      pushHistory(`J${GameState.currentPlayer}: ligne simple`);
      switchPlayer();
    }
    UIController.updateHUD();
    Renderer.drawAll();
    if (Rules.isGameFinished()) endGame();
    GameState.inputLocked = false;
  }

  function endGame() {
    clearInterval(GameState.timerHandle);
    const s1 = GameState.scores[1], s2 = GameState.scores[2];
    let msg = `Égalité ${s1}-${s2}`;
    GameState.stats.matches += 1;
    if (s1 > s2) {
      msg = `J1 gagne ${s1}-${s2}`;
      GameState.stats.p1Wins += 1;
      GameState.economy.streak += 1;
      addGems(15 + GameState.economy.streak, 'victoire');
      updateMissions(0, 0, true);
    } else if (s2 > s1) {
      msg = `J2 gagne ${s2}-${s1}`;
      GameState.stats.p2Wins += 1;
      GameState.economy.streak = 0;
      addGems(8, 'fin de match');
    } else {
      GameState.stats.draws += 1;
      GameState.economy.streak = 0;
      addGems(5, 'égalité');
    }
    Storage.save();
    UIController.renderHomeStats();
    UIController.renderMissions();
    UIController.updateMeta();
    UIController.modal('Fin de partie', msg);
    pushHistory(msg);
    announce(msg);
  }

  function initGame() {
    GameState.currentPlayer = 1;
    GameState.scores = { 1: 0, 2: 0 };
    GameState.turnHistory = [];
    GameState.linesH.clear(); GameState.linesV.clear(); GameState.boxes.clear();
    GameState.hoverSegment = null;
    GameState.paused = false;
    clearInterval(GameState.timerHandle);
    resetTurnTimer();
    if (GameState.timerMode !== 'FREE') {
      GameState.timerHandle = setInterval(() => {
        if (GameState.phase !== 'game' || GameState.paused) return;
        GameState.timeLeft -= 1;
        if (GameState.timeLeft <= 0) { switchPlayer(); pushHistory('⏱ Changement de joueur (timeout)'); vibrate(34); announce('Temps écoulé, changement de joueur.'); }
        UIController.updateHUD();
      }, 1000);
    }
    UIController.show('game');
    document.getElementById('pauseBtn').textContent = 'Pause';
    pushHistory('Partie démarrée');
    UIController.updateHUD();
    requestAnimationFrame(() => Renderer.resize());
  }

  const UIController = {
    show(screen) {
      ['home', 'online', 'game', 'settings'].forEach((name) => UI[name].classList.toggle('active', name === screen));
      GameState.phase = screen;
    },
    updateMeta() {
      UI.pseudoLabel.textContent = `Pseudo: ${GameState.pseudo}`;
      UI.gemLabel.textContent = `Gemmes: ${GameState.economy.gems}`;
      UI.streakLabel.textContent = `${GameState.economy.streak}`;
    },
    renderMissions() {
      const missions = [
        { label: 'Tracer 20 lignes', v: GameState.missions.linesDrawn, goal: 20 },
        { label: 'Fermer 5 carrés', v: GameState.missions.boxesClosed, goal: 5 },
        { label: 'Gagner 1 match', v: GameState.missions.winsToday, goal: 1 },
      ];
      UI.missionList.innerHTML = '';
      missions.forEach((m) => {
        const done = m.v >= m.goal ? '✅' : '🟨';
        const li = document.createElement('li');
        li.textContent = `${done} ${m.label} (${Math.min(m.v, m.goal)}/${m.goal})`;
        UI.missionList.appendChild(li);
      });
    },
    renderHomeStats() {
      UI.statMatches.textContent = GameState.stats.matches;
      UI.statP1Wins.textContent = GameState.stats.p1Wins;
      UI.statP2Wins.textContent = GameState.stats.p2Wins;
    },
    renderHistory() {
      UI.turnHistory.innerHTML = '';
      if (!GameState.turnHistory.length) {
        const li = document.createElement('li'); li.textContent = 'Aucune action'; UI.turnHistory.appendChild(li); return;
      }
      GameState.turnHistory.forEach((msg) => { const li = document.createElement('li'); li.textContent = msg; UI.turnHistory.appendChild(li); });
    },
    renderNetLog() {
      UI.netLog.innerHTML = '';
      const rows = GameState.online.netLog.length ? GameState.online.netLog : ['[--:--:--] en attente...'];
      rows.forEach((msg) => { const li = document.createElement('li'); li.textContent = msg; UI.netLog.appendChild(li); });
    },
    renderParty() {
      UI.partyList.innerHTML = '';
      GameState.online.party.forEach((p) => { const li = document.createElement('li'); li.textContent = p; UI.partyList.appendChild(li); });
    },
    updateHUD() {
      UI.p1Score.textContent = GameState.scores[1]; UI.p2Score.textContent = GameState.scores[2];
      UI.turn.textContent = `Tour: J${GameState.currentPlayer}`;
      UI.linesCount.textContent = `Lignes: ${Rules.drawnLines()}/${Rules.totalLines()}`;
      UI.p1Box.classList.toggle('active-turn', GameState.currentPlayer === 1);
      UI.p2Box.classList.toggle('active-turn', GameState.currentPlayer === 2);
      if (GameState.timerMode === 'FREE') { UI.timer.textContent = 'FREE (amis)'; UI.timerFill.style.width = '100%'; }
      else {
        const limit = TIMER_PRESETS[GameState.timerMode];
        const pct = limit ? Math.round((GameState.timeLeft / limit) * 100) : 100;
        UI.timer.textContent = `${GameState.timeLeft}s`;
        UI.timerFill.style.width = `${clamp(pct, 0, 100)}%`;
      }
      UI.friendlyTag.classList.toggle('hidden', GameState.timerMode !== 'FREE');
      if (GameState.debug.enabled) UI.debugStats.textContent = `Lines: ${Rules.drawnLines()}/${Rules.totalLines()} | FPS: ${GameState.debug.fps}`;
    },
    syncSettings() {
      UI.gridSizeInput.value = GameState.gridSize; UI.gridSizeLabel.textContent = GameState.gridSize;
      UI.timerModeInput.value = GameState.timerMode; UI.themeInput.value = GameState.theme; UI.qualityInput.value = GameState.quality;
      UI.regionInput.value = GameState.online.region; UI.onlineModeInput.value = GameState.online.mode;
      UI.latencyInput.value = GameState.online.latencyMs; UI.packetLossInput.value = GameState.online.packetLoss;
      UI.latencyLabel.textContent = `${GameState.online.latencyMs}ms`; UI.packetLossLabel.textContent = `${GameState.online.packetLoss}%`;
      UI.vibrationInput.checked = GameState.vibration; UI.pseudoInput.value = GameState.pseudo;
      UI.musicVolume.value = GameState.audio.music; UI.sfxVolume.value = GameState.audio.sfx;
      applyBodyClasses();
      this.updateMeta();
      OnlineService.setStatus(GameState.online.state);
      UI.roomCodeLabel.textContent = GameState.online.roomCode || '----';
      this.renderParty();
      this.renderNetLog();
      this.renderMissions();
    },
    modal(title, body) {
      UI.modalTitle.textContent = title; UI.modalBody.textContent = body; UI.modal.classList.remove('hidden');
    },
  };

  function shareChallenge() {
    const text = `${GameState.pseudo} te défie sur PIPOPIPETTE ! Grid ${GameState.gridSize}x${GameState.gridSize}, mode ${GameState.timerMode}. Rejoins-moi 💥`;
    if (navigator.share) {
      navigator.share({ title: 'PIPOPIPETTE Challenge', text }).catch(() => {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => UIController.modal('Partage', 'Défi copié dans le presse-papiers.'));
      return;
    }
    window.prompt('Copie ce défi :', text);
  }

  function setupEvents() {
    document.getElementById('playBtn').addEventListener('click', initGame);
    document.getElementById('trainingBtn').addEventListener('click', initGame);
    document.getElementById('multiplayerBtn').addEventListener('click', () => UIController.show('online'));
    document.getElementById('settingsBtn').addEventListener('click', () => UIController.show('settings'));
    document.getElementById('backHomeBtn').addEventListener('click', () => UIController.show('home'));
    document.getElementById('backHomeFromOnlineBtn').addEventListener('click', () => UIController.show('home'));
    document.getElementById('restartBtn').addEventListener('click', initGame);

    document.getElementById('dailyClaimBtn').addEventListener('click', claimDailyReward);
    document.getElementById('shareBtn').addEventListener('click', shareChallenge);

    document.querySelectorAll('.preset').forEach((btn) => btn.addEventListener('click', () => {
      GameState.gridSize = clamp(+btn.dataset.grid, 5, 20);
      UIController.syncSettings();
      initGame();
    }));

    UI.latencyInput.addEventListener('input', () => { UI.latencyLabel.textContent = `${UI.latencyInput.value}ms`; });
    UI.packetLossInput.addEventListener('input', () => { UI.packetLossLabel.textContent = `${UI.packetLossInput.value}%`; });

    document.getElementById('queueBtn').addEventListener('click', () => {
      GameState.online.region = UI.regionInput.value;
      GameState.online.mode = UI.onlineModeInput.value;
      GameState.online.latencyMs = clamp(+UI.latencyInput.value, 20, 350);
      GameState.online.packetLoss = clamp(+UI.packetLossInput.value, 0, 20);
      Storage.save();
      OnlineService.startQueue();
    });
    document.getElementById('cancelQueueBtn').addEventListener('click', () => OnlineService.cancelQueue());
    document.getElementById('createRoomBtn').addEventListener('click', () => OnlineService.createRoom());
    document.getElementById('joinRoomBtn').addEventListener('click', () => OnlineService.joinRoom());
    document.getElementById('copyInviteBtn').addEventListener('click', () => {
      const code = GameState.online.roomCode || 'PENDING';
      const invite = `Rejoins ma room PIPOPIPETTE: ${code} (region ${GameState.online.region})`;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(invite);
      UIController.modal('Invitation', 'Texte d’invitation prêt à partager.');
    });

    document.getElementById('quitBtn').addEventListener('click', () => { clearInterval(GameState.timerHandle); GameState.paused = false; UIController.show('home'); });
    document.getElementById('pauseBtn').addEventListener('click', (e) => { GameState.paused = !GameState.paused; e.target.textContent = GameState.paused ? 'Reprendre' : 'Pause'; announce(GameState.paused ? 'Partie en pause.' : 'Partie reprise.'); });

    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
      GameState.gridSize = clamp(+UI.gridSizeInput.value, 5, 20);
      GameState.timerMode = UI.timerModeInput.value;
      GameState.theme = UI.themeInput.value;
      GameState.quality = UI.qualityInput.value;
      GameState.online.region = UI.regionInput.value;
      GameState.online.mode = UI.onlineModeInput.value;
      GameState.online.latencyMs = clamp(+UI.latencyInput.value, 20, 350);
      GameState.online.packetLoss = clamp(+UI.packetLossInput.value, 0, 20);
      GameState.vibration = UI.vibrationInput.checked;
      GameState.audio.music = clamp(+UI.musicVolume.value, 0, 100);
      GameState.audio.sfx = clamp(+UI.sfxVolume.value, 0, 100);
      GameState.pseudo = (UI.pseudoInput.value || 'Joueur').trim().slice(0, 16);
      Storage.save();
      UIController.syncSettings();
      UIController.modal('Paramètres', 'Sauvegarde locale effectuée.');
    });

    document.getElementById('exportDataBtn').addEventListener('click', async () => {
      const data = localStorage.getItem(SAVE_KEY) || JSON.stringify(defaultSave());
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(data); UIController.modal('Export', 'Save copiée dans le presse-papiers.'); }
        else window.prompt('Copiez la sauvegarde :', data);
      } catch (_) { window.prompt('Copiez la sauvegarde :', data); }
    });

    document.getElementById('importDataBtn').addEventListener('click', () => {
      const raw = window.prompt('Collez la sauvegarde JSON ici :');
      if (!raw) return;
      try {
        JSON.parse(raw);
        localStorage.setItem(SAVE_KEY, raw);
        Storage.load();
        UIController.syncSettings();
        UIController.renderHomeStats();
        UIController.modal('Import', 'Sauvegarde importée avec succès.');
      } catch (_) {
        UIController.modal('Import', 'JSON invalide.');
      }
    });

    document.getElementById('resetDataBtn').addEventListener('click', () => {
      if (!window.confirm('Réinitialiser la sauvegarde locale ?')) return;
      Storage.reset();
      UIController.syncSettings();
      UIController.renderHomeStats();
      UIController.modal('Reset', 'Sauvegarde réinitialisée.');
    });

    UI.gridSizeInput.addEventListener('input', () => { UI.gridSizeLabel.textContent = UI.gridSizeInput.value; });
    UI.canvas.addEventListener('pointermove', (ev) => { GameState.hoverSegment = getNearestSegment(ev.clientX, ev.clientY); if (GameState.phase === 'game') Renderer.drawAll(); });
    UI.canvas.addEventListener('pointerleave', () => { GameState.hoverSegment = null; if (GameState.phase === 'game') Renderer.drawAll(); });
    UI.canvas.addEventListener('pointerdown', (ev) => applyMove(getNearestSegment(ev.clientX, ev.clientY)));

    window.addEventListener('resize', () => Renderer.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => Renderer.resize(), 120));

    document.querySelectorAll('.placeholder').forEach((btn) => btn.addEventListener('click', () => UIController.modal('Bientôt disponible', 'Fonctionnalité prévue dans les prochaines versions.')));
    document.querySelectorAll('[data-legal]').forEach((btn) => btn.addEventListener('click', () => {
      const map = {
        cgu: 'CGU: service local MVP, règles sujettes à évolution.',
        privacy: 'Privacy: aucune donnée envoyée, stockage uniquement localStorage.',
        rgpd: 'RGPD: export/suppression = effacer les données navigateur.',
      };
      UIController.modal(btn.dataset.legal.toUpperCase(), map[btn.dataset.legal]);
    }));

    document.getElementById('modalClose').addEventListener('click', () => UI.modal.classList.add('hidden'));
    UI.modal.addEventListener('click', (ev) => { if (ev.target === UI.modal) UI.modal.classList.add('hidden'); });

    const news = [
      'Event week-end: double gemmes (mock).',
      'Saison 1: classement en préparation.',
      'Patch mobile: précision tactile améliorée.',
      'Préparation online: queue + room + netlog mock prêtes.',
      'Mission du jour: ferme 5 carrés pour bonus dopamine 💎',
    ];
    setInterval(() => { GameState.newsIndex = (GameState.newsIndex + 1) % news.length; UI.newsTicker.textContent = news[GameState.newsIndex]; }, 2800);

    let tapCount = 0;
    let tapResetTimer = 0;
    document.getElementById('logoBtn').addEventListener('click', () => {
      tapCount += 1;
      clearTimeout(tapResetTimer);
      tapResetTimer = setTimeout(() => { tapCount = 0; }, 600);
      if (tapCount >= 3) {
        tapCount = 0;
        GameState.debug.enabled = !GameState.debug.enabled;
        UI.debugPanel.classList.toggle('hidden', !GameState.debug.enabled);
        UIController.updateHUD();
      }
    });

    document.getElementById('fillRandomBtn').addEventListener('click', () => {
      if (GameState.phase !== 'game') return;
      const n = GameState.gridSize;
      for (let i = 0; i < 20; i++) {
        const horizontal = Math.random() > 0.5;
        const seg = { kind: horizontal ? 'H' : 'V', x: horizontal ? Math.floor(Math.random() * (n - 1)) : Math.floor(Math.random() * n), y: horizontal ? Math.floor(Math.random() * n) : Math.floor(Math.random() * (n - 1)) };
        if (!Rules.hasLine(seg.kind, seg.x, seg.y)) applyMove(seg);
      }
    });

    document.getElementById('fillEndgameBtn').addEventListener('click', () => {
      if (GameState.phase !== 'game') return;
      const n = GameState.gridSize;
      for (let y = 0; y < n; y++) for (let x = 0; x < n - 1; x++) { if (!Rules.hasLine('H', x, y)) applyMove({ kind: 'H', x, y }); if (Rules.isGameFinished()) return; }
      for (let y = 0; y < n - 1; y++) for (let x = 0; x < n; x++) { if (!Rules.hasLine('V', x, y)) applyMove({ kind: 'V', x, y }); if (Rules.isGameFinished()) return; }
    });

    function fpsLoop(ts) {
      if (GameState.debug.lastTs) GameState.debug.fps = Math.round(1000 / (ts - GameState.debug.lastTs));
      GameState.debug.lastTs = ts;
      if (GameState.debug.enabled) UIController.updateHUD();
      requestAnimationFrame(fpsLoop);
    }
    requestAnimationFrame(fpsLoop);
  }

  Storage.load();
  UIController.syncSettings();
  UIController.renderHomeStats();
  UIController.renderHistory();
  setupEvents();
})();
