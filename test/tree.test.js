// node --test test/  (DOM 없이 생성 결과를 확인한다)
import test from 'node:test';
import assert from 'node:assert/strict';
import { ChristmasTree, PRESETS, QUALITY, buildTree, createUniforms, buildExportScene, ORNAMENT_SHAPES } from '../src/index.js';

test('같은 씨앗값이면 같은 나무', () => {
  const a = buildTree({ seed: 7, whorls: 16 }, createUniforms());
  const b = buildTree({ seed: 7, whorls: 16 }, createUniforms());
  const c = buildTree({ seed: 8, whorls: 16 }, createUniforms());
  assert.deepEqual(a.stats, b.stats);
  assert.deepEqual(a.barkMesh.geometry.attributes.position.array.slice(0, 300), b.barkMesh.geometry.attributes.position.array.slice(0, 300));
  assert.notDeepEqual(a.barkMesh.geometry.attributes.position.array.slice(-300), c.barkMesh.geometry.attributes.position.array.slice(-300));
});

test('프리셋마다 만들어지고 품질이 낮을수록 잎이 적다', () => {
  for (const preset of Object.keys(PRESETS)) {
    const low = new ChristmasTree({ preset, quality: 'low' });
    const high = new ChristmasTree({ preset, quality: 'high' });
    assert.ok(low.stats.needles > 1000, preset);
    assert.ok(low.stats.needles < high.stats.needles, preset);
    low.dispose();
    high.dispose();
  }
  assert.deepEqual(Object.keys(QUALITY), ['ultra', 'high', 'medium', 'low']);
});

test('size 는 월드 높이(m)', () => {
  const t = new ChristmasTree({ size: 3, quality: 'low' });
  assert.equal(t.footprint.height, 3);
  assert.ok(Math.abs(t.root.scale.y - 3 / 20) < 1e-9);
  t.set({ size: 6 });
  assert.ok(Math.abs(t.root.scale.y - 6 / 20) < 1e-9);
  assert.ok(t.footprint.crownRadius > 0.5 && t.footprint.crownRadius < 3);
});

test('위로 올려 쓴 옵션을 tree·decor 로 나눈다', () => {
  const t = new ChristmasTree({ seed: 42, spread: 6, palette: 'candy', lights: 10, quality: 'low' });
  assert.equal(t.resolved.tree.seed, 42);
  assert.equal(t.resolved.tree.spread, 6);
  assert.equal(t.resolved.decor.palette, 'candy');
  assert.equal(t.resolved.decor.lights, 10); // 직접 준 값은 품질로 줄이지 않는다
});

test('오너먼트 달기·떼기와 JSON 왕복', () => {
  const t = new ChristmasTree({ preset: 'cozy', quality: 'low' });
  const events = [];
  t.addEventListener('ornamentadd', (e) => events.push(e.ornament.id));
  for (const [i, shape] of ORNAMENT_SHAPES.entries()) t.addOrnament({ id: `k${i}`, shape, color: '#ff0000', h: 0.2 + i * 0.1, a: i, data: { wish: `소원 ${i}` } });
  assert.equal(t.ornaments.count, ORNAMENT_SHAPES.length);
  assert.equal(events.length, ORNAMENT_SHAPES.length);
  assert.ok(t.removeOrnament('k2'));
  assert.equal(t.ornaments.count, ORNAMENT_SHAPES.length - 1);
  const json = t.toJSON();
  assert.equal(json.format, 'xmas-tree-kit');
  const back = ChristmasTree.fromJSON(JSON.stringify(json));
  assert.deepEqual(back.toJSON(), json);
  assert.equal(back.ornaments.get('k1').data.wish, '소원 1');
});

test('형태를 바꿔도 단 오너먼트는 바깥면에 남는다', () => {
  const t = new ChristmasTree({ quality: 'low' });
  const o = t.addOrnament({ shape: 'ball', color: '#fff', h: 0.5, a: 1 }, { animate: false });
  const p1 = t.ornamentPosition(o).clone();
  t.set({ tree: { spread: 9 } });
  const p2 = t.ornamentPosition(o);
  assert.equal(t.ornaments.count, 1);
  assert.ok(Math.hypot(p2.x, p2.z) > Math.hypot(p1.x, p1.z)); // 가지가 넓어진 만큼 바깥으로
  assert.ok(Math.abs(p1.y - p2.y) < 1e-6);
});

test('GLB 장면: 구우면 인스턴스가 없고, 굽지 않으면 남는다', () => {
  const t = new ChristmasTree({ quality: 'low', size: 2 });
  const baked = buildExportScene(t, { bake: true });
  const inst = buildExportScene(t, { bake: false });
  let bakedInst = 0;
  let instInst = 0;
  baked.traverse((o) => o.isInstancedMesh && bakedInst++);
  inst.traverse((o) => o.isInstancedMesh && instInst++);
  assert.equal(bakedInst, 0);
  assert.ok(instInst > 3);
  // 내보낸 크기가 size 와 맞는다 (별 꼭대기까지 조금 더)
  let maxY = 0;
  baked.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    maxY = Math.max(maxY, o.geometry.boundingBox.max.y);
  });
  assert.ok(maxY > 2 && maxY < 2.4, String(maxY));
});
