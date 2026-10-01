// Tiny pixel-art icons drawn as crisp SVG rects, so they theme with CSS.
// '#' outline · 'o' fill · 's' shade · '.' empty
const ICONS = {
  hand: [
    '.......##.......',
    '......#oo###....',
    '....###oo#oo#...',
    '...#oo#oo#oo###.',
    '...#oo#oo#oo#oo#',
    '...#oo#oo#oo#oo#',
    '##.#oo#oo#oo#oo#',
    '#o##oo#oo#oo#os#',
    '#oo#oooooooooos#',
    '.#ooooooooooos#.',
    '.#ooooooooooos#.',
    '..#oooooooooos#.',
    '...#ooooooooo#..',
    '....#ooooooo#...',
    '.....#######....',
  ],
  sun: [
    '....o....',
    '.o.....o.',
    '...ooo...',
    '..ooooo..',
    'o.ooooo.o',
    '..ooooo..',
    '...ooo...',
    '.o.....o.',
    '....o....',
  ],
  moon: [
    '..oooo...',
    '.ooo.....',
    'ooo......',
    'ooo......',
    'ooo......',
    'ooo....o.',
    'oooo..oo.',
    '.ooooooo.',
    '..ooooo..',
  ],
};

const CLASS = { '#': 'px-outline', o: 'px-fill', s: 'px-shade' };

function svgFor(name) {
  const rows = ICONS[name];
  const w = rows[0].length;
  const h = rows.length;
  let rects = '';
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (CLASS[ch]) rects += `<rect class="${CLASS[ch]}" x="${x}" y="${y}" width="1.02" height="1.02"/>`;
    });
  });
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
}

export function renderPixelIcons(root = document) {
  root.querySelectorAll('[data-pixel]').forEach((el) => {
    el.innerHTML = svgFor(el.dataset.pixel);
  });
}
