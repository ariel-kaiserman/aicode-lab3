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
  sound: { enabled: true, volume: 0.2 },
  // Pastel "paper" look: cream page, notebook grid, pastel stickers outlined in dark ink.
  colors: { background: 0xfbf6ea, player: 0x9ee6c9, player2: 0xffc08a, coin: 0xffd86b, speedPowerUp: 0xa8d8ff, drone: 0xff9eae,
    grid: 0xc9dbee, margin: 0xf3a9b9, ink: 0x3b3646, boostText: 0x2c64a8, paper: 0xfffdf7, shadow: 0x3b3646 },
  fontFamily: 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Trebuchet MS", "Segoe UI", system-ui, sans-serif'
};
