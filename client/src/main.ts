import { Application, TextureSource } from 'pixi.js';
import { PALETTE } from '@pixel-hotel/shared';

// Pixel-perfect: no texture smoothing anywhere.
TextureSource.defaultOptions.scaleMode = 'nearest';

async function start(): Promise<void> {
  const host = document.getElementById('game');
  if (!host) throw new Error('#game element missing');

  const app = new Application();
  await app.init({
    resizeTo: window,
    background: PALETTE[25],
    antialias: false,
    roundPixels: true,
    resolution: 1,
  });
  host.appendChild(app.canvas);
}

void start();
