// 프리셋: 트리 형태(tree)·장식(decor)·셰이더 값의 묶음. 사용자가 준 값이 그 위에 덮인다
const NO_DECOR = { ornaments: 0, lights: 0, garland: false, beads: false, presents: 0, base: 'none', topper: 'none', glowLights: false };

export const PRESETS = {
  // 광장 트리: 금빛 갈런드, 빨강·금 오너먼트, 돌 화단과 선물
  classic: { tree: {}, decor: {}, snow: 0.5 },
  // 거실 트리: 트리 치마, 선물 많이, 눈 없음
  cozy: {
    tree: { seed: 77, spread: 7.4, droop: 0.3 },
    decor: { palette: 'red-gold', base: 'skirt', presents: 30 },
    snow: 0,
  },
  // 북유럽풍: 가늘고 은빛·파랑, 차가운 흰 전구
  nordic: {
    tree: { seed: 314, spread: 5.4, whorls: 60, droop: 0.42, upturn: 0.4 },
    decor: { palette: 'silver-blue', lightColor: 'cool', garland: false, beadColors: ['#e7ecf2', '#9fb4d6'], presents: 12, base: 'skirt', skirtColor: '#e9edf2', topperColor: '#e8f0ff' },
    snow: 0.8,
  },
  // 알록달록: 여러 모양 오너먼트와 색색 전구
  rainbow: {
    tree: { seed: 2024 },
    decor: { palette: 'rainbow', lightColor: 'multi', ornamentShapes: { ball: 0.5, drop: 0.15, star: 0.15, bell: 0.1, heart: 0.1 }, garland: false },
    snow: 0.3,
  },
  // 사탕: 분홍·흰색, 하트와 별
  candy: {
    tree: { seed: 1414, spread: 6.4 },
    decor: { palette: 'candy', lightColor: 'red-green', ornamentShapes: { ball: 0.5, heart: 0.25, star: 0.25 }, garlandColor: '#ff9ec7', topperColor: '#ffd1e6', base: 'skirt', skirtColor: '#f4f4f4' },
    snow: 0.2,
  },
  // 눈 덮인 전나무: 장식 없이 전구만 조금
  snowy: {
    tree: { seed: 909 },
    decor: { ...NO_DECOR, lights: 600 },
    snow: 1,
  },
  // 장식 없는 전나무 (숲·배경용)
  bare: { tree: { seed: 5 }, decor: { ...NO_DECOR }, snow: 0.3 },
};

// 품질: 형태는 같게 두고 가지 층·잎·전구 수를 줄인다. 잎이 성겨지는 만큼 잎 크기를 키운다
export const QUALITY = {
  ultra: { whorls: 1, branchesPerWhorl: 1, twigs: 1, needles: 1, needleSize: 1, lights: 1, ornaments: 1 },
  high: { whorls: 0.72, branchesPerWhorl: 0.85, twigs: 0.9, needles: 0.85, needleSize: 1.12, lights: 0.8, ornaments: 0.9 },
  medium: { whorls: 0.52, branchesPerWhorl: 0.75, twigs: 0.75, needles: 0.75, needleSize: 1.3, lights: 0.55, ornaments: 0.7 },
  low: { whorls: 0.42, branchesPerWhorl: 0.62, twigs: 0.6, needles: 0.65, needleSize: 1.75, lights: 0.32, ornaments: 0.5 },
};
