# xmas-tree-kit

전나무를 씨앗값 하나로 키우고, 오너먼트·전구·갈런드·선물로 꾸미는 three.js 라이브러리입니다. 만든 트리는 세 가지로 씁니다.

- three.js 장면이나 게임에 `scene.add(tree)` 로 넣는다
- 웹페이지에 `<xmas-tree>` 태그 하나로 띄운다
- GLB 파일로 내려받아 Unity·Godot·Unreal·Blender 에서 쓴다

[크리스마스 타운](https://town.honeycake.io) 광장의 20m 트리를 만든 코드에서 나무와 장식 부분을 떼어 냈습니다.

데모: [에디터](https://gykim80.github.io/xmas-tree-kit/editor/) · [웹페이지 예제](https://gykim80.github.io/xmas-tree-kit/examples/embed.html) · [게임 예제](https://gykim80.github.io/xmas-tree-kit/examples/game.html)

![에디터](docs/editor.png)

## 설치

npm 레지스트리에 올리지 않고 git 저장소에서 바로 받습니다. `dist/` 를 저장소에 함께 올려 두어 받은 뒤 따로 빌드할 필요가 없습니다.

```bash
npm install three github:gykim80/xmas-tree-kit
# 버전 고정
npm install three github:gykim80/xmas-tree-kit#v0.1.0
```

three 는 쓰는 쪽에 있는 것을 씁니다(0.160 이상).

## 빠르게 시작

### 1. three.js 장면에 넣기

```js
import { ChristmasTree } from 'xmas-tree-kit';

const tree = new ChristmasTree({ preset: 'cozy', size: 2.4 }); // size 는 미터
scene.add(tree);
```

매 프레임 부를 함수는 없습니다. 전구 깜박임, 카메라를 향하는 별, 거리에 따른 잎 수 조절은 트리가 그려질 때 스스로 돕니다. 금속 오너먼트가 제대로 보이려면 장면에 환경맵(`scene.environment`)이 있어야 합니다. 예제는 `RoomEnvironment` 를 씁니다.

### 2. 웹페이지에 넣기

빌드 도구 없이 스크립트 한 줄이면 됩니다. 이 파일에는 three 까지 들어 있습니다.

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/gykim80/xmas-tree-kit@v0.1.0/dist/xmas-tree.standalone.js"></script>

<xmas-tree preset="classic" camera-controls auto-rotate snowfall style="height:480px"></xmas-tree>
```

번들러를 쓰는 프로젝트라면 이렇게 씁니다.

```js
import 'xmas-tree-kit/element'; // <xmas-tree> 가 등록된다
```

### 3. 게임 엔진으로 내보내기

```js
import { ChristmasTree, exportGLB } from 'xmas-tree-kit';

const tree = new ChristmasTree({ preset: 'classic', quality: 'low', size: 3 });
const glb = await exportGLB(tree); // ArrayBuffer
```

에디터의 `GLB (게임용)` 버튼도 같은 일을 합니다.

## 에디터

```bash
npm install
npm run dev     # http://localhost:5320/editor/
```

- 오른쪽 조절판에서 프리셋, 품질, 높이, 나무 형태, 장식, 쌓인 눈을 바꾼다
- 아래 막대에서 `달기` 를 고르고 트리를 누르면 고른 모양과 색으로 오너먼트가 달린다. `떼기` 로 누르면 떨어진다
- `JSON 저장` · `불러오기` 로 트리를 파일로 주고받는다
- `링크 복사` 는 트리를 주소 뒤(`#t=…`)에 담는다. 그 주소를 열면 같은 트리가 나온다
- `넣기 코드 복사` 는 지금 트리를 띄우는 HTML 을 복사한다
- `GLB (게임용)` 은 낮은 품질로 다시 키워 가볍게 내보낸다. `GLB (원본)` 은 화면 그대로 내보낸다

## 옵션

```js
new ChristmasTree({
  preset: 'classic',   // classic · cozy · nordic · rainbow · candy · snowy · bare
  size: 2.4,           // 최종 높이 (m)
  quality: 'high',     // ultra · high · medium · low
  seed: 1225,          // 씨앗값. 같으면 언제나 같은 나무

  tree: { spread: 7, droop: 0.36, ... },     // 나무 형태 (아래 표)
  decor: { palette: 'red-gold', ... },       // 장식 (아래 표)

  snow: 0.5,           // 가지 위에 쌓인 눈 0~1
  glow: 3,             // 전구 밝기
  twinkle: 2.2,        // 깜박임 빠르기 (0 이면 깜박이지 않음)
  shadows: true,       // 그림자 드리우기
  lod: true,           // 멀어지면 잎 수 줄이기
  prepass: false,      // 잎 깊이 선행 패스 (모바일 GPU 에서 잎 그리기가 빨라진다)
  ornaments: [],       // 단 오너먼트 (toJSON 결과의 ornaments)
});
```

`seed`, `spread`, `palette`, `lights` 처럼 `tree`·`decor` 안에 들어갈 값은 위로 올려 써도 알아서 나눕니다. 직접 준 값은 품질 설정이 줄이지 않습니다.

### 나무 형태 (`tree`)

| 이름 | 기본값 | 뜻 |
| --- | --- | --- |
| `seed` | 1225 | 씨앗값 |
| `spread` | 7.0 | 맨 아래 가지 길이 (설계 높이 20 기준) |
| `whorls` | 56 | 가지 층 수 |
| `branchesPerWhorl` | 10 | 층마다 가지 수 |
| `droop` | 0.36 | 가지 처짐 |
| `upturn` | 0.55 | 가지 끝 들림 |
| `twigs` | 1.0 | 잔가지 밀도 |
| `needles` | 1.0 | 잎 밀도 |
| `needleSize` | 1.55 | 잎 묶음 크기 |
| `clearTrunk` | 3.2 | 가지 없이 드러난 밑동 높이 |
| `trunkRadius` | 0.62 | 줄기 굵기 |

나무는 언제나 높이 20 짜리로 키운 뒤 `size` 에 맞춰 줄입니다. 그래서 2m 트리와 20m 트리의 비율이 같습니다.

### 장식 (`decor`)

| 이름 | 기본값 | 뜻 |
| --- | --- | --- |
| `ornaments` | 620 | 자동으로 거는 오너먼트 수 |
| `ornamentSize` | 1 | 오너먼트 크기 배율 |
| `ornamentShapes` | `{ ball: 0.78, drop: 0.22 }` | 모양별 비율. ball · drop · star · bell · heart · snowflake |
| `palette` | `'classic'` | classic · red-gold · silver-blue · rainbow · candy · forest, 또는 색 배열 |
| `lights` | 2200 | 전구 수 |
| `lightColor` | `'warm'` | warm · cool · multi · red-green, 또는 색 배열 |
| `trunkLights` | true | 드러난 밑동에 전구 줄 감기 |
| `garland` / `garlandColor` | true / `#f0c25a` | 금박 갈런드 |
| `beads` / `beadColors` | true / 흰색·빨강 | 구슬 줄 |
| `topper` / `topperColor` | `'star'` / `#ffd76a` | 꼭대기 별 (`'none'` 이면 없음) |
| `presents` | 26 | 선물 상자 수 |
| `base` | `'bed'` | bed(돌 화단) · skirt(트리 치마) · none |
| `skirtColor` | `#9c1018` | 트리 치마 색 |
| `glowLights` | true | 별과 트리 안쪽 점광원. 트리를 여러 그루 둘 때는 끄는 편이 가볍다 |

### 품질별 잎 묶음 수 (classic, 대략)

| 품질 | 잎 묶음 | 전구 | 쓰임 |
| --- | --- | --- | --- |
| ultra | 128,000 | 2,350 | 트리 하나가 주인공인 화면 |
| high | 63,000 | 1,900 | 기본값 |
| medium | 31,000 | 1,360 | 여러 그루, 휴대폰 |
| low | 14,000 | 850 | 숲, 게임용 GLB |

## 오너먼트 달기

자리는 `{ h, a }` 로 적습니다. `h` 는 높이 비율(0 이 바닥, 1 이 꼭대기), `a` 는 줄기 둘레 각도(라디안)입니다. 트리 크기나 모양을 바꿔도 같은 자리의 바깥면에 다시 붙습니다.

```js
tree.addOrnament({ shape: 'star', color: '#f2c14e', h: 0.6, a: 1.2 });

// 화면을 누른 곳에 달기
const spot = tree.surfacePoint(ndc, camera); // { h, a, point } 또는 null
if (spot) tree.addOrnament({ shape: 'heart', color: '#e23b3b', h: spot.h, a: spot.a, data: { from: '민지', wish: '눈 오는 날' } });

// 손에서 날아가 붙게
tree.addOrnament({ shape: 'bell', color: '#3fa4ff', h: 0.4, a: 2 }, { from: handWorldPosition });

// 누른 오너먼트 고르기·떼기
const hit = tree.pickOrnament(ndc, camera); // Raycaster 를 넘겨도 된다
if (hit) tree.removeOrnament(hit.id);

tree.addEventListener('ornamentadd', (e) => save(e.ornament));
tree.addEventListener('ornamentarrive', (e) => sparkle(tree.ornamentPosition(e.ornament)));
```

`data` 에는 무엇이든 넣을 수 있고 `toJSON()` 에 같이 저장됩니다. 방문자 소원, 작성자, 시각 같은 값을 담아 서버에 보내면 됩니다.

## 저장과 불러오기

```js
const json = tree.toJSON();
// { format: 'xmas-tree-kit', version: 1, preset: 'cozy', size: 2.4, quality: 'high', tree: {...}, ornaments: [...] }

const copy = ChristmasTree.fromJSON(json);
```

프리셋 이름과 바꾼 값만 적어서 파일이 작습니다. 짧은 소원을 담은 오너먼트 300개를 단 트리가 30KB 남짓입니다.

## `<xmas-tree>` 속성

| 속성 | 뜻 |
| --- | --- |
| `preset` `seed` `size` `quality` | 트리 |
| `palette` `light-color` `lights` `ornaments` `presents` `topper` `base` `garland` `beads` | 장식 |
| `snow` `glow` `twinkle` | 다시 만들지 않고 바로 바뀐다 |
| `background` | night · evening · day · transparent · `#색` |
| `camera-controls` | 끌어서 돌리고 휠로 확대 |
| `auto-rotate` | 천천히 돈다. 만지면 멈췄다가 6초 뒤 다시 돈다 |
| `snowfall` | 눈이 내린다 |
| `ground` | 바닥 (`false` 면 없음, 색을 적으면 그 색) |
| `src` | 저장한 JSON 주소 |
| `decorate` | 누르면 오너먼트를 단다. Shift 를 누른 채 누르면 뗀다 |
| `ornament-shape` `ornament-color` | 달 모양과 색 (안 정하면 누를 때마다 바뀐다) |

```js
const el = document.querySelector('xmas-tree');
el.config = savedJson;        // 속성으로 다 못 적는 값
el.tree;                      // ChristmasTree
el.addEventListener('ornamentadd', (e) => fetch('/api/ornaments', { method: 'POST', body: JSON.stringify(e.detail.ornament) }));
await el.toBlob();            // PNG
await el.downloadGLB('tree.glb');
```

화면 밖으로 스크롤되면 그리기를 멈춥니다.

## 게임에 넣을 때

```js
const tree = new ChristmasTree({ preset: 'classic', size: 6 });
scene.add(tree);

// 충돌: 줄기 반지름과 가지 폭 (월드 단위)
const { trunkRadius, crownRadius, height } = tree.footprint;

// 숲: 낮은 품질, 점광원 없음, 그림자는 몇 그루만
for (let i = 0; i < 30; i++) {
  const t = new ChristmasTree({ preset: 'snowy', quality: 'low', size: 4, seed: i, shadows: i % 3 === 0 });
  t.position.set(...);
  scene.add(t);
}
```

`examples/game.html` 은 숲을 1인칭으로 걸으며 화면 가운데가 가리키는 자리에 오너먼트를 다는 예제입니다.

### GLB 내보내기 옵션

```js
exportGLB(tree, {
  bake: true,        // 인스턴스를 보통 메시로 굽는다 (기본값)
  needleRatio: 1,    // 잎 묶음 중 내보낼 비율
  lights: false,     // 점광원 넣기
  userOrnaments: true,
});
```

| 엔진 | `bake: true` | `bake: false` (EXT_mesh_gpu_instancing) |
| --- | --- | --- |
| Godot 4 | 됨 | 읽지 못함 |
| Unity (glTFast) | 됨 | 됨, 파일이 작다 |
| three.js · Babylon.js | 됨 | 됨 |

눈 쌓임과 전구 깜박임은 셰이더라 파일에 담기지 않습니다. 전구는 빛나는 무광 재질로 바뀝니다.

## 낮은 단계 API

`ChristmasTree` 없이 조각만 쓸 수도 있습니다.

```js
import { buildTree, buildDecorations, createUniforms, createOrnamentLayer } from 'xmas-tree-kit';

const uniforms = createUniforms({ snow: 0.4 });
const fir = buildTree({ seed: 3, whorls: 30 }, uniforms);          // 장식 없는 전나무
const decor = buildDecorations(fir, { palette: 'forest' }, uniforms); // 그 나무에 맞춘 장식
```

`buildTree` 는 장식을 걸 자리(`anchors`), 전구 자리(`tips`), 높이별 가지 폭(`envAt(y)`)을 함께 돌려줍니다. 직접 만든 장식을 걸 때 씁니다.

## 개발

```bash
npm run dev          # 에디터와 예제
npm test             # 생성 결과 단위 테스트 (Node, DOM 없이)
npm run check        # 헤드리스 브라우저 점검, tmp/shots/ 에 스크린샷
npm run build        # dist/ (라이브러리, 웹 컴포넌트, 스크립트 한 줄용 파일)
npm run build:site   # site-dist/ (에디터·예제 정적 사이트)
```

릴리스할 때는 `npm run build` 뒤 `dist/` 까지 커밋하고 태그를 답니다. git 으로 받는 사람과 jsDelivr 는 이 `dist/` 를 그대로 씁니다.

설계와 참고한 프로젝트는 [docs/design.md](docs/design.md) 에 적었습니다.

## 라이선스

MIT
