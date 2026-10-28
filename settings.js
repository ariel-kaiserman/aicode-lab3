// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  speedBoostMultiplier: 1.5,
  speedBoostSeconds: 5,
  speedPowerUpRespawnSeconds: 8,
  droneSpeed: 105,
  droneCount: 3,
  levels: [
    { droneCount: 2, droneSpeed: 80 },
    { droneCount: 3, droneSpeed: 105 },
    { droneCount: 4, droneSpeed: 130 },
    { droneCount: 5, droneSpeed: 155 },
    { droneCount: 6, droneSpeed: 180 }
  ],
  chaser: { color: 0xb875ff, baseSpeed: 55, speedPerLevel: 5, maxSpeed: 75 },
  pulseEnemy: { minRadius: 12, maxRadius: 34, cycleSeconds: 3, color: 0xff8c42 },
  sound: { enabled: true, volume: 0.2 },
  colors: { background: 0x101c31, player: 0x71e8ce, player2: 0xffa94d, coin: 0xffd166, speedPowerUp: 0x5ac8ff, drone: 0xff657a }
};
