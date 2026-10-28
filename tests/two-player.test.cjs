const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const overlaps = [];
const keyboardEvents = {};
function object(x, y) {
  const obj = { x, y, visible: true,
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setVisible(value) { this.visible = value; return this; },
    setOrigin() { return this; }, setText(value) { this.text = value; return this; },
    setFillStyle(value) { this.fill = value; return this; }
  };
  obj.body = { enable: true, setCollideWorldBounds() { return this; },
    setCircle() { return this; }, setAllowGravity() { return this; },
    setImmovable() { return this; }, setBounce() { return this; },
    setVelocity(x, y) { this.velocity = {x,y}; return this; },
    reset(x, y) { obj.setPosition(x, y); }
  };
  return obj;
}
const key = () => ({isDown:false});
class Scene {
  constructor() {
    this.time = {now: 100};
    this.add = {grid() {}, rectangle:object, circle:object, text:object};
    this.physics = {world:{setBounds(){}}, pause(){this.paused=true;}, resume(){this.paused=false;}, add:{
      existing(){}, group:()=>({add(){}}), overlap(a,b,fn){overlaps.push({a,b,fn});}
    }};
    this.input = {keyboard:{
      createCursorKeys:()=>({left:key(),right:key(),up:key(),down:key()}),
      addKeys:()=>Object.fromEntries('W,A,S,D,R'.split(',').map(k=>[k,key()])), on(name,fn){keyboardEvents[name]=fn;}
    }};
  }
}
class Vector2 {
  constructor(x,y){this.x=x;this.y=y;}
  normalize(){const n=Math.hypot(this.x,this.y)||1;this.x/=n;this.y/=n;return this;}
  scale(n){this.x*=n;this.y*=n;return this;}
}
let seed=1;
const ctx={Phaser:{Scene,Game:class{},Math:{Vector2,Between:(a,b)=>{seed=(seed*16807)%2147483647;return a+seed%(b-a+1);},
  Distance:{Between:(x,y,u,v)=>Math.hypot(x-u,y-v)}},Scale:{FIT:0,CENTER_HORIZONTALLY:0}}};
const modeSelect={value:'duo', addEventListener(name,fn){this.change=fn;}};
ctx.document={getElementById:id=>id==='player-mode'?modeSelect:null};
ctx.window=ctx;ctx.localStorage={getItem:()=>null,setItem(){}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'settings.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'game.js'),'utf8')+'\nthis.TestScene=CoinDash;',ctx);
const scene=new ctx.TestScene();
let restarted;
scene.scene={restart:data=>{restarted=data;}};
ctx.coinDashGame.scene={getScene:()=>scene};
scene.create();
const c=ctx.COIN_DASH;
assert.equal(scene.mode,'duo');assert.equal(scene.players.length,2);
assert.notEqual(scene.player,scene.player2);
scene.keys.D.isDown=true;scene.cursors.up.isDown=true;scene.update();
assert.equal(scene.player.body.velocity.x,c.playerSpeed);
assert.equal(scene.player.body.velocity.y,0);
assert.equal(scene.player2.body.velocity.x,0);
assert.equal(scene.player2.body.velocity.y,-c.playerSpeed);
const coin1=overlaps.find(o=>o.a===scene.player&&o.b===scene.coin).fn;
const coin2=overlaps.find(o=>o.a===scene.player2&&o.b===scene.coin).fn;
coin1();coin2();coin2();
assert.equal(scene.score,1);assert.equal(scene.score2,2);
const pick2=overlaps.find(o=>o.a===scene.player2&&o.b===scene.speedPowerUp).fn;
pick2();scene.update();
assert.equal(scene.boostUntil,0);
assert.equal(scene.player.body.velocity.x,c.playerSpeed);
assert.equal(scene.player2.body.velocity.y,-c.playerSpeed*c.speedBoostMultiplier);
assert.match(scene.boostHud.text,/P2 Speed/);
const before=scene.boostUntil2;
scene.togglePause();scene.time.now+=10000;scene.update();
assert.equal(scene.boostUntil2,before);
scene.togglePause();assert.equal(scene.boostUntil2,before+10000);
keyboardEvents['keydown-P']({repeat:true});assert.equal(scene.paused,false);
scene.time.now=scene.deadline;scene.update();
assert.equal(scene.finished,true);assert.equal(scene.boostUntil2,0);
// Capture finish text in a fresh round and verify winner/tie decisions.
const texts=[];const addText=scene.add.text;
scene.add.text=(...args)=>{texts.push(args[2]);return addText(...args);};
scene.create();scene.score=3;scene.score2=1;scene.finish('Time is up!');
assert.match(texts[texts.length-1],/Player 1 wins!/);
scene.create();scene.score=2;scene.score2=2;scene.finish('Time is up!');
assert.match(texts[texts.length-1],/Tie!/);
scene.create();
const drone2=overlaps.filter(o=>o.a===scene.player2&&o.b===scene.drones).pop().fn;
drone2();assert.match(texts[texts.length-1],/A drone caught Player 2!/);
modeSelect.value='solo';modeSelect.change();
assert.equal(restarted.mode,'solo');
scene.create(restarted);assert.equal(scene.players.length,1);assert.equal(scene.mode,'solo');
scene.level=4;modeSelect.value='duo';modeSelect.change();
assert.equal(restarted.level,4);scene.create(restarted);
keyboardEvents['keydown-R']();assert.equal(restarted.mode,'duo');assert.equal(restarted.level,4);
assert.equal(scene.score,0);assert.equal(scene.score2,0);assert.equal(scene.boostUntil2,0);
vm.runInContext("saveHighScore(7, 'duo');",ctx);
assert.equal(vm.runInContext('readHighScore()',ctx),0,'duo best never overwrites solo best');
assert.equal(vm.runInContext("readHighScore('duo')",ctx),7);
for (let level = 1; level <= 5; level++) {
  scene.create({ mode: 'duo', level });
  assert.equal(scene.level, level);
  assert.equal(scene.levelSettings, c.levels[level - 1]);
  assert.equal(scene.players.length, 2);
  scene.update();
  assert.match(scene.hud.text, new RegExp(`^L${level}  P1:`));
}
console.log('Two-player tests passed: independent movement/scores/boosts, pause, winner/tie, drone, mode switch, restart, separate records.');
