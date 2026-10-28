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
    setRadius() { return this; }, setFillStyle(value) { this.fill = value; return this; }
  };
  obj.body = { enable: true, setCollideWorldBounds() { return this; },
    updateFromGameObject() {}, setCircle() { return this; }, setAllowGravity() { return this; },
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
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'settings.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'game.js'),'utf8')+'\nthis.TestScene=CoinDash;',ctx);
const scene=new ctx.TestScene();scene.create();
const c=ctx.COIN_DASH;
assert.ok(Math.hypot(scene.speedPowerUp.x-scene.player.x,scene.speedPowerUp.y-scene.player.y)>=80);
assert.equal(scene.boostUntil,0);
scene.keys.D.isDown=true;scene.update();
assert.equal(scene.player.body.velocity.x,c.playerSpeed);
const collect=overlaps.find(o=>o.b===scene.speedPowerUp).fn;
collect();
assert.equal(scene.speedPowerUp.body.enable,false);
assert.equal(scene.speedPowerUp.visible,false);
assert.equal(scene.speedPowerUpLabel.visible,false);
scene.update();
assert.equal(scene.player.body.velocity.x,c.playerSpeed*c.speedBoostMultiplier);
assert.match(scene.boostHud.text,/5s/);
scene.keys.W.isDown=true;scene.update();
assert.ok(Math.abs(Math.hypot(...Object.values(scene.player.body.velocity))-c.playerSpeed*c.speedBoostMultiplier)<1e-8);
const priorBoost=scene.boostUntil, priorRespawn=scene.powerUpRespawnAt, priorDeadline=scene.deadline;
scene.togglePause();
scene.time.now+=10000;scene.update();
assert.equal(scene.boostUntil,priorBoost,'paused update leaves boost unchanged');
assert.equal(scene.speedPowerUp.body.enable,false,'paused update cannot respawn pickup');
scene.togglePause();
assert.equal(scene.boostUntil,priorBoost+10000,'pause freezes boost duration');
assert.equal(scene.powerUpRespawnAt,priorRespawn+10000,'pause freezes pickup cooldown');
assert.equal(scene.deadline,priorDeadline+10000,'pause freezes round timer');
assert.equal(scene.physics.paused,false);
scene.update();assert.match(scene.boostHud.text,/5s/);
const boostEnd=scene.boostUntil;
scene.time.now+=100;collect();assert.equal(scene.boostUntil,boostEnd,'disabled pickup cannot stack');
scene.time.now=boostEnd;scene.update();
assert.ok(Math.abs(Math.hypot(...Object.values(scene.player.body.velocity))-c.playerSpeed)<1e-8);
assert.equal(scene.boostHud.text,'');
assert.equal(scene.speedPowerUp.body.enable,false);
scene.time.now=scene.powerUpRespawnAt;scene.update();
assert.equal(scene.speedPowerUp.body.enable,true);
assert.equal(scene.speedPowerUp.visible,true);
collect();scene.finish('Done');
assert.equal(scene.boostUntil,0);assert.equal(scene.boostHud.text,'');
const lastPosition={...scene.player.body.velocity};scene.time.now+=10000;scene.update();
assert.deepEqual(scene.player.body.velocity,lastPosition,'finished game does not update movement');
collect();assert.equal(scene.boostUntil,0,'finished game ignores pickups');
scene.create();assert.equal(scene.boostUntil,0);assert.equal(scene.powerUpRespawnAt,0);
assert.equal(scene.speedPowerUp.body.enable,true);assert.equal(scene.finished,false);
console.log('Speed pickup tests passed: collection, duration, normalized movement, respawn, finish, restart');
