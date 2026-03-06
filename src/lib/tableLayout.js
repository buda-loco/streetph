// Shared layout math — maps PSD coordinates to screen coordinates.
// Used by both the WebGL shader and the coffee cup overlay so they stay in sync.

export const PSD_W = 2816
export const PSD_H = 1536
export const NAV_H = 58  // matches --nav-h in CSS

// Pixel coordinates of each layer inside the PSD canvas
export const PSD_LAYERS = {
  cup:    { x: 714,  y: 775, w: 1979, h: 657 },
  coffee: { x: 2160, y: 930, w: 360,  h: 360 },
}

// Where the coffee center sits within the cup image (fractions 0-1)
// Derived from PSD: coffee center at (2340,1110), cup origin at (714,775)
export const COFFEE_IN_CUP = {
  x: (PSD_LAYERS.coffee.x + PSD_LAYERS.coffee.w / 2 - PSD_LAYERS.cup.x) / PSD_LAYERS.cup.w,
  y: (PSD_LAYERS.coffee.y + PSD_LAYERS.coffee.h / 2 - PSD_LAYERS.cup.y) / PSD_LAYERS.cup.h,
}

// Desired coffee-center position as a fraction of the table viewport.
// Controls how much of the cup is visible at the bottom-right corner.
// Matches the layout sketch: top-left quadrant of the cup visible.
export const CUP_TARGET = { x: 0.91, y: 0.91 }

/**
 * Returns the CSS pixel position/size of each layer on the current viewport.
 * Uses "cover" scaling — same as the WebGL shader — so elements stay
 * pixel-aligned with the wood texture at any resolution.
 */
export function computeTableLayout(vpW = window.innerWidth, vpH = window.innerHeight) {
  const tableH = vpH - NAV_H
  const psdAR  = PSD_W / PSD_H
  const tblAR  = vpW / tableH

  let scale, ox, oy
  if (tblAR > psdAR) {
    // Viewport wider than PSD → scale by height, crop sides
    scale = tableH / PSD_H
    ox    = (vpW - PSD_W * scale) / 2
    oy    = 0
  } else {
    // Viewport taller than PSD → scale by width, crop top/bottom
    scale = vpW / PSD_W
    ox    = 0
    oy    = (tableH - PSD_H * scale) / 2
  }

  const place = ({ x, y, w, h }) => ({
    left:   Math.round(x * scale + ox),
    top:    Math.round(y * scale + oy),
    width:  Math.round(w * scale),
    height: Math.round(h * scale),
  })

  return {
    cup:    place(PSD_LAYERS.cup),
    coffee: place(PSD_LAYERS.coffee),
    scale,
    tableW: vpW,
    tableH,
  }
}

