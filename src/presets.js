// Presets: bundles of tree shape (tree), decorations (decor) and shader values. User options override them
const NO_DECOR = { ornaments: 0, lights: 0, garland: false, beads: false, presents: 0, base: 'none', topper: 'none', glowLights: false };

export const PRESETS = {
  // Plaza tree: gold garland, red and gold ornaments, stone bed and presents
  classic: { tree: {}, decor: {}, snow: 0.5 },
  // Living room tree: tree skirt, lots of presents, no snow
  cozy: {
    tree: { seed: 77, spread: 7.4, droop: 0.3 },
    decor: { palette: 'red-gold', base: 'skirt', presents: 30 },
    snow: 0,
  },
  // Nordic: slim, silver and blue, cool white lights
  nordic: {
    tree: { seed: 314, spread: 5.4, whorls: 60, droop: 0.42, upturn: 0.4 },
    decor: { palette: 'silver-blue', lightColor: 'cool', garland: false, beadColors: ['#e7ecf2', '#9fb4d6'], presents: 12, base: 'skirt', skirtColor: '#e9edf2', topperColor: '#e8f0ff' },
    snow: 0.8,
  },
  // Colorful: mixed ornament shapes and multicolor lights
  rainbow: {
    tree: { seed: 2024 },
    decor: { palette: 'rainbow', lightColor: 'multi', ornamentShapes: { ball: 0.5, drop: 0.15, star: 0.15, bell: 0.1, heart: 0.1 }, garland: false },
    snow: 0.3,
  },
  // Candy: pink and white, hearts and stars
  candy: {
    tree: { seed: 1414, spread: 6.4 },
    decor: { palette: 'candy', lightColor: 'red-green', ornamentShapes: { ball: 0.5, heart: 0.25, star: 0.25 }, garlandColor: '#ff9ec7', topperColor: '#ffd1e6', base: 'skirt', skirtColor: '#f4f4f4' },
    snow: 0.2,
  },
  // Snowy fir: no ornaments, just a few lights
  snowy: {
    tree: { seed: 909 },
    decor: { ...NO_DECOR, lights: 600 },
    snow: 1,
  },
  // Bare fir (for forests and backgrounds)
  bare: { tree: { seed: 5 }, decor: { ...NO_DECOR }, snow: 0.3 },
};

// Quality: keep the shape, reduce whorls, needles and lights. Needles grow larger to make up for the sparser foliage
export const QUALITY = {
  ultra: { whorls: 1, branchesPerWhorl: 1, twigs: 1, needles: 1, needleSize: 1, lights: 1, ornaments: 1 },
  high: { whorls: 0.72, branchesPerWhorl: 0.85, twigs: 0.9, needles: 0.85, needleSize: 1.12, lights: 0.8, ornaments: 0.9 },
  medium: { whorls: 0.52, branchesPerWhorl: 0.75, twigs: 0.75, needles: 0.75, needleSize: 1.3, lights: 0.55, ornaments: 0.7 },
  low: { whorls: 0.42, branchesPerWhorl: 0.62, twigs: 0.6, needles: 0.65, needleSize: 1.75, lights: 0.32, ornaments: 0.5 },
};
