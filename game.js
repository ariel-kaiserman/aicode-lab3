/* global Phaser, COIN_DASH */
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.finished = false;
    this.boostUntil = 0;
    this.powerUpRespawnAt = 0;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.speedPowerUp = this.add.rectangle(0, 0, 24, 24, c.colors.speedPowerUp);
    this.physics.add.existing(this.speedPowerUp);
    this.speedPowerUp.body.setAllowGravity(false).setImmovable(true);
    this.speedPowerUpLabel = this.add.text(0, 0, '>>', {
      font: 'bold 16px monospace', color: '#071521'
    }).setOrigin(0.5);
    this.boostHud = this.add.text(c.width - 18, 12, '', {
      font: '18px monospace', color: '#5ac8ff'
    }).setOrigin(1, 0);
    this.placeSpeedPowerUp();
    this.physics.add.overlap(this.player, this.speedPowerUp, () => this.collectSpeedPowerUp());
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => this.finish('A drone caught you!'));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath the player.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  placeSpeedPowerUp() {
    const c = COIN_DASH;
    let x, y;
    do {
      x = Phaser.Math.Between(30, c.width - 30);
      y = Phaser.Math.Between(75, c.height - 30);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 80
      || Phaser.Math.Distance.Between(x, y, this.coin.x, this.coin.y) < 40);
    this.speedPowerUp.setPosition(x, y).setVisible(true);
    this.speedPowerUp.body.reset(x, y);
    this.speedPowerUp.body.enable = true;
    this.speedPowerUpLabel.setPosition(x, y).setVisible(true);
  }

  collectSpeedPowerUp() {
    if (this.finished || !this.speedPowerUp.body.enable) return;
    const c = COIN_DASH;
    this.boostUntil = this.time.now + c.speedBoostSeconds * 1000;
    this.powerUpRespawnAt = this.time.now + c.speedPowerUpRespawnSeconds * 1000;
    this.speedPowerUp.body.enable = false;
    this.speedPowerUp.setVisible(false);
    this.speedPowerUpLabel.setVisible(false);
  }

  update() {
    if (this.finished) return;
    const boostSeconds = Math.max(0, Math.ceil((this.boostUntil - this.time.now) / 1000));
    if (!this.speedPowerUp.body.enable && this.time.now >= this.powerUpRespawnAt) {
      this.placeSpeedPowerUp();
    }
    this.boostHud.setText(boostSeconds > 0 ? `Speed x${COIN_DASH.speedBoostMultiplier}: ${boostSeconds}s` : '');
    this.player.setFillStyle(boostSeconds > 0 ? COIN_DASH.colors.speedPowerUp : COIN_DASH.colors.player);
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const speed = COIN_DASH.playerSpeed * (boostSeconds > 0 ? COIN_DASH.speedBoostMultiplier : 1);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(speed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(`Coins: ${this.score}                       Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    this.boostUntil = 0;
    this.boostHud.setText('');
    this.player.setFillStyle(COIN_DASH.colors.player);
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\nPress R to try again`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
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
