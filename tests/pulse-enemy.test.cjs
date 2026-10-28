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
    setRadius(radius) {
      this.radius=radius;this.width=radius*2;this.height=radius*2;
      this.displayOriginX=radius;this.displayOriginY=radius;return this;
    }, setFillStyle(value) { this.fill = value; return this; }
  };
  obj.body = { enable: true, setCollideWorldBounds() { return this; },
    updateFromGameObject() {
      this.x=obj.x-obj.displayOriginX+this.offsetX;
      this.y=obj.y-obj.displayOriginY+this.offsetY;
      this.center={x:this.x+this.halfWidth,y:this.y+this.halfHeight};
    }, setCircle(radius,offsetX=0,offsetY=0) {
      this.radius=radius;this.width=radius*2;this.height=radius*2;
      this.halfWidth=Math.floor(this.width/2);this.halfHeight=Math.floor(this.height/2);
      this.offsetX=offsetX;this.offsetY=offsetY;return this;
    }, setAllowGravity() { return this; },
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
const scene=new ctx.TestScene();scene.create({mode:'duo'});
const c=ctx.COIN_DASH;
const pulse=scene.pulseEnemy;
function checkCircle(radius) {
  assert.equal(pulse.radius,radius,'visible radius');
  assert.equal(pulse.body.radius,radius,'collision radius');
  assert.equal(pulse.body.width,radius*2);
  assert.equal(pulse.body.height,radius*2);
  assert.equal(pulse.body.center.x,pulse.x,'physics stays centered horizontally');
  assert.equal(pulse.body.center.y,pulse.y,'physics stays centered vertically');
  assert.equal(pulse.body.x,pulse.x-radius);
  assert.equal(pulse.body.y,pulse.y-radius);
}
checkCircle(c.pulseEnemy.minRadius);
assert.equal(pulse.body.moves,false);
assert.ok(pulse.x-c.pulseEnemy.maxRadius>=0);
assert.ok(pulse.y-c.pulseEnemy.maxRadius>=64);
assert.ok(pulse.y+c.pulseEnemy.maxRadius<=c.height);
for(const player of scene.players) {
  assert.ok(Math.hypot(player.x-pulse.x,player.y-pulse.y)>c.pulseEnemy.maxRadius+24);
}
const start=scene.pulseStartedAt;
scene.time.now=start+c.pulseEnemy.cycleSeconds*1000/2;
scene.updatePulseEnemy();checkCircle(c.pulseEnemy.maxRadius);
scene.time.now=start+c.pulseEnemy.cycleSeconds*1000;
scene.updatePulseEnemy();checkCircle(c.pulseEnemy.minRadius);
scene.time.now=start+c.pulseEnemy.cycleSeconds*1000/4;
scene.updatePulseEnemy();checkCircle(Math.round((c.pulseEnemy.minRadius+c.pulseEnemy.maxRadius)/2));
const oldRadius=pulse.radius;
scene.togglePause();scene.time.now+=10000;
scene.update();scene.updatePulseEnemy();checkCircle(oldRadius);
scene.togglePause();scene.updatePulseEnemy();checkCircle(oldRadius);
scene.time.now+=c.pulseEnemy.cycleSeconds*1000/4;
scene.updatePulseEnemy();checkCircle(c.pulseEnemy.maxRadius);
scene.finish('Done');scene.time.now+=750;scene.updatePulseEnemy();checkCircle(c.pulseEnemy.maxRadius);
scene.create({mode:'duo'});
assert.equal(scene.pulseEnemy.radius,c.pulseEnemy.minRadius,'restart resets cycle');
assert.notEqual(scene.pulseEnemy,pulse,'restart creates a fresh enemy');
for(let index=0;index<2;index++) {
  scene.create({mode:'duo'});
  let reason;
  const finish=scene.finish;
  scene.finish=function(value){reason=value;finish.call(this,value);};
  const hit=overlaps.find(o=>o.a===scene.players[index]&&o.b===scene.pulseEnemy).fn;
  scene.togglePause();hit();assert.equal(scene.finished,false,'paused collision ignored');
  scene.togglePause();hit();assert.equal(scene.finished,true);
  assert.equal(reason,`The pulse enemy caught Player ${index+1}!`);
  scene.finish=finish;
}
scene.create({mode:'solo'});
let soloReason;scene.finish=reason=>{soloReason=reason;};
overlaps.find(o=>o.a===scene.player&&o.b===scene.pulseEnemy).fn();
assert.equal(soloReason,'The pulse enemy caught you!');
console.log('Pulse enemy tests passed: centered visual/collision min/max radii, pause, finish, restart, safe spawn, solo/duo collisions.');
