const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const overlaps = [];
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
      existing(){}, group:()=>({members:[],add(obj){this.members.push(obj);}}), overlap(a,b,fn){overlaps.push({a,b,fn});}
    }};
    this.input = {keyboard:{
      createCursorKeys:()=>({left:key(),right:key(),up:key(),down:key()}),
      addKeys:()=>Object.fromEntries('W,A,S,D,R'.split(',').map(k=>[k,key()])), on(){}
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
ctx.window=ctx;ctx.localStorage={getItem:()=>null,setItem(){}};
const selector = { value: '1', addEventListener(event, fn) { assert.equal(event, 'change'); this.change = fn; } };
ctx.document = { getElementById(id) { return id === 'difficulty-level' ? selector : null; } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'settings.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'game.js'),'utf8')+'\nthis.TestScene=CoinDash;',ctx);
const scene=new ctx.TestScene();
const c=ctx.COIN_DASH;
let priorCount=0, priorSpeed=0;
for(let level=1;level<=5;level++) {
  selector.value=String(level);
  scene.create();
  assert.equal(scene.level,level);
  assert.equal(scene.levelSettings,c.levels[level-1]);
  assert.equal(scene.drones.members.length,c.levels[level-1].droneCount);
  assert.ok(scene.levelSettings.droneCount>priorCount, 'harder levels have more drones');
  assert.ok(scene.levelSettings.droneSpeed>priorSpeed, 'harder levels have faster drones');
  for(const drone of scene.drones.members) {
    assert.ok(drone.x>=13 && drone.x<=c.width-13 && drone.y>=77 && drone.y<=c.height-13,
      `level ${level}: drone rectangle stays inside the arena`);
    assert.ok(Math.abs(Math.hypot(drone.body.velocity.x,drone.body.velocity.y)-scene.levelSettings.droneSpeed)<1e-8);
  }
  scene.update();
  assert.match(scene.hud.text, new RegExp(`^L${level} `));
  priorCount=scene.levelSettings.droneCount;priorSpeed=scene.levelSettings.droneSpeed;
}
for(const value of ['0','6','1.5','bad']) {
  selector.value=value;scene.create();assert.equal(scene.level,1,'invalid level falls back to easiest');
}
let restarts=0;
ctx.coinDashGame.scene={getScene(name){assert.equal(name,'CoinDash');return {scene:{restart(){restarts++;}}};}};
selector.value='3';selector.change();assert.equal(restarts,1,'selection change restarts current round');
ctx.coinDashGame.scene=undefined;selector.change();
delete ctx.document;scene.create();assert.equal(scene.level,1,'headless/default scene starts at level one');
console.log('Difficulty tests passed: five increasing levels, drone count/speed, safe spawn bounds, HUD, selector restart, invalid/headless defaults.');
