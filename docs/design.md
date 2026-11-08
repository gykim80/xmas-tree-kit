# 설계

## 무엇을 만드나

크리스마스 타운 광장 트리(`src/tree.js`, `src/decor.js`, `src/wishes.js`)를 다른 프로젝트에서 다시 쓰려면 매번 파일을 복사하고 앱 전용 코드(에셋 목록, 셰이더 공유 값, 반사 패스)를 걷어 내야 했습니다. 이 저장소는 그 부분을 떼어 내어 세 곳에서 바로 쓰게 합니다.

1. three.js 장면과 웹 게임: `ChristmasTree` (THREE.Group)
2. 웹페이지: `<xmas-tree>` 웹 컴포넌트, 스크립트 한 줄
3. 다른 게임 엔진: GLB 내보내기

## 참고한 프로젝트

| 프로젝트 | 가져온 것 |
| --- | --- |
| [ez-tree](https://github.com/dgreenheck/ez-tree) | `THREE.Group` 을 상속한 트리 클래스, 옵션 객체와 프리셋, 같은 저장소에 라이브러리와 에디터를 같이 두는 구성, Vite 라이브러리 빌드에서 three 를 외부로 빼는 방식, 에디터에서 GLB·PNG 내보내기. 잔가지에 잎 묶음을 인스턴스로 붙이는 방식은 원래 트리 코드가 이미 따르고 있었다 |
| [proctree.js](https://github.com/supereggbert/proctree.js) | 씨앗값 하나와 평평한 옵션 객체로 같은 나무를 언제나 다시 만드는 방식 |
| [model-viewer](https://github.com/google/model-viewer) | 웹 컴포넌트 속성 이름 규칙(케밥 표기, 켜고 끄는 속성은 있으면 켜짐), `camera-controls` · `auto-rotate` 이름, `toBlob()`, 스크립트 한 줄 설치 |
| [glTF EXT_mesh_gpu_instancing](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_gpu_instancing) | Godot 4 가 이 확장을 읽지 못해(godot#112866 진행 중) GLB 기본값을 '인스턴스 굽기'로 두고, 확장판은 옵션으로 남겼다. Blender 내보내기의 GPU Instances 설정과 같은 선택지 |
| [jsDelivr](https://www.jsdelivr.com/) | git 태그에서 바로 파일을 내주는 주소(`cdn.jsdelivr.net/gh/사용자/저장소@태그/파일`). 그래서 `dist/` 를 저장소에 커밋한다 |

## 구조

```
src/
  index.js              공개 API
  christmas-tree.js     ChristmasTree: 옵션 정리·프리셋·품질, 다시 만들기 범위 판단, JSON, 프레임 훅
  presets.js            프리셋 7종, 품질 4단계
  tree/tree.js          전나무 생성 (줄기·뿌리·가지·잔가지 관, 바늘잎 인스턴스, 외곽선 envAt)
  decor/decorate.js     자동 장식 (오너먼트·전구·갈런드·구슬 줄·별·화단/치마·선물)
  decor/ornaments.js    사람이 다는 오너먼트 층 (정규화 자리, 날아오기, 고르기, 바깥면 레이캐스트)
  decor/shapes.js       오너먼트 모양 6종
  materials.js          눈 쌓임 셰이더 패치, 깜박이는 전구 재질, 셰이더 공유 값
  textures.js           캔버스 텍스처 (DOM 이 없으면 null)
  prepass.js            잎 깊이 선행 패스
  export.js             GLB 내보내기 (굽기 / 인스턴싱)
  viewer.js             트리 하나를 띄우는 화면 (빛·배경·바닥·눈·카메라)
  element.js            <xmas-tree>
editor/                 에디터
examples/               basic(코드), embed(태그), game(1인칭 숲)
test/                   Node 단위 테스트, 브라우저 점검 도우미
scripts/check.mjs       헤드리스 브라우저 점검
```

## 결정한 것

**설계 단위.** 원래 트리는 높이 20 에 맞춰 가지 마디 길이, 잎 크기, 장식 간격이 정해져 있다. 높이를 바꾸면 이 값들이 같이 바뀌지 않아 비율이 깨진다. 그래서 언제나 높이 20 으로 키우고 바깥 상자(`root`)의 배율로 `size` 미터에 맞춘다. 사용자의 `tree.scale` 은 건드리지 않는다. 점광원 세기와 닿는 거리는 부모 배율을 따르지 않으므로 배율의 제곱과 배율만큼 따로 줄인다.

**프레임 훅.** 트리를 넣는 사람이 매 프레임 무엇을 불러야 하면 빠뜨리기 쉽다. 나무껍질 메시의 `onBeforeRender` 에서 시계, 전구 최소 픽셀 크기(`uPx`), 오너먼트 LOD, 별 방향, 날아가는 오너먼트를 처리한다. 화면에 트리가 없으면 돌지 않는다. 시간을 직접 맞추려면 `tree.update(초)` 를 부른다.

**오너먼트 자리.** 월드 좌표로 저장하면 트리 크기나 모양을 바꿀 때 오너먼트가 허공에 뜨거나 가지 속에 묻힌다. 높이 비율 `h`, 각도 `a`, 바깥면 대비 반지름 `r` 로 적고, 생성 때 잰 외곽선 `envAt(y)` 로 다시 자리를 잡는다. 트리를 누를 때는 외곽선을 돌린 보이지 않는 회전체에 레이를 쏜다.

**다시 만들기 범위.** `set()` 은 바뀐 값을 보고 셰이더 값만 바꾸거나(눈, 밝기, 깜박임, 크기), 장식만 다시 만들거나(팔레트, 전구 수), 나무까지 다시 키운다.

**품질.** 형태 값은 그대로 두고 가지 층, 층마다 가지, 잔가지, 잎 밀도, 전구 수를 줄인다. 잎이 성긴 만큼 잎 묶음을 키워 실루엣을 지킨다. 사용자가 직접 준 값은 품질이 줄이지 않는다.

**Node 에서 돌기.** 캔버스 텍스처는 DOM 이 없으면 null 을 돌려주고 재질은 단색으로 남는다. 그래서 생성과 JSON, 내보낼 장면 만들기를 Node 테스트로 확인한다.

**저장 형식.** `{ format, version, preset, size, quality, tree?, decor?, snow?, ornaments }`. 프리셋을 기준으로 바꾼 값만 적는다. 형식이 바뀌면 `version` 을 올리고 `fromJSON` 에서 옮긴다.
