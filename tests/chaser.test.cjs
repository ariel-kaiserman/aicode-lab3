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
const c=ctx.COIN_DASH;
const magnitude=()=>Math.hypot(scene.chaser.body.velocity.x,scene.chaser.body.velocity.y);
for(const mode of ['solo','duo']) {
  for(let level=1;level<=5;level++) {
    scene.create({mode,level});
    assert.equal(scene.players.length,mode==='duo'?2:1);
    assert.ok(scene.chaser.x>=12 && scene.chaser.x<=c.width-12);
    assert.ok(scene.chaser.y>=76 && scene.chaser.y<=c.height-12);
    for(const player of scene.players)
      assert.ok(Math.hypot(player.x-scene.chaser.x,player.y-scene.chaser.y)>=100,'safe initial separation');
    scene.update();
    assert.ok(scene.chaser.body.velocity.x<0 && scene.chaser.body.velocity.y<0,'initial pursuit approaches player');
    assert.ok(Math.abs(magnitude()-(c.chaser.baseSpeed+(level-1)*c.chaser.speedPerLevel))<1e-8);
    assert.ok(magnitude()<=c.chaser.maxSpeed+1e-8 && magnitude()<c.playerSpeed,'slow capped pursuit');
  }
}
scene.create({mode:'duo',level:5});
scene.chaser.setPosition(400,300);
scene.player.setPosition(100,300);scene.player2.setPosition(500,300);
scene.updateChaser();assert.equal(scene.chaser.body.velocity.x,scene.chaserSpeed);
assert.equal(scene.chaser.body.velocity.y,0,'nearest second player is pursued');
scene.player.setPosition(350,300);scene.player2.setPosition(700,300);
scene.updateChaser();assert.equal(scene.chaser.body.velocity.x,-scene.chaserSpeed,'target changes when first player becomes nearer');
scene.player.setPosition(400,300);scene.updateChaser();
assert.equal(magnitude(),0,'already at target avoids invalid velocity');
scene.player.setPosition(350,250);scene.updateChaser();
assert.ok(Math.abs(magnitude()-scene.chaserSpeed)<1e-8,'diagonal velocity is normalized');
const oldCap=c.chaser.maxSpeed;c.chaser.maxSpeed=60;
scene.create({mode:'solo',level:5});scene.updateChaser();assert.ok(Math.abs(magnitude()-60)<1e-8);
c.chaser.maxSpeed=oldCap;
scene.create({mode:'duo',level:3});scene.update();
const collision=overlaps.filter(o=>o.a===scene.player2&&o.b===scene.chaser).pop().fn;
scene.togglePause();const pausedVelocity={...scene.chaser.body.velocity};
scene.player2.setPosition(100,100);scene.time.now+=5000;scene.update();scene.updateChaser();collision();
assert.deepEqual(scene.chaser.body.velocity,pausedVelocity,'pause does not update pursuit');
assert.equal(scene.finished,false,'paused overlap cannot end round');
assert.equal(scene.physics.paused,true);
scene.togglePause();scene.updateChaser();
assert.equal(scene.physics.paused,false);
const texts=[];const addText=scene.add.text;
scene.add.text=(...args)=>{texts.push(args[2]);return addText(...args);};
collision();assert.equal(scene.finished,true);assert.equal(scene.physics.paused,true);
assert.match(texts.at(-1),/purple chaser caught Player 2/);
const finalVelocity={...scene.chaser.body.velocity};scene.update();scene.updateChaser();
assert.deepEqual(scene.chaser.body.velocity,finalVelocity,'finished round does not update pursuit');
const oldChaser=scene.chaser;
scene.create({mode:'solo',level:1});assert.notEqual(scene.chaser,oldChaser);
assert.equal(scene.finished,false);assert.equal(scene.paused,false);
assert.equal(scene.chaser.x,c.width-50);assert.equal(scene.chaser.y,c.height-50);
const soloCollision=overlaps.filter(o=>o.a===scene.player&&o.b===scene.chaser).pop().fn;
soloCollision();assert.match(texts.at(-1),/purple chaser caught you/);
console.log('Chaser tests passed: solo/duo all levels, safe spawn, normalized capped pursuit, nearest target switching, collision, pause, finish, restart.');
