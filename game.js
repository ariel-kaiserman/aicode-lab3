/* global Phaser, COIN_DASH */
const HIGH_SCORE_KEY = 'coin-dash.high-score';
let bestScoreInMemory = 0;
let bestDuoScoreInMemory = 0;
const DUO_HIGH_SCORE_KEY = 'coin-dash.duo-high-score';

function readHighScore(mode = 'solo') {
  if (mode === 'duo') return readDuoHighScore();
  try {
    const saved = window.localStorage.getItem(HIGH_SCORE_KEY);
    const score = saved !== null && /^\d+$/.test(saved) ? Number(saved) : 0;
    if (Number.isSafeInteger(score)) bestScoreInMemory = Math.max(bestScoreInMemory, score);
  } catch (_) { /* Storage may be blocked; keep the record for this page session. */ }
  return bestScoreInMemory;
}

function saveHighScore(score, mode = 'solo') {
  if (mode === 'duo') return saveDuoHighScore(score);
  bestScoreInMemory = Math.max(readHighScore(), score);
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(bestScoreInMemory));
  } catch (_) { /* The in-memory record still survives a round restart. */ }
  return bestScoreInMemory;
}

function readDuoHighScore() {
  try {
    const saved = window.localStorage.getItem(DUO_HIGH_SCORE_KEY);
    const score = saved !== null && /^\d+$/.test(saved) ? Number(saved) : 0;
    if (Number.isSafeInteger(score)) bestDuoScoreInMemory = Math.max(bestDuoScoreInMemory, score);
  } catch (_) { /* Keep duo records separate even when storage is blocked. */ }
  return bestDuoScoreInMemory;
}
function saveDuoHighScore(score) {
  bestDuoScoreInMemory = Math.max(readDuoHighScore(), score);
  try { window.localStorage.setItem(DUO_HIGH_SCORE_KEY, String(bestDuoScoreInMemory)); }
  catch (_) { /* Retain the page-session record. */ }
  return bestDuoScoreInMemory;
}

// Sounds are synthesized with Web Audio; the context is created lazily on first use.
let audioCtx = null;
function playTones(notes, type) {
  const s = COIN_DASH.sound;
  if (!s || !s.enabled) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === 'suspended') { const p = audioCtx.resume(); if (p) p.catch(() => {}); }
    const peak = Math.max(s.volume, 0.0001);
    let t = audioCtx.currentTime;
    for (const [freq, dur] of notes) {
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur * 0.8;
    }
  } catch (e) { /* sound is optional */ }
}

const hex = n => '#' + n.toString(16).padStart(6, '0');
const textStyle = (size, color, extra) => Object.assign(
  { fontFamily: COIN_DASH.fontFamily, fontSize: `${size}px`, fontStyle: 'bold', color: hex(color) }, extra);
// Rounded corners and an ink outline give shapes a sticker look; guarded for builds/mocks without them.
function sticker(shape, radius, outline = COIN_DASH.colors.ink) {
  if (radius && shape.setRounded) shape.setRounded(radius);
  if (outline !== null && shape.setStrokeStyle) shape.setStrokeStyle(3, outline);
  return shape;
}

class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create(data = {}) {
    const c = COIN_DASH, k = c.colors;
    const levelSelect = typeof document === 'undefined' ? null : document.getElementById('difficulty-level');
    const selectedLevel = Number(levelSelect?.value || data.level || 1);
    this.level = Number.isInteger(selectedLevel) && selectedLevel >= 1 && selectedLevel <= c.levels.length
      ? selectedLevel : 1;
    this.levelSettings = c.levels[this.level - 1];
    const modeSelect = typeof document !== 'undefined' ? document.getElementById('player-mode') : null;
    this.mode = data.mode || (modeSelect && modeSelect.value) || this.mode || 'solo';
    if (this.mode !== 'duo') this.mode = 'solo';
    if (modeSelect) modeSelect.value = this.mode;
    this.score = 0;
    this.score2 = 0;
    this.bestScore = readHighScore(this.mode);
    this.finished = false;
    this.boostUntil = 0;
    this.boostUntil2 = 0;
    this.powerUpRespawnAt = 0;
    this.paused = false;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 64, c.width, c.height - 64);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40, k.background, 1, k.grid, 0.6);
    this.add.rectangle(c.width / 2, 64, c.width, 2, k.margin);
    this.hud = this.add.text(18, 8, '', textStyle(17, k.ink));
    this.player = sticker(this.add.rectangle(c.width / 2 - (this.mode === 'duo' ? 60 : 0), c.height / 2, 24, 24, k.player), 7);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.players = [this.player];
    this.player2 = null;
    if (this.mode === 'duo') {
      this.player2 = sticker(this.add.rectangle(c.width / 2 + 60, c.height / 2, 24, 24, k.player2), 7);
      this.physics.add.existing(this.player2);
      this.player2.body.setCollideWorldBounds(true);
      this.players.push(this.player2);
    }
    // Two players share the field, so duo rounds keep several coins out at once.
    this.coins = [];
    for (let i = 0; i < (this.mode === 'duo' ? c.duoCoinCount : 1); i++) {
      const coin = sticker(this.add.circle(100, 100, 9, k.coin));
      this.physics.add.existing(coin);
      coin.body.setCircle(9);
      this.coins.push(coin);
    }
    this.coin = this.coins[0];
    this.coins.forEach(coin => this.placeCoin(coin));
    this.speedPowerUp = sticker(this.add.rectangle(0, 0, 24, 24, k.speedPowerUp), 7);
    this.physics.add.existing(this.speedPowerUp);
    this.speedPowerUp.body.setAllowGravity(false).setImmovable(true);
    this.speedPowerUpLabel = this.add.text(0, 0, '>>', textStyle(15, k.ink)).setOrigin(0.5);
    this.boostHud = this.add.text(18, 34, '', textStyle(16, k.boostText)).setOrigin(0, 0);
    this.placeSpeedPowerUp();
    this.players.forEach((player, index) => {
      this.physics.add.overlap(player, this.speedPowerUp, () => this.collectSpeedPowerUp(index));
    });
    this.drones = this.physics.add.group();
    for (let i = 0; i < this.levelSettings.droneCount; i++) {
      const drone = sticker(this.add.rectangle((i + 1) * c.width / (this.levelSettings.droneCount + 1), 100, 26, 26, k.drone), 8);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * this.levelSettings.droneSpeed, Math.sin(angle) * this.levelSettings.droneSpeed);
    }
    this.players.forEach((player, index) => {
      this.coins.forEach(coin => this.physics.add.overlap(player, coin, () => this.collectCoin(index, coin)));
      this.physics.add.overlap(player, this.drones, () => this.finish(
        this.mode === 'duo' ? `A drone caught Player ${index + 1}!` : 'A drone caught you!'
      ));
    });
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart({ mode: this.mode, level: this.level }));
    this.pauseCard = this.card(420, 84, false);
    this.pauseOverlay = this.add.text(c.width / 2, c.height / 2, 'Paused — press P to resume', textStyle(24, k.ink))
      .setOrigin(0.5).setVisible(false);
    this.input.keyboard.on('keydown-P', event => { if (!event || !event.repeat) this.togglePause(); });
  }

  collectCoin(index = 0, coin = this.coin) {
    if (this.finished || this.paused) return;
    if (index === 1) this.score2++;
    else this.score++;
    this.bestScore = saveHighScore(Math.max(this.score, this.score2), this.mode);
    playTones([[988, 0.08], [1319, 0.2]], 'triangle');
    this.placeCoin(coin);
  }

  // A rounded paper card with a soft offset shadow, centred on the field.
  card(w, h, visible = true) {
    const c = COIN_DASH, k = c.colors;
    return [this.add.rectangle(c.width / 2 + 6, c.height / 2 + 7, w, h, k.shadow, 0.16),
      this.add.rectangle(c.width / 2, c.height / 2, w, h, k.paper)]
      .map((shape, i) => sticker(shape, 18, i ? k.ink : null).setVisible(visible));
  }

  togglePause() {
    if (this.finished) return;
    this.paused = !this.paused;
    // Freeze the round clock by keeping the remaining time across the pause.
    if (this.paused) {
      this.remaining = this.deadline - this.time.now;
      this.pausedAt = this.time.now;
      this.physics.pause();
    } else {
      const pauseDuration = this.time.now - this.pausedAt;
      this.deadline = this.time.now + this.remaining;
      if (this.boostUntil > this.pausedAt) this.boostUntil += pauseDuration;
      if (this.boostUntil2 > this.pausedAt) this.boostUntil2 += pauseDuration;
      if (this.powerUpRespawnAt > this.pausedAt) this.powerUpRespawnAt += pauseDuration;
      this.physics.resume();
    }
    this.pauseCard.forEach(shape => shape.setVisible(this.paused));
    this.pauseOverlay.setVisible(this.paused);
  }

  placeCoin(coin = this.coin) {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath a player or on top of another coin.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(90, c.height - 25);
    } while (this.players.some(player => Phaser.Math.Distance.Between(x, y, player.x, player.y) < 60)
      || this.coins.some(other => other !== coin && Phaser.Math.Distance.Between(x, y, other.x, other.y) < 40));
    coin.setPosition(x, y);
    coin.body.reset(x, y);
  }

  placeSpeedPowerUp() {
    const c = COIN_DASH;
    let x, y;
    do {
      x = Phaser.Math.Between(30, c.width - 30);
      y = Phaser.Math.Between(95, c.height - 30);
    } while (this.players.some(player => Phaser.Math.Distance.Between(x, y, player.x, player.y) < 80)
      || this.coins.some(coin => Phaser.Math.Distance.Between(x, y, coin.x, coin.y) < 40));
    this.speedPowerUp.setPosition(x, y).setVisible(true);
    this.speedPowerUp.body.reset(x, y);
    this.speedPowerUp.body.enable = true;
    this.speedPowerUpLabel.setPosition(x, y).setVisible(true);
  }

  collectSpeedPowerUp(index = 0) {
    if (this.finished || this.paused || !this.speedPowerUp.body.enable) return;
    const c = COIN_DASH;
    if (index === 1) this.boostUntil2 = this.time.now + c.speedBoostSeconds * 1000;
    else this.boostUntil = this.time.now + c.speedBoostSeconds * 1000;
    this.powerUpRespawnAt = this.time.now + c.speedPowerUpRespawnSeconds * 1000;
    this.speedPowerUp.body.enable = false;
    this.speedPowerUp.setVisible(false);
    this.speedPowerUpLabel.setVisible(false);
  }

  update() {
    if (this.finished || this.paused) return;
    const boosts = [this.boostUntil, this.boostUntil2].map(until =>
      Math.max(0, Math.ceil((until - this.time.now) / 1000)));
    if (!this.speedPowerUp.body.enable && this.time.now >= this.powerUpRespawnAt) {
      this.placeSpeedPowerUp();
    }
    const statuses = boosts.slice(0, this.players.length).map((seconds, index) => seconds > 0
      ? `${this.mode === 'duo' ? `P${index + 1} ` : ''}Speed x${COIN_DASH.speedBoostMultiplier}: ${seconds}s` : '').filter(Boolean);
    this.boostHud.setText(statuses.join('   '));
    const wasd = [Number(this.keys.D.isDown) - Number(this.keys.A.isDown),
      Number(this.keys.S.isDown) - Number(this.keys.W.isDown)];
    const arrows = [Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown),
      Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown)];
    this.players.forEach((player, index) => {
      const dx = this.mode === 'solo'
        ? Number(this.cursors.right.isDown || this.keys.D.isDown) - Number(this.cursors.left.isDown || this.keys.A.isDown)
        : (index === 0 ? wasd[0] : arrows[0]);
      const dy = this.mode === 'solo'
        ? Number(this.cursors.down.isDown || this.keys.S.isDown) - Number(this.cursors.up.isDown || this.keys.W.isDown)
        : (index === 0 ? wasd[1] : arrows[1]);
      const speed = COIN_DASH.playerSpeed * (boosts[index] > 0 ? COIN_DASH.speedBoostMultiplier : 1);
      const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(speed);
      player.body.setVelocity(direction.x, direction.y);
      player.setFillStyle(boosts[index] > 0 ? COIN_DASH.colors.speedPowerUp
        : (index === 0 ? COIN_DASH.colors.player : COIN_DASH.colors.player2));
    });
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(this.mode === 'duo'
      ? `L${this.level}  P1: ${this.score}  P2: ${this.score2}  Duo best: ${this.bestScore}  Time: ${seconds}s`
      : `L${this.level}  Coins: ${this.score}  Best: ${this.bestScore}  Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    this.boostUntil = 0;
    this.boostUntil2 = 0;
    this.boostHud.setText('');
    this.player.setFillStyle(COIN_DASH.colors.player);
    if (this.player2) this.player2.setFillStyle(COIN_DASH.colors.player2);
    if (reason === 'Time is up!') playTones([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.35]], 'triangle');
    else playTones([[220, 0.16], [165, 0.16], [110, 0.4]], 'sawtooth');
    const c = COIN_DASH;
    this.card(700, 200);
    const result = this.mode === 'duo'
      ? `${this.score === this.score2 ? 'Tie!' : `Player ${this.score > this.score2 ? 1 : 2} wins!`} P1: ${this.score} | P2: ${this.score2}`
      : `${this.score} coins collected`;
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${result}\n${this.mode === 'duo' ? 'Duo best' : 'Best'}: ${this.bestScore} coins\nPress R to try again`,
      textStyle(24, c.colors.ink, { align: 'center', lineSpacing: 12 })
    ).setOrigin(0.5);
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: CoinDash
});

// The selector is outside the scene so it remains available after a round ends.
if (typeof document !== 'undefined') {
  document.getElementById('difficulty-level')?.addEventListener('change', () => {
    const gameScene = window.coinDashGame?.scene?.getScene?.('CoinDash');
    gameScene?.scene?.restart();
  });
}

// Change mode without replacing the current difficulty selection.
if (typeof document !== 'undefined') {
  const modeSelect = document.getElementById('player-mode');
  if (modeSelect) modeSelect.addEventListener('change', () => {
    const scene = window.coinDashGame?.scene?.getScene?.('CoinDash');
    if (!scene || !scene.scene) return;
    scene.scene.restart({ mode: modeSelect.value, level: scene.level });
  });
}
