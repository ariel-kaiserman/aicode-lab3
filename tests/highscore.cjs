const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
const settings = fs.readFileSync(path.join(__dirname, '../settings.js'), 'utf8');
const key = 'coin-dash.high-score';
function load(storage) {
  const context = { window: { localStorage: storage }, Phaser: {
    Scene: class {}, Game: class {}, AUTO: 0, Scale: { FIT: 0, CENTER_HORIZONTALLY: 0 },
    Math: { Between: min => min, Distance: { Between: () => 100 } }
  } };
  context.window = Object.assign(context, context.window);
  vm.createContext(context);
  vm.runInContext(settings + '\n' + source + '\nglobalThis.TestScene = CoinDash;', context);
  return () => {
    const scene = new context.TestScene();
    const overlap = [];
    const shape = (x,y) => ({ x,y, setRadius() { return this; }, setPosition() { return this; }, setVisible() { return this; }, setOrigin() { return this; },
      body: { setCollideWorldBounds() { return this; }, setAllowGravity() { return this; }, setImmovable() { return this; }, setBounce() {}, setVelocity() {},
        updateFromGameObject() {}, setCircle() {}, reset() {} } });
    scene.time = { now: 0 };
    scene.add = { grid() {}, text: () => ({ setText() { return this; }, setPosition() { return this; }, setVisible() { return this; }, setOrigin() { return this; } }), rectangle: shape, circle: shape };
    scene.physics = { world: { setBounds() {} }, pause() {}, add: {
      existing() {}, group: () => ({ add() {} }), overlap: (a,b,fn) => overlap.push({ a, b, fn })
    } };
    scene.input = { keyboard: { createCursorKeys() {}, addKeys() {}, on() {} } };
    scene.create();
    return { scene, coin: overlap.find(entry => entry.b === scene.coin).fn };
  };
}
let saved = {};
const storage = { getItem: k => saved[k] ?? null, setItem: (k,v) => { saved[k] = v; } };
let spawn = load(storage);
let game = spawn();
assert.equal(game.scene.bestScore, 0);
game.coin(); game.coin();
assert.equal(saved[key], '2', 'new record is persisted before round completion');
assert.equal(game.scene.bestScore, 2);
assert.equal(spawn().scene.bestScore, 2, 'scene restart retains record');
spawn = load(storage);
game = spawn();
assert.equal(game.scene.bestScore, 2, 'fresh page context reloads record');
game.coin();
assert.equal(saved[key], '2', 'a lower score never replaces the record');
game.scene.finished = true; game.coin();
assert.equal(game.scene.score, 1, 'finished rounds cannot collect more coins');
for (const value of ['garbage', '-2', '1.5', 'Infinity', '9007199254740992', '']) {
  saved = { [key]: value };
  assert.equal(load(storage)().scene.bestScore, 0, `invalid stored score: ${value}`);
}
const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
spawn = load(blocked); game = spawn(); game.coin();
assert.equal(spawn().scene.bestScore, 1, 'blocked storage retains record across round restart');
console.log('High-score tests passed: immediate save, reload, restart, lower scores, invalid/blocked storage.');
