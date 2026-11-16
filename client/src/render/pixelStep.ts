// The world distance of one DEVICE pixel (1 / (zoom * devicePixelRatio)). Moving sprites snap to it, not to whole
// world pixels, so a steady walk looks steady at any zoom. Set by the camera on every redraw; 1 = whole world pixels.
export const pixelStep = { v: 1 };
