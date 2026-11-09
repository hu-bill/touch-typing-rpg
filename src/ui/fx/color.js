// Tiny colour helpers shared by the canvas FX modules.
const cache = new Map();

/** '#rrggbb' + alpha → 'rgba(r,g,b,a)'. */
export function rgba(hex, a) {
  let c = cache.get(hex);
  if (!c) {
    const v = parseInt(hex.slice(1), 16);
    c = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    cache.set(hex, c);
  }
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}
