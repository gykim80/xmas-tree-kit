// node --test test/  (checks generated output without a DOM)
import test from 'node:test';
import assert from 'node:assert/strict';
import { ChristmasTree, PRESETS, QUALITY, buildTree, createUniforms, buildExportScene, ORNAMENT_SHAPES } from '../src/index.js';

test('same seed gives the same tree', () => {
  const a = buildTree({ seed: 7, whorls: 16 }, createUniforms());
  const b = buildTree({ seed: 7, whorls: 16 }, createUniforms());
  const c = buildTree({ seed: 8, whorls: 16 }, createUniforms());
  assert.deepEqual(a.stats, b.stats);
  assert.deepEqual(a.barkMesh.geometry.attributes.position.array.slice(0, 300), b.barkMesh.geometry.attributes.position.array.slice(0, 300));
  assert.notDeepEqual(a.barkMesh.geometry.attributes.position.array.slice(-300), c.barkMesh.geometry.attributes.position.array.slice(-300));
});

test('every preset builds and lower quality means fewer needles', () => {
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

test('size is the world height (m)', () => {
  const t = new ChristmasTree({ size: 3, quality: 'low' });
  assert.equal(t.footprint.height, 3);
  assert.ok(Math.abs(t.root.scale.y - 3 / 20) < 1e-9);
  t.set({ size: 6 });
  assert.ok(Math.abs(t.root.scale.y - 6 / 20) < 1e-9);
  assert.ok(t.footprint.crownRadius > 0.5 && t.footprint.crownRadius < 3);
});

test('top-level options are split into tree and decor', () => {
  const t = new ChristmasTree({ seed: 42, spread: 6, palette: 'candy', lights: 10, quality: 'low' });
  assert.equal(t.resolved.tree.seed, 42);
  assert.equal(t.resolved.tree.spread, 6);
  assert.equal(t.resolved.decor.palette, 'candy');
  assert.equal(t.resolved.decor.lights, 10); // explicit values are not reduced by quality
});

test('hanging and removing ornaments, JSON round trip', () => {
  const t = new ChristmasTree({ preset: 'cozy', quality: 'low' });
  const events = [];
  t.addEventListener('ornamentadd', (e) => events.push(e.ornament.id));
  for (const [i, shape] of ORNAMENT_SHAPES.entries()) t.addOrnament({ id: `k${i}`, shape, color: '#ff0000', h: 0.2 + i * 0.1, a: i, data: { wish: `wish ${i}` } });
  assert.equal(t.ornaments.count, ORNAMENT_SHAPES.length);
  assert.equal(events.length, ORNAMENT_SHAPES.length);
  assert.ok(t.removeOrnament('k2'));
  assert.equal(t.ornaments.count, ORNAMENT_SHAPES.length - 1);
  const json = t.toJSON();
  assert.equal(json.format, 'xmas-tree-kit');
  const back = ChristmasTree.fromJSON(JSON.stringify(json));
  assert.deepEqual(back.toJSON(), json);
  assert.equal(back.ornaments.get('k1').data.wish, 'wish 1');
});

test('hung ornaments stay on the outer surface when the shape changes', () => {
  const t = new ChristmasTree({ quality: 'low' });
  const o = t.addOrnament({ shape: 'ball', color: '#fff', h: 0.5, a: 1 }, { animate: false });
  const p1 = t.ornamentPosition(o).clone();
  t.set({ tree: { spread: 9 } });
  const p2 = t.ornamentPosition(o);
  assert.equal(t.ornaments.count, 1);
  assert.ok(Math.hypot(p2.x, p2.z) > Math.hypot(p1.x, p1.z)); // moved outward as the branches widen
  assert.ok(Math.abs(p1.y - p2.y) < 1e-6);
});

test('GLB scene: baking removes instances, not baking keeps them', () => {
  const t = new ChristmasTree({ quality: 'low', size: 2 });
  const baked = buildExportScene(t, { bake: true });
  const inst = buildExportScene(t, { bake: false });
  let bakedInst = 0;
  let instInst = 0;
  baked.traverse((o) => o.isInstancedMesh && bakedInst++);
  inst.traverse((o) => o.isInstancedMesh && instInst++);
  assert.equal(bakedInst, 0);
  assert.ok(instInst > 3);
  // exported height matches size (slightly more up to the star tip)
  let maxY = 0;
  baked.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    maxY = Math.max(maxY, o.geometry.boundingBox.max.y);
  });
  assert.ok(maxY > 2 && maxY < 2.4, String(maxY));
});
