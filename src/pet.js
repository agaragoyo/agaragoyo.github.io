// 내 집의 방에 사는 펫(docs/requirements.md의 F30). 고른 펫 한 마리가 살고, 고르기 전에는 기본 펫(data/pets.js의 DEFAULT_PET)이 산다.
// 종류(강아지, 고양이, 기니피그, 병아리, 비둘기, 코끼리, 코알라, 공룡)와 색은 시작 메뉴의 펫 바꾸기 창(src/pet-picker.js)에서 고르고, 이 브라우저의 설정(src/settings.js의 pet)에만 남는다.
// 병아리는 쓰다듬은 횟수가 GROW_PATS번이 되면 같은 색의 닭으로 자란다(patted). 횟수(petPats)와 자란 모습(pet)도 이 브라우저의 설정에만 남는다.
// 2026-11-15에 실험실의 '펫 데려오기'(pet)로 넣었고, 2026-11-17에 모든 사람에게 켰다. 같은 날 비둘기와 병아리를 더하고 햄스터를 기니피그로 바꿨고,
// 종류마다의 성격과 오른쪽 단추 메뉴의 명령을 더했다. 그림과 색, 성격(mood)은 data/pets.js에 있다.
// 펫은 아바타처럼 바닥 한 칸에 선다. 할 일(mode)은 셋이다.
//   혼자 놀기(free)  빈 바닥 칸에 앉아 있다가 성격의 rest만큼 쉬고 hop칸 떨어진 빈칸으로 아바타의 절반 빠르기(한 칸 0.4초)로 걸어가 다시 앉는다.
//                    겁 많은 종류(edge)는 벽 앞이나 가구 옆 칸을 고르고, 닭(peck)은 앉아 있는 동안 가끔 바닥을 쫀다
//   따라오기(follow) 아바타와 같은 빠르기(한 칸 0.2초)로 아바타가 지나온 칸을 밟으며 바로 뒤 칸까지 따라온다(포켓몬 하트골드의 데리고 걷기).
//                    아바타의 길을 막지 않아서, 아바타가 펫 칸으로 들어오면 서로 자리를 바꾼다. 병아리(follow)는 처음부터 따라온다
//   기다리기(stay)   그 칸에 앉아 움직이지 않는다
// 할 일은 펫을 마우스 오른쪽 단추로 누르면 뜨는 메뉴에서 시킨다(마인크래프트의 늑대를 앉히고 일으키는 것처럼). 명령을 듣지 않는 종류(obey가 거짓, 고양이)는
// 아바타 쪽으로 고개를 돌려 쳐다보다가 돌아서기만 한다. 앉아 있는 동안에는 1초마다 숨을 쉬고(머리와 몸 윗부분이 한 칸 내려온다) 3~6초마다 0.15초 동안 눈을 감는다.
// 두 번 누르면(메뉴의 "쓰다듬기"와 같다) 아바타가 바로 옆 칸으로 와서 쓰다듬고, 펫은 1초 동안 눈을 감고 머리 위에 하트가 뜬다(기니피그는 폴짝 뛴다, pop).
// 그때 종류마다의 소리(data/pets.js의 sound)를 한 번 낸다. 소리는 아바타가 다 걸어온 뒤에 나서 누른 순간보다 늦으므로, 사파리가 막지 않게
// 누른 순간에 소리를 만들어 둔다(pat의 prime, known-issues 101).
// 물과 밥은 집에 저장해야 해서 넣지 않았다. 펫은 화면에만 있고 집 저장 형식과 공유 링크에는 아무것도 담지 않는다(새로 고침하면 다른 칸에서 시작하고, 할 일도 처음으로 돌아간다).
// 혼자 놀거나 기다리는 펫이 차지한 칸(걷는 동안은 두 칸)은 아바타가 지나가지 못하고(src/avatar.js의 host.others가 부르는 cells), 두 그림이 겹치면 앞에 선 쪽이 위에 그려진다(order).
// 가구와의 앞뒤는 아바타와 같은 규칙(depthZ)이다. 혼자 놀 때는 벽에 붙은 줄(x나 y가 0)에 가지 않는다. 아바타가 벽 가구와 문을 쓰러 가서 서는 칸이라서다.
// 가구에 올라가는 종류(mood.perch, 고양이)는 혼자 놀다 쉬고 일어날 때 가끔(src/config.js의 PERCH.odds) 바닥 대신 가구로 걸어가, 가구 옆 칸에서
// 윗면(data/furniture.js의 perch, src/rules.js의 perchesOf)으로 뛰어올라 웅크린 그림(loaf)으로 PERCH.stay 동안 쉬다가 옆 칸으로 뛰어내린다.
// 방에 처음 나올 때도 PERCH.start의 몫으로 가구 위에서 시작한다. 가구 위에서는 그 가구 바로 위에 그리고(perchZ), 차지한 칸은 발끝이 든 가구 칸이다.
// 아바타가 그 가구를 쓰러 오면(src/os.js의 useFurniture가 부르는 vacate) 뛰어내려 비키고, 방 꾸미기에서 가구를 옮기거나 치우거나 그 칸에 물건을 올리면
// 방을 다시 그릴 때(attach) 뛰어내린다. 마인크래프트의 고양이가 앉은 상자는 열리지 않는데 그것이 고장으로 보고되어 왔으므로, 아바타가 쓰려는 가구는 늘 비켜 준다.
// 움직임 줄이기를 켠 사람에게는 걸어 다니지 않고 숨도 쉬지 않으며 앉아만 있는다(눈 깜박이기와 쓰다듬기는 된다). 따라오는 펫은 걷지 않고,
// 아바타가 멈춰 서면 그 바로 뒤 칸에 나타난다. 가구 위에서 시작하거나 가구에서 내려올 때도 뛰지 않고 자리만 바뀐다.
// 한 칸은 2px 안팎이고, src/icons.js의 fitPixelIcons가 화면 픽셀 정수 개로 맞춘 값(--pet-cell)으로 그린다(known-issues 67).
// 말풍선에 999999999를 말하면 날아오는 비둘기 떼(src/pigeon.js)도 한 마리씩 이 코드로 걷는다(비둘기의 성격 그대로 혼자 놀되 내려앉은 칸 둘레에서만 걷는다, host.roam).
// 그 비둘기들은 창문이나 현관문에서 날아 들어오고(flyIn) 날아 나가며(flyOut), 두 번 누르면 쓰다듬는 대신 아바타가 다가온 뒤 놀라 날아간다(host.shy). 오른쪽 단추 메뉴는 없다.
// 내 펫과 비둘기, 비둘기끼리는 서로의 칸과 그 둘레 한 칸에 들어가지 않아(host.others) 그림이 겹치지 않는다. 따라오는 펫만은 비둘기 옆 칸을 지나갈 수 있다.
import { N, PERCH } from './config.js';
import { tile } from './iso.js';
import { depthZ, blockedOf, overlaps } from './avatar.js';
import { dims, perchesOf, supportOf } from './rules.js';
import { zOf } from './room.js';
import { h, clamp, doubleClick, reduceMotion } from './util.js';
import { play, prime } from './sound.js';
import { openMenu } from './context-menu.js';
import { PET_SPECIES, DEFAULT_PET, DEFAULT_MOOD } from '../data/pets.js';

export const PET_COLS = 24;     // 그림 한 장의 가로 칸 수(data/pets.js)
export const PET_ROWS = 20;     // 세로 칸 수. 한 칸이 2px이면 48×40px로, 아바타 그림(64×104px) 폭의 75%다
export const NO_PET = 'none';   // 펫 바꾸기 창에서 "없음"을 고르면 설정(pet)에 남는 값. 이때는 방에 펫을 두지 않는다(src/os.js의 syncPet)
const STEP_MS = 400;            // 혼자 놀 때 한 칸 걷는 시간. 아바타(200ms)의 절반 빠르기다
const FOLLOW_MS = 200;          // 따라올 때 한 칸 걷는 시간. 아바타와 같은 빠르기라 한 걸음 뒤에서 발을 맞춘다
const LAG = 0;                  // 따라올 때 앞선 이와의 사이에 비워 두는 칸 수. 0이면 바로 뒤 칸까지 와서 선다
const WATCH_MS = 50;            // 따라올 때 앞선 이가 옮겨 갔는지 보는 간격. 한 걸음(200ms)보다 충분히 짧다
const SETTLE_MS = 400;          // 움직임 줄이기를 켠 사람에게, 앞선 이가 이만큼 서 있으면 따라오는 펫이 그 바로 뒤 칸에 나타난다
const HEART_MS = 1000;          // 쓰다듬은 뒤 하트가 떠 있고 눈을 감고 있는 시간
const CALL_MS = 8000;           // 쓰다듬으러 오는 아바타를 기다리는 가장 긴 시간. 아바타가 오다가 다른 데로 가면 그 뒤에 하던 일로 돌아간다
const BREATH_MS = 1000;         // 앉아 있을 때 숨을 들이쉬고 내쉬는 간격
const BLINK_MS = 150;           // 눈을 깜박일 때 감고 있는 시간
const BLINK_GAP = [3000, 6000]; // 눈을 깜박이는 간격(이 사이에서 무작위)
const SNUB_MS = 1000;           // 명령을 듣지 않는 펫이 아바타를 쳐다보는 시간. 돌아선 뒤 그 절반이 지나면 아바타가 한마디 한다
const PECK_GAP = [2000, 5000];  // 바닥을 쪼는 간격(mood.peck, 이 사이에서 무작위)
const PECK_MS = 130;            // 한 번 쪼는 동안 머리를 숙이고 있는 시간. 두 번 쪼고 든다
const POP_MS = 700;             // 쓰다듬으면 폴짝 뛰는 시간(mood.pop). style.css의 .room-pet.pop이 두 번 뛴다
export const GROW_PATS = 10;    // 자라는 펫(data/pets.js의 grow, 병아리)이 다음 모습이 되기까지 쓰다듬는 횟수. 발표에서 바로 보여 줄 수 있게 날짜 대신 횟수로 자란다
const HEAD_X = 9.5;             // 왼쪽을 본 그림에서 머리 가운데의 칸 자리. 모든 종류가 같은 자리에 머리가 있다(data/pets.js)
const HEAD_DX = PET_COLS / 2 - HEAD_X; // 머리 가운데가 그림 가운데보다 앞(보는 쪽)으로 나온 칸 수. 하트를 그 위에 띄운다
const FLY_SPEED = 180;          // 나는 빠르기(무대 px/초). 창문에서 내려앉을 칸까지 1초쯤이다
const FLY_MS = [900, 1800];     // 한 번 나는 시간의 범위
const FLAP_MS = 110;            // 날개를 든 장과 내린 장을 바꾸는 간격
const FADE_MS = 250;            // 창문이나 현관문에서 나타나고 사라지는 시간
const ARC = 18;                 // 나는 길 가운데가 곧은 줄보다 솟는 높이(무대 px)
const LEAP_MS = 380;            // 가구에 뛰어오르거나 뛰어내리는 시간
const LEAP_ARC = 10;            // 뛰는 길이 높은 쪽 끝보다 더 솟는 높이(무대 px). 윗면 높이 차의 절반에 더해 곧은 줄보다 솟는다
const LEAP_REACH = 2.1;         // 뛰는 칸(가구 옆 바닥 칸의 가운데)에서 가구 위 앉는 자리까지의 가장 먼 거리(칸). 바로 옆과 한 칸 비낀 칸까지다
const PERCH_REACH = 8;          // 혼자 놀다 가구로 갈 때 걸어가는 가장 먼 거리(길을 따라 센 칸 수)
// 발끝 자리 a에서 b까지(무대 px) 나는 시간(ms)
export const flyMs = (a, b) => clamp((Math.hypot(b.x - a.x, b.y - a.y) / FLY_SPEED) * 1000, FLY_MS[0], FLY_MS[1]);
// a에서 b까지 나는 길에서 시간의 비율 k(0~1)일 때의 발끝 자리(무대 px). 가운데가 ARC만큼 솟는 활 모양으로 난다.
// 들어올 때(fade 'in')는 빠르게 들어와 천천히 내려앉고, 나갈 때('out')는 천천히 날아올라 빨라진다.
// 비둘기 떼(src/pigeon.js)가 저마다 날아오를 때를 정할 때, 먼저 뜬 비둘기와 겹치는지 이것으로 미리 따져 본다
export function flightAt(a, b, k, fade) {
  const e = fade === 'in' ? 1 - (1 - k) * (1 - k) : k * k;
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - ARC * 4 * e * (1 - e) };
}
// ms 동안 나는 길에서 t ms가 지났을 때 보이는 정도(0~1). 들어올 때는 처음 FADE_MS 동안 나타나고, 나갈 때는 끝 FADE_MS 동안 사라진다
export const flightSeen = (t, ms, fade) => clamp(fade === 'in' ? t / FADE_MS : (ms - t) / FADE_MS, 0, 1);
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
// 오른쪽 단추 메뉴에서 시키는 할 일. [할 일, 메뉴 줄, 시킬 때 아바타가 하는 말]. 메뉴에는 이 차례로 나오고 지금 하는 일 앞에 점이 찍힌다.
// 혼자 놀게 하기는 따라오기나 기다리기를 풀어 처음처럼 돌아다니게 한다
export const ORDERS = [
  ['follow', '따라오게 하기', '따라와!'],
  ['stay', '기다리게 하기', '기다려!'],
  ['free', '혼자 놀게 하기', '가서 놀아!'],
];
export const IGNORED = '못 들은 척하네.'; // 명령을 듣지 않는 펫이 쳐다보다 돌아서면 아바타가 하는 말
// 그림 한 마리에 넣는 장. 숨 쉬는 장과 눈 감은 장, 바닥을 쪼는 장은 앉은 그림에서 만든다(framesOf).
// 나는 그림(fly1, fly2)이 있는 종류는 그 두 장을, 바닥을 쪼는 종류(mood.peck)는 쪼는 장(peck)을,
// 웅크린 그림(loaf)이 있는 종류는 웅크린 장과 그 숨 쉬는 장, 눈 감은 장(LOAF)을 더 넣는다
const FRAMES = ['sit', 'breath', 'blink', 'breath-blink', 'walk1', 'walk2'];
const LOAF = ['loaf', 'loaf-breath', 'loaf-blink', 'loaf-breath-blink'];
const framesFor = species => [...FRAMES, ...(species.fly1 ? ['fly1', 'fly2'] : []), ...(moodOf(species).peck ? ['peck'] : []), ...(species.loaf ? LOAF : [])];

const key = (x, y) => `${x},${y}`;
const near = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
const same = (a, b) => a.x === b.x && a.y === b.y;

// 종류의 성격. data/pets.js의 기본값(DEFAULT_MOOD)에 그 종류의 mood를 덮는다. 부를 때마다 새로 읽어서 점검 도구가 페이지 안에서 값을 바꿔도 따른다
export const moodOf = species => ({ ...DEFAULT_MOOD, ...species.mood });

const HEART = {
  colors: { k: '#8a2c46', p: '#ff6f91', w: '#ffffff' },
  rows: ['.kk.kk.', 'kwpkppk', 'kpppppk', '.kpppk.', '..kpk..', '...k...'],
};

// 겉선 색. 바탕 색(b)의 명도를 35 낮추고 채도를 30% 줄인다. 검은 겉선보다 부드럽고, 바탕화면 아이콘의 겉선과 같은 방법이다
function outline(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let hue = 0, sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hue = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
  }
  const s2 = sat * 0.7, l2 = Math.max(0.1, l - 0.35);
  const ch = n => {
    const k = (n + hue * 12) % 12, a = s2 * Math.min(l2, 1 - l2);
    return Math.round(255 * (l2 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
  };
  return `#${ch(0)}${ch(8)}${ch(4)}`;
}
// data/pets.js의 색 하나를 그림 글자마다의 색으로 푼다. 하이라이트(h)는 흰색, 바닥 그림자(s)는 바닥 색이 비치는 옅은 갈색이다
const paint = color => ({ ...color, o: outline(color.b), h: '#ffffff', s: 'rgba(60, 35, 20, 0.22)' });

// 숨을 들이쉰 그림. breath 줄을 빼고 맨 위에 빈 줄을 더해, 그 줄 위(머리와 몸 윗부분)가 한 칸 내려온다
const inhale = (rows, k) => ['.'.repeat(PET_COLS), ...rows.slice(0, k), ...rows.slice(k + 1)];

// 눈 감은 그림. 이어진 눈 칸(e, h)을 한 덩어리씩 모아, 하이라이트(h)가 든 덩어리(눈)는 맨 아래 줄만 눈 색으로 남기고
// 나머지는 눈 바로 위 칸의 색(없으면 바탕)으로 덮는다. 하이라이트가 없는 덩어리는 코라서 그대로 둔다
function shut(rows) {
  const g = rows.map(r => [...r]);
  const isEye = (x, y) => g[y]?.[x] === 'e' || g[y]?.[x] === 'h';
  const seen = new Set();
  for (let y = 0; y < g.length; y++) for (let x = 0; x < PET_COLS; x++) {
    if (!isEye(x, y) || seen.has(key(x, y))) continue;
    const part = [];
    const queue = [[x, y]];
    seen.add(key(x, y));
    while (queue.length) {
      const [cx, cy] = queue.pop();
      part.push([cx, cy]);
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!isEye(nx, ny) || seen.has(key(nx, ny))) continue;
        seen.add(key(nx, ny));
        queue.push([nx, ny]);
      }
    }
    if (!part.some(([cx, cy]) => g[cy][cx] === 'h')) continue;
    const top = Math.min(...part.map(p => p[1]));
    const bottom = Math.max(...part.map(p => p[1]));
    for (const [cx, cy] of part) {
      const above = g[top - 1]?.[cx];
      g[cy][cx] = cy === bottom ? 'e' : above && !'eh.'.includes(above) ? above : 'b';
    }
  }
  return g.map(r => r.join(''));
}

// 종류마다 그림 장을 한 번만 만든다. 바닥을 쪼는 장(peck)은 숨 쉬는 장처럼 줄을 빼되 두 줄을 빼서, 머리와 몸 윗부분이 두 칸 숙여진다.
// 웅크린 그림(loaf)도 앉은 그림과 같은 줄(breath)을 빼서 숨 쉬는 장을 만든다
const frameCache = new Map();
function framesOf(species) {
  if (!frameCache.has(species.id)) {
    const breath = inhale(species.sit, species.breath);
    const loafBreath = species.loaf && inhale(species.loaf, species.breath);
    frameCache.set(species.id, {
      loaf: species.loaf,
      'loaf-breath': loafBreath,
      'loaf-blink': species.loaf && shut(species.loaf),
      'loaf-breath-blink': loafBreath && shut(loafBreath),
      sit: species.sit,
      breath,
      blink: shut(species.sit),
      'breath-blink': shut(breath),
      walk1: species.walk1 || species.sit,
      walk2: species.walk2,
      fly1: species.fly1,
      fly2: species.fly2,
      peck: inhale(breath, species.breath),
    });
  }
  return frameCache.get(species.id);
}

// 칸 그림을 SVG 조각으로 만든다. 같은 색 칸이 가로로 이어지면 한 조각으로 묶는다. 그림자(s)는 누르기를 받지 않는다(style.css의 .shade)
function cellPaths(rows, colors) {
  const paths = {};
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      let n = 1;
      while (row[x + n] === row[x]) n++;
      if (row[x] !== '.') (paths[row[x]] ??= []).push(`M${x} ${y}h${n}v1h-${n}z`);
      x += n;
    }
  });
  return Object.entries(paths).map(([c, d]) => `<path${c === 's' ? ' class="shade"' : ''} fill="${colors[c]}" d="${d.join('')}"/>`).join('');
}
const HEART_SVG = `<svg viewBox="0 0 7 6" aria-hidden="true">${cellPaths(HEART.rows, HEART.colors)}</svg>`;

// 설정에 남긴 값('<종류>/<색>', src/settings.js의 pet)을 data/pets.js의 종류와 색으로 푼다.
// 비었거나 없는 종류면 기본 펫(DEFAULT_PET)이고, 없는 색이면 그 종류의 첫 색이다. value는 고친 값이다
export function petChoice(value) {
  const [kind, tone] = String(value || DEFAULT_PET).split('/');
  const species = PET_SPECIES.find(s => s.id === kind) || PET_SPECIES.find(s => s.id === DEFAULT_PET.split('/')[0]);
  const color = species.colors.find(c => c.id === tone) || species.colors[0];
  return { species, color, value: `${species.id}/${color.id}` };
}

// 펫 바꾸기 창의 종류 단추 하나가 맡는 종류. 자라서 된 종류(닭)는 자라기 전 종류(병아리)의 단추가 맡는다
export const petRoot = species => PET_SPECIES.find(s => s.grow === species.id) || species;
// 펫 바꾸기 창의 종류 단추에 나오는 종류. 자라서 된 종류는 빼고 data/pets.js의 차례대로다
export const PET_KINDS = PET_SPECIES.filter(s => petRoot(s) === s);

// 쓰다듬은 뒤에 바꿀 설정(src/settings.js의 pet과 petPats). 자라는 펫이면 쓰다듬은 횟수를 하나 더하고, GROW_PATS번이 되면
// 같은 색 id의 자란 종류로 바꾸며 횟수를 0으로 돌린다. 자라지 않는 펫이면 null이라 설정을 건드리지 않는다
export function patted(value, pats) {
  const { species, color } = petChoice(value);
  if (!species.grow) return null;
  const n = (Number(pats) || 0) + 1;
  return n < GROW_PATS ? { petPats: n } : { pet: `${species.grow}/${color.id}`, petPats: 0 };
}

// 펫 한 마리의 SVG. frames에 든 장마다 <g data-frame>을 하나씩 넣는다. 보이는 장은 petPuppet이 고르고, 한 장만 넣으면 그 장이 보인다
export function petSvg(choice, frames = framesFor(choice.species)) {
  const f = framesOf(choice.species);
  const colors = paint(choice.color);
  return `<svg viewBox="0 0 ${PET_COLS} ${PET_ROWS}" aria-hidden="true">${frames.map(n => `<g data-frame="${n}">${cellPaths(f[n], colors)}</g>`).join('')}</svg>`;
}

// 지금 그림 한 칸의 크기(무대 px). 무대 배율에 따라 바뀐다(src/icons.js의 fitPixelIcons)
export const petCell = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pet-cell')) || 2;

// 쓰다듬을 때 하트를 띄울 높이. 그림 rows(앉은 그림이나 웅크린 그림)의 머리 가운데 위 7칸 폭에서 가장 위에 칠한 줄을 찾아,
// 그 한 칸 위에 하트(6줄)의 아래가 오게 한다. 고양이처럼 귀가 양옆에 선 종류는 귀 사이에 뜬다. 돌려주는 값은 발끝에서 하트 위까지의 칸 수(음수)다
function heartRise(rows) {
  const top = rows.findIndex(row => /[^.]/.test(row.slice(HEAD_X - 3.5, HEAD_X + 3.5)));
  return top - 1 - HEART.rows.length - PET_ROWS;
}

// 펫 그림을 담은 상자(방의 .room-pet, 펫 바꾸기 창의 큰 그림)를 움직인다.
//   look(choice)  종류와 색을 정하고 그림을 다시 넣는다(petChoice가 돌려준 것)
//   pose(name)    'sit'(앉기), 'loaf'(가구 위에 웅크리기, 웅크린 그림이 있는 종류만), 'walk1', 'walk2'(걷기 두 장),
//                 'fly1', 'fly2'(날기 두 장, 나는 그림이 있는 종류만), 'peck'(바닥 쪼기, mood.peck인 종류만)
//   shut(on)      앉거나 웅크려 있을 때 눈을 감는다(쓰다듬는 동안)
//   live(on)      켜면 앉거나 웅크려 있는 동안 숨을 쉬고 눈을 깜박인다. 움직임 줄이기를 켠 사람에게는 깜박이기만 한다. 끌 때 타이머를 모두 멈춘다
export function petPuppet(box) {
  let groups = [];
  let pose = 'sit';
  let breathIn = false;
  let blinking = false;
  let eyesShut = false;
  let breathTimer = 0;
  let blinkTimer = 0;

  const still = () => pose === 'sit' || pose === 'loaf'; // 숨 쉬고 눈을 깜박이는 자세
  const frame = () => {
    if (!still()) return pose;
    const closed = eyesShut || blinking;
    const pre = pose === 'loaf' ? 'loaf-' : '';
    if (breathIn) return pre + (closed ? 'breath-blink' : 'breath');
    return closed ? `${pre}blink` : pose;
  };
  const show = () => {
    const name = frame();
    for (const g of groups) g.style.display = g.dataset.frame === name ? '' : 'none';
  };
  const blinkLater = () => {
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(() => {
      blinking = true;
      show();
      blinkTimer = setTimeout(() => {
        blinking = false;
        show();
        blinkLater();
      }, BLINK_MS);
    }, BLINK_GAP[0] + Math.random() * (BLINK_GAP[1] - BLINK_GAP[0]));
  };

  return {
    look(choice) {
      box.innerHTML = petSvg(choice);
      box.dataset.pet = choice.value;
      groups = [...box.querySelectorAll('g[data-frame]')];
      show();
    },
    pose(name) {
      pose = name;
      if (!still()) breathIn = false;
      show();
    },
    shut(on) {
      eyesShut = on;
      show();
    },
    live(on) {
      clearInterval(breathTimer);
      clearTimeout(blinkTimer);
      breathIn = blinking = false;
      if (on) {
        if (!reduceMotion) {
          breathTimer = setInterval(() => {
            if (!still()) return;
            breathIn = !breathIn;
            show();
          }, BREATH_MS);
        }
        blinkLater();
      }
      show();
    },
  };
}

// host: 펫이 사는 곳(바탕화면 배경, os.js가 넘긴다).
//   layer     가구와 아바타가 같이 들어 있는 상자. 다시 그리면 비워지므로 그 뒤에 attach를 부른다
//   items()   그 공간의 가구 목록
//   avatar()  내 아바타(src/avatar.js의 mountAvatar). 그 칸은 피해서 걷고, 쓰다듬을 때와 명령할 때(말풍선) 부른다. 없으면 null
//   look()    고른 펫(src/settings.js의 pet 값). 비었으면 기본 펫이다
//   pat()     쓰다듬을 때마다 부른다. 자라는 펫의 횟수를 세고 다 자라면 펫 설정을 바꾼다(src/os.js의 petPatted). 없어도 된다
//   others()  같은 방의 다른 펫 목록(내 펫과 날아온 비둘기들이 서로를 넘긴다). 저마다 claims()(없으면 cells())로 차지한 칸을 알려 주고,
//             혼자 놀거나 기다리는 펫은 그 칸과 둘레 한 칸에, 따라오는 펫은 그 칸에 가지 않는다. 없어도 된다
//   leader()  따라올 때 뒤를 밟을 앞선 이. spot()으로 선 칸을 알려 주면 된다. 없으면 아바타다.
//             펫을 여러 마리 키우게 되면 둘째부터 앞의 펫(이 함수가 돌려준 것)을 넘겨 줄지어 따라오게 한다
//   rest      앉아 있다가 다시 걷기까지 기다리는 시간의 범위 [ms, ms]. 없으면 종류의 성격(mood.rest)이다
//   roam(x, y) 있으면 혼자 놀 때 이것이 참인 칸만 지나고 그런 칸으로만 걸어간다. 날아온 비둘기가 내려앉은 칸 둘레에 머물고 아바타 곁을 지나지 않게 한다
//   shy()     있으면 두 번 눌렀을 때 쓰다듬는 대신, 아바타가 옆 칸까지 다가온 뒤 이것을 부른다(날아온 비둘기가 놀라 날아간다)
//   menu      있으면 오른쪽 단추로 눌렀을 때 할 일 메뉴를 띄운다. { root, toStage }: 메뉴를 넣을 무대와 화면 좌표를 무대 좌표로 바꾸는 함수.
//             가구와 펫이 든 상자(layer)는 쌓임 맥락이 따로라 그 안에 넣으면 창 아래에 깔리므로 무대에 넣는다
//   title     마우스를 올리면 보이는 글. 없으면 "두 번 눌러 쓰다듬기"다
// 돌려주는 것: attach(here), restyle(), cells(), claims(), spot(), mode(), order(at, rect, z), vacate(item), hold(on), flyIn(gate, then), flyOut(gate, then), say(text, ms), destroy().
// cells와 order는 아바타가 부른다(host.others). vacate는 아바타가 가구를 쓸 때 os.js가 부른다. hold, flyIn, flyOut, say는 날아오는 비둘기 떼(src/pigeon.js)가 쓴다.
// 가구 위에 웅크리고 있는 동안에는 펫 상자(.room-pet)의 data-perch에 그 가구의 id가 있다(눌러 보기 점검이 읽는다)
export function mountPet(host) {
  const el = h('div', { className: 'room-pet', title: host.title || '두 번 눌러 쓰다듬기' });
  const puppet = petPuppet(el);
  const heart = h('div', { className: 'room-pet-heart', hidden: true });
  heart.innerHTML = HEART_SVG;
  const bubble = h('div', { className: 'room-avatar-say room-pet-say', hidden: true }); // 날아온 비둘기의 "구구"(say)

  let species = null;   // 지금 종류(data/pets.js). 성격(mood)도 여기서 읽는다
  let mode = 'free';    // 할 일. 'free' 혼자 놀기, 'follow' 따라오기, 'stay' 기다리기
  let told = false;     // 지금 할 일이 메뉴로 시킨 일인지. 시키지 않았으면 종류가 바뀔 때(병아리가 닭이 되면) 새 종류가 처음 하는 일로 바뀐다
  let cell = null;      // 앉은 칸(걷는 중에는 들어가는 칸). 가구 위에서는 발끝이 든 가구 칸이다. 방에 없으면 null
  let from = null;      // 걷는 중이면 나오는 칸(가구에 뛰어오르거나 내리는 중이면 뛰기 전 칸)
  let perch = null;     // 가구 위에 올라가 있으면 그 자리 { item, x, y, h }. item은 앉은 가구의 { id, x, y, r }(놓인 자리를 적어 둔 것),
                        // x와 y는 발끝 자리(방의 칸 좌표, 소수), h는 윗면 높이(무대 px)다. 바닥에 있으면 null
  let aim = null;       // 혼자 놀다 가구로 걸어가는 중이면 올라갈 자리(perch와 같은 모양). 남은 길(route)의 끝 칸에서 뛰어오른다
  let leaving = false;  // 뛰어오르는 동안 아바타가 그 가구를 쓰러 왔다. 다 오르면 바로 내려온다
  let pos = null;       // 그리는 자리. 걷는 동안은 두 칸 사이의 소수
  let right = false;    // 화면 오른쪽을 보는지(그림을 뒤집는다)
  let route = [];       // 혼자 놀 때 남은 길
  let trail = [];       // 따라올 때 남은 길. 앞선 이가 지나온 칸들이고 맨 앞이 다음에 들어갈 칸이다(펫 칸과 앞선 이의 칸은 넣지 않는다)
  let seen = null;      // 따라올 때 마지막으로 본 앞선 이의 칸
  let movedAt = 0;      // 앞선 이가 마지막으로 옮겨 간 때(performance.now)
  let walking = false;
  let waiting = false;  // 쓰다듬으러 오는 아바타를 기다리는 중. 그동안은 걷지 않는다
  let pending = false;  // 걷던 중에 두 번 눌렸다. 들어가던 칸까지 마저 걷고 아바타를 부른다
  let snubbing = false; // 걷던 중에 듣지 않는 명령을 받았다. 들어가던 칸에 앉은 뒤 아바타를 쳐다본다
  let blocked = new Set();
  let size = 2;         // 그림 한 칸의 크기(무대 px)
  let base = 0;         // 가구와의 앞뒤로 정한 순서(depthZ)
  let foot = null;      // 앞뒤를 따진 자리 { at, w, d, rect }. at은 차지한 칸(걷는 동안은 두 칸을 합친 자리의 뒤쪽 모서리), w와 d는 그 칸 수
  let flying = false;   // 날고 있는 중(flyIn, flyOut). 그동안은 누르기를 받지 않는다
  let menu = null;      // 열린 오른쪽 단추 메뉴
  let raf = 0;
  let restTimer = 0;
  let callTimer = 0;
  let heartTimer = 0;
  let sayTimer = 0;
  let watchTimer = 0;
  let peckTimer = 0;
  let snubTimer = 0;
  let popTimer = 0;
  let headRows = 0;     // 앉은 그림에서 맨 위 칠한 줄까지의 빈 줄 수. 말풍선을 머리 바로 위에 띄운다
  const twice = doubleClick();
  const mood = () => moodOf(species);
  const leader = () => host.leader?.() || host.avatar();

  // 고른 펫으로 그림과 하트 높이를 맞춘다. 펫 바꾸기 창에서 바꾸거나 병아리가 자라면 os.js가 다시 부른다(자리는 그대로다).
  // 처음이거나 다른 종류를 골랐으면 새 펫이라 그 종류가 처음 하는 일(follow면 따라오기, 아니면 혼자 놀기)로 돌아간다.
  // 자라서 종류가 바뀐 것(병아리가 닭으로)은 같은 펫이라, 메뉴로 시킨 일이 있으면 그대로 하고 없으면 자란 종류가 처음 하는 일로 바뀐다
  function restyle() {
    const choice = petChoice(host.look?.());
    const was = species;
    species = choice.species;
    puppet.look(choice);
    heart.style.setProperty('--dy', heartRise(species.sit)); // h()로 넣은 CSS 변수는 빠지므로 setProperty로 넣는다(known-issues 50)
    headRows = Math.max(0, species.sit.findIndex(row => /[^.]/.test(row)));
    if (!mood().perch) {
      aim = null;
      if (perch) drop(); // 가구 위에 있다가 올라가지 않는 종류로 바뀌었다
    }
    const grew = was?.grow === species.id;
    if (was && was.id !== species.id) closeMenu(); // 열려 있던 메뉴의 점은 바뀌기 전 펫의 할 일이다
    if (!was || (was.id !== species.id && !(grew && told && mood().obey))) {
      told = false;
      assign(mood().follow ? 'follow' : 'free');
    }
  }

  const avatarAt = (x, y) => { const s = host.avatar()?.spot(); return !!s && s.x === x && s.y === y; };
  const claimsOf = o => o.claims?.() || o.cells();
  const others = () => host.others?.() || [];
  // 다른 펫이 차지한 칸과 그 둘레 한 칸. 바로 옆 칸에 서면 두 그림이 화면에서 겹쳐 앞뒤가 엉키므로 한 칸 떨어진다
  const crowded = (x, y) => others().some(o => claimsOf(o).some(c => Math.abs(c.x - x) <= 1 && Math.abs(c.y - y) <= 1));
  // 혼자 놀거나 기다리는 펫이 들어갈 수 있는 칸: 방 안이고 벽에 붙은 줄이 아니며, 가구와 아바타가 없고 다른 펫과 붙지 않은 칸
  const open = (x, y) => x > 0 && y > 0 && x < N && y < N && !blocked.has(key(x, y)) && !avatarAt(x, y) && !crowded(x, y);
  // 따라오는 펫이 설 수 있는 칸: 방 안(아바타가 서는 벽에 붙은 줄도 된다)이고 가구와 다른 펫이 없는 칸. 아바타와는 겹쳐도 된다(서로 지나간다).
  // 뒤를 밟는 앞선 펫(줄지어 따라올 때)이 걸어 나가는 칸은 비어 가는 칸이라 막지 않는다
  const stand = (x, y) => x >= 0 && y >= 0 && x < N && y < N && !blocked.has(key(x, y))
    && !others().some(o => o !== leader() && claimsOf(o).some(c => c.x === x && c.y === y));
  // 벽 앞(벽에 붙은 줄 바로 앞 줄)이나 가구 옆 칸인지. 겁 많은 펫(mood.edge)이 혼자 놀 때 고르는 칸이다
  const edgy = (x, y) => x === 1 || y === 1 || DIRS.some(([dx, dy]) => blocked.has(key(x + dx, y + dy)));

  // 발끝 자리 q(무대 px)에 선 그림이 화면에서 차지하는 네모(무대 px). 그림의 아래 가운데가 발끝이다
  const rectOf = q => ({ l: q.x - (size * PET_COLS) / 2, t: q.y - size * PET_ROWS, r: q.x + (size * PET_COLS) / 2, b: q.y });
  // 칸 c에 선 그림의 네모. 발끝은 칸 가운데다
  const rectAt = c => rectOf(tile(c.x + 0.5, c.y + 0.5));
  const floorOf = s => ({ x: Math.floor(s.x), y: Math.floor(s.y) }); // 가구 위 자리 s의 발끝이 든 칸
  // 가구 위 자리 p에 앉은 발끝 자리(무대 px). 바닥의 그 자리보다 윗면 높이만큼 위다
  const perchPoint = p => { const q = tile(p.x, p.y); return { x: q.x, y: q.y - p.h }; };
  // 가구 위 자리 p가 그 가구의 자리인지. it은 방의 가구나 적어 둔 { id, x, y, r }이다
  const onItem = (p, it) => !!p && p.item.id === it.id && p.item.x === it.x && p.item.y === it.y && !p.item.r === !it.r;

  // 가구 위 자리 p에 앉은 그림(네모 rect)의 순서. 그 가구 바로 위에 그리고, 가구 위 물건 가운데 뒤의 것보다 위, 앞의 것보다 아래다
  // (src/room.js의 zOf가 책상 위 물건에 매기는 순서와 같은 셈이다). 그림이 겹치는 뒤쪽 가구보다도 위다(depthZ).
  // 그 가구가 방에 없으면(옮겨서 뛰어내리는 중) 바닥처럼 depthZ로만 정한다
  function perchZ(p, rect) {
    const items = host.items();
    const c = floorOf(p);
    const it = items.find(i => onItem(p, i));
    return Math.max(depthZ(items, c, rect), it ? zOf(items, it) + 1 + Math.round((c.x + c.y + 1) * 3) : 0);
  }

  // 지금 자리(pos)에 그리고 가구와의 앞뒤를 정한다. 아바타와 겹치면 앞에 선 쪽이 위에 오게 아바타가 order를 다시 부른다.
  // p는 발끝 자리(무대 px)다. 날거나 가구 위에 있을 때는 바닥에서 떠 있으므로 바닥 칸(pos) 대신 그 점을 넘긴다.
  // z는 가구와의 앞뒤로 정한 순서다. 가구 위에서는 perchZ를 넘긴다
  function draw(at, w, d, rect, p = tile(pos.x + 0.5, pos.y + 0.5), z = depthZ(host.items(), at, rect)) {
    el.style.left = `${Math.round(p.x)}px`;
    el.style.top = `${Math.round(p.y)}px`;
    el.classList.toggle('flip', right);
    if (!bubble.hidden) placeBubble(p);
    foot = { at, w, d, rect };
    base = z;
    el.style.zIndex = base;
    host.avatar()?.restack();
  }

  // 말풍선을 머리 위에 띄운다. 꼬리 끝이 그림의 맨 위 칠한 줄 바로 위에 오게 한다(아바타의 sayPoint와 같은 4px 틈)
  function placeBubble(p) {
    bubble.style.left = `${Math.round(p.x)}px`;
    bubble.style.top = `${Math.round(p.y - size * (PET_ROWS - headRows) - 4)}px`;
  }

  // 지금 칸에 앉는다. 가구 위에 있으면 그 자리에 웅크린다
  function sit() {
    size = petCell();
    if (perch) {
      const q = perchPoint(perch);
      const rect = rectOf(q);
      pos = { x: perch.x - 0.5, y: perch.y - 0.5 };
      el.dataset.perch = perch.item.id;
      puppet.pose('loaf');
      draw(cell, 1, 1, rect, q, perchZ(perch, rect));
      return;
    }
    delete el.dataset.perch;
    pos = { ...cell };
    puppet.pose('sit');
    draw(cell, 1, 1, rectAt(cell));
  }

  // 할 일을 next로 바꾼다. 방에 있으면 바로 시작하고, 걷던 중이면 들어가던 칸까지 마저 걸은 뒤(settle) 시작한다
  function assign(next) {
    mode = next;
    stopMode();
    if (!cell || !el.isConnected || flying) return;
    if (walking) {
      route = [];
      aim = null;
      return;
    }
    begin();
  }

  // 할 일의 타이머(쉬기, 바닥 쪼기, 앞선 이 지켜보기)를 모두 멈추고 따라오던 길을 버린다
  function stopMode() {
    clearTimeout(restTimer);
    clearTimeout(peckTimer);
    clearInterval(watchTimer);
    watchTimer = 0;
    trail = [];
    seen = null;
    if (cell && !walking) puppet.pose(perch ? 'loaf' : 'sit'); // 바닥을 쪼던 중이었으면 머리를 든다. 가구 위에서는 웅크린 채다
  }

  // 앉은 자리에서 지금 할 일을 시작한다. 혼자 놀 때는 쉬다가 걷고(닭은 그사이 바닥을 쫀다), 따라올 때는 앞선 이를 지켜보며, 기다릴 때는 앉아만 있는다.
  // 따라오다가 혼자 놀게 되면 벽에 붙은 줄에 앉아 있을 수도 있는데, 다음에 걸을 때(hop) 빈칸으로만 가므로 그 줄을 벗어난다.
  // 가구 위에서 따라오게 되면 먼저 뛰어내린다(내려앉은 뒤 settle이 다시 부른다). 기다리게 하면 가구 위에서 기다린다
  function begin() {
    stopMode();
    if (perch && (mode === 'follow' || !mood().perch)) {
      descend();
      return;
    }
    if (mode === 'follow') {
      watchTimer = setInterval(watch, WATCH_MS);
      watch();
    } else if (mode === 'free') {
      rest();
      peckLater();
    }
  }

  // 혼자 놀 때 앉아서 쉬다가 다시 걷는다. 가구 위에서는 PERCH.stay 동안 웅크리고 있다가 뛰어내린다. 움직임 줄이기를 켠 사람에게는 앉아만 있는다
  function rest() {
    clearTimeout(restTimer);
    if (reduceMotion) return;
    const [a, b] = perch ? PERCH.stay : host.rest || mood().rest;
    restTimer = setTimeout(wander, a + Math.random() * (b - a));
  }

  // 혼자 놀며 앉아 있는 동안 가끔 머리를 숙여 바닥을 두 번 쫀다(mood.peck, 닭). 움직임 줄이기를 켠 사람에게는 쪼지 않는다
  function peckLater() {
    clearTimeout(peckTimer);
    if (reduceMotion || !mood().peck || mode !== 'free') return;
    peckTimer = setTimeout(() => {
      if (walking || waiting || !cell) {
        peckLater();
        return;
      }
      let n = 0;
      const bob = () => {
        puppet.pose(n % 2 ? 'sit' : 'peck');
        n += 1;
        peckTimer = setTimeout(n < 4 ? bob : peckLater, PECK_MS);
      };
      bob();
    }, PECK_GAP[0] + Math.random() * (PECK_GAP[1] - PECK_GAP[0]));
  }

  // 발끝 자리 a에서 b까지(무대 px) 날개를 치며 난다. 길과 빠르기는 flightAt, 나타나고 사라지는 것은 flightSeen이다.
  // 가구와의 앞뒤는 나는 내내 바닥 쪽 끝 칸 at(내려앉을 칸이나 날아오른 칸)으로 정한다. 공중의 새는 그 칸 앞의 낮은 가구보다 위에 있어서,
  // 날아가는 아래 바닥 자리로 정하면 창문 아래 침대 같은 가구 뒤로 숨어 버린다. 다 날면 then을 부른다.
  // ms를 주면 그 시간 동안 난다. 없으면 거리로 정한다(flyMs)
  function flight(a, b, at, fade, then, ms = flyMs(a, b)) {
    cancelAnimationFrame(raf);
    stopMode();
    puppet.live(false);
    flying = true;
    el.classList.add('flying');
    size = petCell();
    right = b.x > a.x;
    const half = (size * PET_COLS) / 2;
    const t0 = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - t0) / ms); // 지난 시간으로 계산해 프레임이 적은 창에서도 제시간에 닿는다(known-issues 23)
      const p = flightAt(a, b, k, fade);
      el.style.opacity = String(flightSeen(now - t0, ms, fade));
      puppet.pose(Math.floor((now - t0) / FLAP_MS) % 2 ? 'fly2' : 'fly1');
      draw(at, 1, 1, { l: p.x - half, t: p.y - size * PET_ROWS, r: p.x + half, b: p.y }, p);
      if (k < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }
      landed();
      then();
    };
    raf = requestAnimationFrame(tick);
  }
  // 날기를 마치거나 멈춘다
  function landed() {
    flying = false;
    el.classList.remove('flying');
    el.style.opacity = '';
  }

  // 펫 칸에서 넓이 우선으로 훑어, pass(x, y)인 칸만 지나 goal(x, y)을 처음 만족하는 칸까지의 길(펫 칸은 빼고 다 와서 설 칸까지).
  // 펫 칸이 goal이면 [], 갈 수 없으면 null
  function pathFrom(goal, pass) {
    if (goal(cell.x, cell.y)) return [];
    const prev = new Map([[key(cell.x, cell.y), null]]);
    const queue = [cell];
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      for (const [dx, dy] of DIRS) {
        const n = { x: c.x + dx, y: c.y + dy };
        if (prev.has(key(n.x, n.y)) || !pass(n.x, n.y)) continue;
        prev.set(key(n.x, n.y), c);
        if (goal(n.x, n.y)) {
          const out = [];
          for (let p = n; p !== cell; p = prev.get(key(p.x, p.y))) out.unshift(p);
          return out;
        }
        queue.push(n);
      }
    }
    return null;
  }

  // 혼자 놀 때 지금 칸에서 길을 따라 mood.hop칸 떨어진 빈칸 하나를 무작위로 골라 그 칸까지의 길을 돌려준다(지금 칸은 빼고). 갈 곳이 없으면 빈 길.
  // host.roam이 있으면 그것이 참인 칸만 지나고 고른다. 겁 많은 펫(mood.edge)은 그 가운데 벽 앞이나 가구 옆 칸을 고르고, 그런 칸이 없을 때만 아무 칸으로 간다
  function hop() {
    const [least, most] = mood().hop;
    const prev = new Map([[key(cell.x, cell.y), null]]);
    const dist = new Map([[key(cell.x, cell.y), 0]]);
    const queue = [cell];
    const picks = [];
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      const dc = dist.get(key(c.x, c.y));
      if (dc >= least) picks.push(c);
      if (dc === most) continue;
      for (const [dx, dy] of DIRS) {
        const n = { x: c.x + dx, y: c.y + dy };
        if (!open(n.x, n.y) || (host.roam && !host.roam(n.x, n.y)) || prev.has(key(n.x, n.y))) continue;
        prev.set(key(n.x, n.y), c);
        dist.set(key(n.x, n.y), dc + 1);
        queue.push(n);
      }
    }
    const out = [];
    if (!picks.length) return out;
    const shy = mood().edge ? picks.filter(c => edgy(c.x, c.y)) : [];
    const pool = shy.length ? shy : picks;
    for (let c = pool[Math.floor(Math.random() * pool.length)]; c !== cell; c = prev.get(key(c.x, c.y))) out.unshift(c);
    return out;
  }

  // 혼자 놀 때 쉬고 일어난다. 가구 위에 있으면 뛰어내리고(내려앉을 칸이 없으면 더 쉰다), 가구에 올라가는 펫(mood.perch)은 PERCH.odds의 몫으로
  // 가구 옆 칸까지 걸어가 뛰어오른다(perchTrip, climb). 아니면 몇 칸 떨어진 빈칸으로 걷는다(hop)
  function wander() {
    if (!cell || waiting || mode !== 'free') return;
    clearTimeout(peckTimer);
    if (perch) {
      if (!descend()) rest();
      return;
    }
    const trip = mood().perch && Math.random() < PERCH.odds ? perchTrip() : null;
    route = trip || hop();
    if (route.length || aim) step();
    else begin();
  }

  // 지금 방에서 올라갈 수 있는 자리들(perch와 같은 모양). 다른 펫과 붙는 자리는 뺀다
  function perchSpots() {
    const items = host.items();
    const out = [];
    for (const it of items) {
      for (const s of perchesOf(items, it)) {
        const c = floorOf(s);
        if (!crowded(c.x, c.y)) out.push({ item: { id: it.id, x: it.x, y: it.y, r: it.r }, x: s.x, y: s.y, h: s.h });
      }
    }
    return out;
  }

  // 가구 위 자리 p가 지금 방에 그대로 있는지. 그 가구를 옮기거나 돌리거나 치웠으면, 또 그 칸에 물건을 올렸으면 거짓이다
  function holds(p) {
    const items = host.items();
    const it = items.find(i => onItem(p, i));
    return !!it && perchesOf(items, it).some(s => s.x === p.x && s.y === p.y);
  }

  // 가구 it 위의 자리 s로 뛰어오르거나 거기서 뛰어내릴 수 있는 바닥 칸들. 가구 둘레(모서리의 대각선 칸은 빼고)에서 칸 가운데가 자리와
  // LEAP_REACH칸 안이고 ok(x, y)인 칸이며, 자리에서 가까운 차례다
  function launchCells(it, s, ok) {
    const [w, d] = dims(it);
    const far = c => Math.hypot(c.x + 0.5 - s.x, c.y + 0.5 - s.y);
    const out = [];
    for (let x = it.x - 1; x <= it.x + w; x++) {
      for (let y = it.y - 1; y <= it.y + d; y++) {
        const side = (x === it.x - 1 || x === it.x + w) !== (y === it.y - 1 || y === it.y + d);
        if (side && far({ x, y }) <= LEAP_REACH && ok(x, y)) out.push({ x, y });
      }
    }
    return out.sort((a, b) => far(a) - far(b));
  }

  // 올라갈 자리 하나와 그 자리로 뛸 바닥 칸(jump)을 고른다. ok(x, y)인 칸에서 뛸 수 있는 자리 가운데 가구를 먼저 무작위로 고르고(가구마다 같은 몫),
  // 그 가구의 자리를 무작위로 고른다. 뛸 칸은 그 자리로 뛸 수 있는 칸 가운데 score(칸)가 가장 작은 칸이다. 고를 것이 없으면 null
  function choosePerch(ok, score) {
    const byItem = new Map();
    for (const s of perchSpots()) {
      const cells = launchCells(s.item, s, ok);
      if (!cells.length) continue;
      const jump = cells.reduce((m, c) => (score(c) < score(m) ? c : m));
      const k = key(s.item.x, s.item.y);
      if (!byItem.has(k)) byItem.set(k, []);
      byItem.get(k).push({ s, jump });
    }
    const groups = [...byItem.values()];
    if (!groups.length) return null;
    const g = groups[Math.floor(Math.random() * groups.length)];
    return g[Math.floor(Math.random() * g.length)];
  }

  // 혼자 놀다 가구로 갈 길. 지금 칸에서 빈칸만 지나 PERCH_REACH칸 안에 닿는 가구 옆 칸 가운데 한 곳까지의 길(지금 칸은 빼고, 이미 그 칸이면 빈 길)을
  // 돌려주고 올라갈 자리를 aim에 둔다. 갈 수 있는 자리가 없으면 null
  function perchTrip() {
    const prev = new Map([[key(cell.x, cell.y), null]]);
    const dist = new Map([[key(cell.x, cell.y), 0]]);
    const queue = [cell];
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      const dc = dist.get(key(c.x, c.y));
      if (dc === PERCH_REACH) continue;
      for (const [dx, dy] of DIRS) {
        const n = { x: c.x + dx, y: c.y + dy };
        if (!open(n.x, n.y) || prev.has(key(n.x, n.y))) continue;
        prev.set(key(n.x, n.y), c);
        dist.set(key(n.x, n.y), dc + 1);
        queue.push(n);
      }
    }
    const pick = choosePerch((x, y) => dist.has(key(x, y)), c => dist.get(key(c.x, c.y)));
    if (!pick) return null;
    aim = pick.s;
    const out = [];
    for (let c = pick.jump; !same(c, cell); c = prev.get(key(c.x, c.y))) out.unshift(c);
    return out;
  }

  // 방에 처음 나올 때 올라가 있을 자리를 고른다. 뛰어내릴 빈칸이 있고 그 칸까지 아바타가 걸어갈 수 있는 자리 가운데 하나다
  function startPerch() {
    const seen = reachable();
    const pick = choosePerch((x, y) => open(x, y) && (!seen || seen.has(key(x, y))), () => 0);
    if (!pick) return;
    perch = pick.s;
    cell = floorOf(pick.s);
  }

  // 발끝 자리 a에서 b까지(무대 px) 폴짝 뛰어 가구에 오르거나 내린다. 곧은 줄보다 (높이 차의 절반 + LEAP_ARC)만큼 솟는 활 모양으로 LEAP_MS 동안 뛴다.
  // c0과 c1은 뛰기 전과 뒤의 칸(가구 위면 발끝이 든 가구 칸)이다. 앞뒤 순서는 반을 뛸 때까지 za, 그 뒤로 zb가 정한다. 둘 다 뛰는 동안 그림이 지나는
  // 네모를 받아 뛰기 전 자리와 내려앉을 자리의 순서를 돌려준다. 다 뛰면 then을 부른다. 움직임 줄이기를 켠 사람에게는 부르지 않는다
  function leap(a, b, c0, c1, za, zb, then) {
    cancelAnimationFrame(raf);
    walking = true;
    size = petCell();
    if (b.x !== a.x) right = b.x > a.x;
    const lift = Math.abs(a.y - b.y) / 2 + LEAP_ARC;
    const half = (size * PET_COLS) / 2;
    const sweep = { l: Math.min(a.x, b.x) - half, t: Math.min(a.y, b.y) - lift - size * PET_ROWS, r: Math.max(a.x, b.x) + half, b: Math.max(a.y, b.y) };
    const at = { x: Math.min(c0.x, c1.x), y: Math.min(c0.y, c1.y) };
    const [w, d] = [Math.abs(c0.x - c1.x) + 1, Math.abs(c0.y - c1.y) + 1];
    const z = [za(sweep), zb(sweep)];
    const t0 = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - t0) / LEAP_MS); // 지난 시간으로 계산해 프레임이 적은 창에서도 제시간에 닿는다(known-issues 23)
      const p = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - lift * 4 * k * (1 - k) };
      puppet.pose(k < 0.5 ? 'walk1' : 'walk2');
      draw(at, w, d, sweep, p, z[k < 0.5 ? 0 : 1]);
      if (k < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }
      from = null;
      then();
    };
    raf = requestAnimationFrame(tick);
  }

  // 가구 옆 칸에 다 와서 올라갈 자리(aim)로 뛰어오른다. 그사이 그 자리가 없어졌으면(가구를 옮겼으면) 그 칸에 앉는다
  function climb() {
    const p = aim;
    aim = null;
    if (!holds(p) || !mood().perch) {
      settle();
      return;
    }
    const start = cell;
    perch = p;
    cell = floorOf(p);
    if (reduceMotion) {
      settle();
      return;
    }
    from = start;
    leap(tile(start.x + 0.5, start.y + 0.5), perchPoint(p), start, cell, rect => depthZ(host.items(), start, rect), rect => perchZ(p, rect), settle);
  }

  // 가구 위 자리 p에서 뛰어내릴 바닥 칸. 그 자리 바로 아래 칸이 비었으면(가구를 옮기거나 치웠으면) 그 칸이고, 아니면 가구 둘레의 빈칸 가운데
  // 뛸 수 있는 거리 안에서 가장 가까운 칸, 그것도 없으면 방에서 가장 가까운 빈칸이다. 빈칸이 하나도 없으면 null
  function landing(p) {
    const c = floorOf(p);
    if (open(c.x, c.y)) return c;
    return launchCells(p.item, p, open)[0] || pickCell(c);
  }

  // 가구에서 뛰어내린다. 내려앉을 칸(landing)으로 뛰고, 내려앉으면 하던 일을 이어 간다(settle). 움직임 줄이기를 켠 사람에게는 뛰지 않고 그 칸에 바로 앉는다.
  // 내려앉을 칸이 없으면 그대로 있고 false를 돌려준다
  function descend() {
    const p = perch;
    const to = p && landing(p);
    if (!to) return false;
    stopMode();
    const start = cell;
    perch = null;
    cell = to;
    if (reduceMotion) {
      settle();
      return true;
    }
    from = start;
    leap(perchPoint(p), tile(to.x + 0.5, to.y + 0.5), start, to, rect => perchZ(p, rect), rect => depthZ(host.items(), to, rect), settle);
    return true;
  }

  // 가구 위에 있다가 올라가지 않는 종류로 바뀌면(펫 바꾸기 창) 뛰지 않고 내려앉을 칸(landing)에 바로 앉는다.
  // 방에 없으면 다음에 붙일 때(attach) 가장 가까운 빈칸을 고른다
  function drop() {
    const p = perch;
    perch = null;
    if (!el.isConnected) return;
    cancelAnimationFrame(raf);
    walking = false;
    from = null;
    cell = landing(p);
    if (cell) sit();
    else detach();
  }

  // 따라올 때 앞선 이를 지켜본다(WATCH_MS마다). 앞선 이가 옮겨 갔으면 길을 고치고, 앉아 있는데 길이 LAG칸보다 길면 걷기 시작한다.
  // 움직임 줄이기를 켠 사람에게는 걷지 않고, 앞선 이가 SETTLE_MS 동안 서 있으면 그 바로 뒤 칸에 나타난다
  function watch() {
    const s = leader()?.spot();
    if (!s || !cell || !el.isConnected || flying || perch) return; // 가구 위에서는 내려올 칸이 없어 내려오지 못한 것이다
    if (!seen || !same(s, seen)) {
      retrace(s);
      seen = { x: s.x, y: s.y };
      movedAt = performance.now();
    }
    if (walking || waiting || pending || trail.length <= LAG) return;
    if (!reduceMotion) step();
    else if (performance.now() - movedAt >= SETTLE_MS) appear();
  }

  // 앞선 이가 칸 s로 옮겨 갔을 때 따라오는 길을 고친다. 길은 앞선 이가 지나온 칸을 그대로 밟는다.
  //   펫 칸으로 들어왔으면 서로 자리를 바꾼다(앞선 이가 나온 칸으로 간다)
  //   펫 칸이나 길의 어느 칸 바로 옆으로 왔으면(돌아왔거나 모퉁이를 돌았으면) 그 칸 뒤의 길은 버린다
  //   한 칸 걸어 나갔으면 나온 칸을 길 끝에 더한다
  //   멀리 뛰었으면(다른 공간에서 돌아왔거나 처음 따라오기 시작했으면) 앞선 이의 바로 옆 칸까지 길을 새로 찾는다
  function retrace(s) {
    if (same(s, cell)) {
      trail = seen && near(seen, cell) ? [seen] : [];
      return;
    }
    const line = [cell, ...trail];
    const i = line.findIndex(c => near(c, s));
    if (i >= 0) {
      trail = line.slice(1, i + 1);
      return;
    }
    if (seen && near(seen, s) && near(seen, line[line.length - 1])) {
      trail.push(seen);
      return;
    }
    trail = chase(s) || [];
  }

  // 앞선 이(칸 s)의 바로 옆 칸까지 따라오는 펫이 갈 길. 앞선 이의 칸은 지나가지 않는다
  const chase = s => pathFrom((x, y) => near({ x, y }, s), (x, y) => stand(x, y) && !(x === s.x && y === s.y));

  // 따라올 때 다음에 들어갈 칸. 길이 LAG칸보다 길 때만 걷는다. 그 칸에 그사이 다른 펫이 들어왔으면 길을 새로 찾고, 그래도 막혔으면 null(앉아서 기다린다)
  function nextTrail() {
    if (waiting || pending || trail.length <= LAG) return null;
    if (!stand(trail[0].x, trail[0].y)) trail = (seen && chase(seen)) || [];
    if (trail.length <= LAG || !stand(trail[0].x, trail[0].y)) return null;
    return trail.shift();
  }

  // 움직임 줄이기를 켠 사람에게 따라오는 펫은 걷지 않고, 길 끝(앞선 이와 LAG칸 떨어진 칸)에 바로 나타난다
  function appear() {
    const c = trail[trail.length - 1 - LAG];
    if (!stand(c.x, c.y)) {
      trail = (seen && chase(seen)) || [];
      return;
    }
    right = c.x - c.y > cell.x - cell.y;
    trail = trail.slice(trail.length - LAG);
    cell = c;
    sit();
  }

  // 한 칸 걷는다. 혼자 놀 때는 남은 길(route)을, 따라올 때는 따라오는 길(trail)을 걷는다.
  // 길이 끝났거나 다음 칸에 그사이 가구나 아바타가 들어왔으면, 혼자 놀 때는 다음 칸이 그사이 다른 펫의 칸이나 그 둘레 한 칸이 되었어도 그 자리에 앉는다.
  // 길을 고른 뒤에 다른 펫(날아온 비둘기 떼)이 걸어와 옆에 붙는 일이 있어서 걸음마다 다시 본다. 가구로 가던 길이 끝났으면 뛰어오른다(climb)
  function step() {
    const follow = mode === 'follow';
    const to = follow ? nextTrail() : route.shift();
    if (!to || (!follow && !open(to.x, to.y))) {
      if (!to && !follow && aim) climb();
      else settle();
      return;
    }
    walking = true;
    const start = cell;
    from = start;
    cell = to;
    right = to.x - to.y > start.x - start.y; // 화면 오른쪽(오른쪽 아래, 오른쪽 위)으로 가면 오른쪽을 본다
    // 걷는 동안에는 아바타처럼 두 칸을 합친 자리로 앞뒤를 정해, 한 걸음 사이에 순서가 바뀌어 깜박이지 않게 한다
    size = petCell();
    const ms = follow ? FOLLOW_MS : STEP_MS;
    const at = { x: Math.min(start.x, to.x), y: Math.min(start.y, to.y) };
    const [a, b] = [rectAt(start), rectAt(to)];
    const sweep = { l: Math.min(a.l, b.l), t: Math.min(a.t, b.t), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) };
    const t0 = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - t0) / ms); // 지난 시간으로 계산해 프레임이 적은 창에서도 제시간에 닿는다(known-issues 23)
      pos = { x: start.x + (to.x - start.x) * t, y: start.y + (to.y - start.y) * t };
      puppet.pose(t < 0.5 ? 'walk1' : 'walk2');
      draw(at, start.x === to.x ? 1 : 2, start.y === to.y ? 1 : 2, sweep);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }
      from = null;
      step();
    };
    raf = requestAnimationFrame(tick);
  }

  // 걷기나 뛰기를 마치고 앉는다. 뛰어오르는 동안 아바타가 그 가구를 쓰러 왔으면 바로 뛰어내린다. 걷던 중에 두 번 눌렸으면 이제 아바타를 부르고,
  // 듣지 않는 명령을 받았으면 아바타를 쳐다본다. 따라오는 중이면 지켜보기(watch)가 다음 걸음을 정하고, 아니면 할 일을 처음부터 이어 간다
  function settle() {
    walking = false;
    route = [];
    aim = null;
    from = null;
    sit();
    if (leaving) {
      leaving = false;
      if (perch && descend()) return;
    }
    if (pending) {
      pending = false;
      call();
    } else if (snubbing) {
      snubbing = false;
      snub();
    } else if (!(mode === 'follow' && watchTimer)) {
      begin();
    }
  }

  // 아바타를 바로 옆 칸으로 불러 쓰다듬게 한다. 아바타가 없거나 갈 길이 없으면 그 자리에서 하트만 띄운다.
  // 날아온 비둘기(host.shy)는 쓰다듬기 대신 아바타가 다 오면 놀라 날아간다
  function call() {
    stopMode();
    clearTimeout(snubTimer);
    const then = host.shy ? () => { waiting = false; host.shy(); } : love;
    const walker = host.avatar();
    if (!walker?.spot()) { then(); return; }
    waiting = true;
    clearTimeout(callTimer);
    callTimer = setTimeout(() => { waiting = false; begin(); }, CALL_MS);
    walker.approachCell({ x: cell.x, y: cell.y }, then);
  }

  // 쓰다듬는 아바타 쪽을 보고 1초 동안 눈을 감으며, 머리 위에 하트를 띄우고 종류마다의 소리를 낸다. 기니피그(mood.pop)는 제자리에서 두 번 폴짝 뛴다.
  // 쓰다듬은 횟수는 host.pat이 센다. 이번에 다 자라면 그 안에서 restyle이 불려 그림이 바뀌므로, 하트 높이를 자란 그림에 맞추려고 먼저 부른다.
  // 소리도 그 뒤에 골라서, 소리가 없는 병아리도 열 번째에 닭이 되는 순간에는 닭 소리를 낸다
  function love() {
    if (!cell || !el.isConnected) return;
    waiting = false;
    clearTimeout(callTimer);
    host.pat?.();
    if (species.sound) play(species.sound);
    const s = host.avatar()?.spot();
    if (s) right = s.x - s.y > cell.x - cell.y;
    sit();
    puppet.shut(true);
    heart.style.left = el.style.left;
    heart.style.top = el.style.top;
    heart.style.setProperty('--dy', heartRise(perch ? species.loaf : species.sit)); // 웅크린 그림은 머리가 한 칸 낮다
    heart.style.setProperty('--dx', right ? HEAD_DX : -HEAD_DX); // h()로 넣은 CSS 변수는 빠지므로 setProperty로 넣는다(known-issues 50)
    heart.hidden = true;
    void heart.offsetWidth; // 연달아 쓰다듬으면 떠오르기를 처음부터 다시 한다
    heart.hidden = false;
    if (mood().pop && !reduceMotion) {
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
      clearTimeout(popTimer);
      popTimer = setTimeout(() => el.classList.remove('pop'), POP_MS);
    }
    clearTimeout(heartTimer);
    heartTimer = setTimeout(() => {
      heart.hidden = true;
      puppet.shut(false);
    }, HEART_MS);
    begin();
  }

  // 두 번 누르거나 메뉴에서 "쓰다듬기"를 고르면 쓰다듬는다. 걷던 중이면 들어가던 칸까지 마저 걷고 settle에서 부른다. 나는 동안에는 받지 않는다
  function pat() {
    if (!cell || waiting || pending || flying) return;
    // 소리는 아바타가 다 걸어온 뒤에 내지만, 사파리가 막지 않게 누른 지금 만들어 둔다(src/sound.js의 prime).
    // 이번에 자라면 자란 종류의 소리를 내므로 그 소리도 만든다. 날아온 비둘기는 놀라 날아갈 때 이 소리를 낸다(src/pigeon.js)
    prime(...[species, PET_SPECIES.find(s => s.id === species.grow)].map(s => s?.sound).filter(Boolean));
    if (walking) {
      route = [];
      aim = null;
      pending = true;
    } else {
      call();
    }
  }
  // 한 번 누르기는 가구처럼 아무것도 하지 않는다
  el.addEventListener('click', () => {
    if (twice(el)) pat();
  });

  // 메뉴에서 할 일을 시킨다. 아바타가 말로 시키고, 명령을 듣는 펫은 그 일을 한다. 듣지 않는 펫은 쳐다보기만 한다(snub). 이미 하는 일이면 아무것도 하지 않는다
  function command(next, words) {
    if (next === mode) return;
    host.avatar()?.say(words);
    if (!mood().obey) {
      snub();
      return;
    }
    told = true;
    assign(next);
  }

  // 명령을 듣지 않는 펫(mood.obey가 거짓, 고양이)은 아바타 쪽으로 고개를 돌려 SNUB_MS 동안 쳐다본 뒤 반대쪽으로 돌아서고,
  // 아바타가 "못 들은 척하네."라고 한다. 닌텐독스 + 캣츠의 고양이처럼 명령을 듣지 않아도, 들었다는 것은 보여야 고장 난 것처럼 보이지 않는다.
  // 걷던 중이면 들어가던 칸에 앉은 뒤 쳐다본다. 쳐다보는 동안에는 걷지 않는다
  function snub() {
    if (walking) {
      route = [];
      aim = null;
      snubbing = true;
      return;
    }
    const s = host.avatar()?.spot();
    if (!s || !cell) return;
    stopMode();
    clearTimeout(snubTimer);
    const look = s.x - s.y === cell.x - cell.y ? right : s.x - s.y > cell.x - cell.y; // 화면에서 같은 세로줄이면 보던 쪽 그대로다
    right = look;
    sit();
    snubTimer = setTimeout(() => {
      right = !look;
      sit();
      snubTimer = setTimeout(() => {
        host.avatar()?.say(IGNORED);
        begin();
      }, SNUB_MS / 2);
    }, SNUB_MS);
  }

  // 오른쪽 단추로 누르면 할 일 메뉴를 띄운다(host.menu가 있는 내 펫만). 나는 동안에는 띄우지 않는다.
  // 바탕화면의 메뉴(src/os.js)는 펫이 막아 둔 것(defaultPrevented)을 보고 그 자리에 바탕화면 메뉴를 띄우지 않는다
  if (host.menu) {
    el.addEventListener('contextmenu', e => {
      e.preventDefault(); // 브라우저의 메뉴 대신 띄운다
      if (cell && !flying) showMenu(e);
    });
  }

  // 할 일 메뉴(src/context-menu.js). 맨 위의 굵은 줄은 두 번 누를 때 하는 일(쓰다듬기)이고,
  // 그 아래 세 줄은 할 일이며 지금 하는 일 앞에 점이 찍힌다(ORDERS)
  function showMenu(e) {
    menu = openMenu(host.menu, e, [
      { label: '쓰다듬기', main: true, run: pat },
      '-',
      ...ORDERS.map(([next, label, words]) => ({ label, checked: mode === next, run: () => command(next, words) })),
    ], `${species.name} 메뉴`);
  }
  function closeMenu() {
    menu?.close();
    menu = null;
  }

  // 걷기, 날기, 할 일, 기다리기, 하트, 말풍선, 숨쉬기, 메뉴를 모두 멈춘다. 걷던 중이면 들어가던 칸에 선다. 할 일(mode)은 그대로 둔다
  function halt() {
    cancelAnimationFrame(raf);
    stopMode();
    clearTimeout(callTimer);
    clearTimeout(heartTimer);
    clearTimeout(sayTimer);
    clearTimeout(snubTimer);
    clearTimeout(popTimer);
    heart.hidden = true;
    bubble.hidden = true;
    el.classList.remove('pop');
    puppet.shut(false);
    puppet.live(false);
    if (flying) landed();
    walking = waiting = pending = snubbing = leaving = false;
    route = [];
    aim = null;
    from = null;
    closeMenu();
  }

  const detach = () => {
    el.remove();
    heart.remove();
    bubble.remove();
  };

  // 앉을 칸을 고른다. near가 있으면(앉아 있던 칸이 막혔거나 따라오던 아바타 옆에 설 때) 그 칸에서 가장 가까운 빈칸이고, 없으면(처음) 아바타가 걸어갈 수 있고
  // 아바타와 두 칸 넘게 떨어진 빈칸 가운데 하나를 무작위로 고른다(겁 많은 펫은 그 가운데 벽 앞이나 가구 옆 칸). 그런 칸이 없으면 아무 빈칸이고, 빈칸이 없으면 null
  function pickCell(near) {
    const cells = [];
    for (let x = 1; x < N; x++) for (let y = 1; y < N; y++) if (open(x, y)) cells.push({ x, y });
    if (!cells.length) return null;
    if (near) return cells.reduce((a, b) => (Math.abs(b.x - near.x) + Math.abs(b.y - near.y) < Math.abs(a.x - near.x) + Math.abs(a.y - near.y) ? b : a));
    const me = host.avatar()?.spot();
    let pool = cells;
    if (me) {
      const seen = reachable();
      const far = cells.filter(c => seen.has(key(c.x, c.y)) && Math.abs(c.x - me.x) + Math.abs(c.y - me.y) > 2);
      if (far.length) pool = far;
    }
    if (mood().edge) {
      const shy = pool.filter(c => edgy(c.x, c.y));
      if (shy.length) pool = shy;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // 아바타가 걸어갈 수 있는 칸들(가구가 없는 칸으로 이어진 칸)의 key 묶음. 아바타가 없으면 null
  function reachable() {
    const me = host.avatar()?.spot();
    if (!me) return null;
    const seen = new Set([key(me.x, me.y)]);
    const queue = [me];
    for (let i = 0; i < queue.length; i++) {
      for (const [dx, dy] of DIRS) {
        const n = { x: queue[i].x + dx, y: queue[i].y + dy };
        if (n.x < 0 || n.y < 0 || n.x >= N || n.y >= N || blocked.has(key(n.x, n.y)) || seen.has(key(n.x, n.y))) continue;
        seen.add(key(n.x, n.y));
        queue.push(n);
      }
    }
    return seen;
  }

  // 지금 차지한 칸들(걷는 동안은 나오는 칸과 들어가는 칸 둘). 다른 펫이 이 칸과 둘레를 피한다
  const claims = () => (cell && el.isConnected ? (from ? [from, cell] : [cell]) : []);

  restyle(); // 그림을 넣고 종류가 처음 하는 일을 정한다. 위의 칸 검사(open, stand)를 쓰므로 그것들을 만든 뒤에 부른다

  return {
    // 방을 다시 그린 뒤 아바타 다음에 부른다(펫이 아바타가 선 칸을 피해 앉는다). here: 펫이 사는 공간(내 방)인지.
    // 다른 공간에 나가 있는 동안에는 방에 없다가, 돌아오면 앉아 있던 칸에 다시 앉는다. 그 칸에 가구나 아바타가 있으면 가장 가까운 빈칸에 앉는다.
    // 따라오는 펫은 앞선 이 바로 옆이 아니면 앞선 이에게서 가장 가까운 빈칸에 앉는다(아바타를 따라 다른 공간에 다녀온 것처럼).
    // 가구 위에 있던 펫은 그 자리가 그대로면 다시 웅크리고, 그 가구를 옮기거나 돌리거나 치웠거나 그 칸에 물건을 올렸으면 뛰어내린다.
    // 가구에 올라가는 펫이 처음 나올 때는 PERCH.start의 몫으로 가구 위에서 시작한다
    attach(here) {
      halt();
      if (!here) { detach(); return; }
      blocked = blockedOf(host.items());
      const fell = perch && !holds(perch) ? perch : null;
      if (fell) {
        perch = null;
        cell = landing(fell);
      } else if (!perch) {
        if (!cell && mode === 'free' && mood().perch && Math.random() < PERCH.start) startPerch();
        const lead = mode === 'follow' ? leader()?.spot() : null;
        if (perch) {
          // 가구 위에서 시작한다
        } else if (lead && (!cell || !stand(cell.x, cell.y) || !near(cell, lead))) cell = pickCell(lead);
        else if (!cell || (mode === 'free' ? !open(cell.x, cell.y) : !stand(cell.x, cell.y) || avatarAt(cell.x, cell.y))) cell = pickCell(cell);
      }
      if (!cell) { detach(); return; }
      host.layer.append(el, heart);
      puppet.live(true);
      if (fell && !reduceMotion) {
        const to = cell;
        leap(perchPoint(fell), tile(to.x + 0.5, to.y + 0.5), floorOf(fell), to, rect => perchZ(fell, rect), rect => depthZ(host.items(), to, rect), settle);
        return;
      }
      sit();
      begin();
    },
    restyle,
    // 아바타가 지나가지 못하는 칸(src/avatar.js의 host.others). 따라오는 펫은 아바타의 길을 막지 않아 비어 있다
    cells: () => (mode === 'follow' ? [] : claims()),
    claims,
    // 앉은 칸(걷는 중에는 들어가는 칸). 줄지어 따라올 때 뒤의 펫이 이 펫을 앞선 이로 삼는다(host.leader). 방에 없으면 null
    spot: () => (cell && el.isConnected ? { x: cell.x, y: cell.y } : null),
    // 지금 할 일('free', 'follow', 'stay')
    mode: () => mode,
    // 아바타가 가구 item을 쓰러 왔다(src/os.js의 useFurniture). 그 가구(책상 위 물건이면 그 책상) 위에 있으면 뛰어내려 비킨다.
    // 뛰어오르던 중이면 다 오른 뒤 바로 내려오고(settle), 그 가구로 걸어가던 중이면 올라가지 않는다. 쓰다듬으러 오던 아바타는 기다리지 않는다
    vacate(item) {
      const base = supportOf(host.items(), item) || item;
      if (onItem(aim, base)) {
        aim = null;
        route = [];
      }
      if (!onItem(perch, base)) return;
      if (walking) {
        leaving = true;
        return;
      }
      clearTimeout(callTimer);
      waiting = false;
      descend();
    },
    // 아바타가 칸 at(걷는 동안은 두 칸을 합친 자리의 뒤쪽 모서리)에서 그림 네모 rect를 차지하고 순서 z로 그려지려 할 때 부른다(src/avatar.js의 draw).
    // 두 그림이 겹치면 앞에 선 쪽이 위에 오게 아바타의 순서를 돌려주고 펫의 순서를 고친다. 앞뒤는 가구와 같은 규칙(depthZ)으로 가린다
    order(at, rect, z) {
      if (!foot || !el.isConnected) return z;
      let mine = base;
      if (overlaps(rect, foot.rect)) {
        if (at.x >= foot.at.x + foot.w || at.y >= foot.at.y + foot.d) z = Math.max(z, base + 1);
        else mine = Math.max(base, z + 1);
      }
      el.style.zIndex = mine;
      return z;
    },
    // on이 참이면 그 자리에 멈춰 서고(할 일을 기다리기로 바꾼다. 걷던 중이면 들어가던 칸까지 마저 걷는다), 거짓이면 다시 혼자 논다.
    // 비둘기 떼(src/pigeon.js)가 다 내려앉을 때까지 앉아 있고, 놀라서 날아오르기 전에 멈칫할 때 쓴다
    hold: (on = true) => assign(on ? 'stay' : 'free'),
    // 창문이나 현관문(gate, src/pigeon.js)에서 날아 들어와 gate.near에서 가장 가까운 빈칸에 내려앉은 뒤 then을 부른다. gate.ms가 있으면 그 시간 동안 난다.
    // gate.at은 날기 시작하는 발끝 자리(무대 px)다. 내려앉을 칸은 날아오는 동안에도 차지한다(cells).
    // 내려앉을 칸이 없으면 들어오지 않고 false를 돌려준다. 움직임 줄이기를 켠 사람에게는 날지 않고 그 칸에 바로 나타난다
    flyIn(gate, then) {
      halt();
      blocked = blockedOf(host.items());
      cell = pickCell(gate.near);
      if (!cell) return false;
      host.layer.append(el, heart);
      const down = () => {
        sit();
        puppet.live(true);
        begin();
        then?.();
      };
      if (reduceMotion) down();
      else flight(gate.at, tile(cell.x + 0.5, cell.y + 0.5), cell, 'in', down, gate.ms);
      return true;
    },
    // 지금 자리에서 창문이나 현관문(gate)까지 날아가 사라진 뒤 then을 부른다. 날아오르면 칸을 비운다. gate.ms가 있으면 그 시간 동안 난다.
    // 날아오른 비둘기는 앉아 있는 비둘기보다 위에 그린다. 가구와의 앞뒤(z-index)가 같으면 상자 안에서 뒤에 든 그림이 위에 오므로 맨 뒤로 옮긴다.
    // 방에 없거나 움직임 줄이기를 켠 사람에게는 날지 않고 바로 사라진다
    flyOut(gate, then) {
      const at = cell && pos && el.isConnected ? { ...pos } : null;
      halt();
      cell = null;
      if (at) host.layer.append(el);
      const gone = () => {
        detach();
        then?.();
      };
      if (!at || reduceMotion) gone();
      else flight(tile(at.x + 0.5, at.y + 0.5), gate.at, at, 'out', gone, gate.ms);
    },
    // 머리 위 말풍선에 text를 ms 동안 띄운다(날아온 비둘기의 "구구"). 방에 없으면 띄우지 않는다
    say(text, ms) {
      if (!el.isConnected) return;
      bubble.textContent = text;
      bubble.hidden = false;
      host.layer.append(bubble); // 방을 다시 그리면 상자가 비워지므로 띄울 때마다 붙인다
      placeBubble({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) });
      clearTimeout(sayTimer);
      sayTimer = setTimeout(() => { bubble.hidden = true; }, ms);
    },
    destroy() {
      halt();
      detach();
    },
  };
}
