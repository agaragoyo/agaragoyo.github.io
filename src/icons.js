// 아이콘 그림. 기본 앱(data/apps.js의 icon: 'builtin:<이름>')은 아래 PIXEL의 픽셀 그림이고, 나머지는 앱 목록의 그림 경로를 쓴다.
//
// 픽셀 그림은 한 글자가 한 칸이고 '.'은 빈칸이다. 글자의 색은 아이콘마다 colors에 있다.
// 바탕화면(48px)과 시작 메뉴(24px)에는 24×24칸 그림을 2배와 1배로 쓰고, 창 제목과 작업 표시줄(16px)에는 16×16칸으로 따로 그린 그림을 쓴다.
// 창을 열지 않는 아이콘(나도 만들기, 내 컴퓨터로, 놀이터, 집으로)에는 16칸 그림이 없다.
// 겉선은 검은 선 대신 재료마다 그 색의 어두운 색으로 그리고, 24칸 그림에는 오른쪽 아래로 한 칸 민 옅은 그림자를 깐다.
// 그림은 칸의 가운데가 아니라 눈에 가운데로 보이는 자리에 놓았다.
// 그림을 감싸는 상자의 중심과 칠한 칸의 무게 중심, 그 둘의 가운데를 칸의 가운데에 맞췄다.
// 실제 윈도우 아이콘은 쓰지 않고 팀이 고른 모티프만 따서 새로 그렸다(2026-11-14, docs/requirements.md의 "정한 것").
const PIXEL = {
  // 방 꾸미기: 모니터와 색 팔레트
  room: {
    colors: {
      k: '#6f6a8c', W: '#ffffff', f: '#e6e4ee', g: '#c2bed3', G: '#8f8aa6', b: '#2f6ad8', B: '#4c8ff0', c: '#8ec8ff', C: '#e2f3ff', L: '#47d86a',
      K: '#9a5a26', p: '#f7cf8e', P: '#e3a55a', r: '#ff9aa8', R: '#ef3f5c', y: '#fff38a', Y: '#ffc72e', e: '#a6f0a0', E: '#3fbf5a', u: '#a8d8ff', U: '#2f86f0', m: '#ffb8de', M: '#ff6fb5',
    },
    24: [
      '........................',
      '........................',
      '..kkkkkkkkkkkkkkk.......',
      '.kWWWWWWWWWWWWWWfk......',
      '.kWkkkkkkkkkkkkkgk......',
      '.kWkbbbbbbbbCCbkgk......',
      '.kWkbbbbbbbCCbbkgk......',
      '.kWkBBBBBBCCBBBkgk......',
      '.kWkBBBBBCCBBBBkgk......',
      '.kWkccccCCccccckgk......',
      '.kWkcccCCcccccckgk......',
      '.kWkkkkkkkkkkkkkgk......',
      '.kWffffffffffffLgk......',
      '.kgggggggggggggggk......',
      '..kkkkkkkkkkkKKKKKKK....',
      '.......kfgGKKppyYpppKK..',
      '.......kfgKprRpYYpeEppK.',
      '.....kkkfgKpRRppppEEppK.',
      '....kfffffKpppppppppuUK.',
      '....kgggggKppKKpppppUUK.',
      '.....kkkkkKppKKppmMppPK.',
      '...........KKPPPPMMPKK..',
      '.............KKKKKKK....',
      '........................',
    ],
    16: [
      '................',
      '.kkkkkkkkkk.....',
      'kWWWWWWWWWfk....',
      'kWkkkkkkkkgk....',
      'kWkbbbbCbkgk....',
      'kWkBBBCBBkgk....',
      'kWkccCccckgk....',
      'kWkcCcccckKKKK..',
      'kWkkkkkkkKpYpEK.',
      'kgggggggKpRppppK',
      '.kkkkkkkKppKpUpK',
      '....kggkKPppppPK',
      '..kffffffKPPPPK.',
      '...kkkkkk.KKKK..',
      '................',
      '................',
    ],
  },
  // 나도 만들기: 비스듬히 본 빈 방과 반짝이(예전 방 아이콘의 뜻을 이었다)
  make: {
    colors: { k: '#8f6f4a', K: '#7a4e2a', p: '#fff4de', P: '#efd9ae', o: '#c99060', u: '#ff9cc0', b: '#8fcaf5', c: '#e6f6ff', Y: '#ffd23f', W: '#ffffff' },
    24: [
      '........................',
      '...................Y....',
      '..................YWY...',
      '..........kkkk.....Y....',
      '........kkppPPkk........',
      '......kkppppPPPPkk......',
      '....kkppppppPPPPPPkk....',
      '..kkppppppppPPPPPPPPkk..',
      '..kpppppppppPPPPPPPPPk..',
      '..kppppppcbpPPPPPPPPPk..',
      '..kppppcbbbpPPPPPPPPPk..',
      '..kppppbbbbpPPPPPPPPPk..',
      '..kppppbbpKKKKPPPPPPPk..',
      '..kpppppKKooooKKPPPPPk..',
      '..kpppKKooooooooKKPPPk..',
      '..kpKKoooouuuuooooKKPk..',
      '..KKoooouuuuuuuuooooKK..',
      '..KKoooouuuuuuuuooooKK..',
      '....KKoooouuuuooooKK....',
      '......KKooooooooKK......',
      '........KKooooKK........',
      '..........KKKK..........',
      '........................',
      '........................',
    ],
  },
  // 내 컴퓨터로: 베이지 모니터 화면에 작은 집
  computer: {
    colors: { k: '#8f7a5a', W: '#fffaf0', f: '#efe6d2', g: '#d9ccb0', L: '#47d86a', b: '#3d6fd1', c: '#6f98e6', R: '#ff7a9a', h: '#ffffff', d: '#c98a52' },
    24: [
      '........................',
      '........................',
      '...kkkkkkkkkkkkkkkkkk...',
      '..kWWWWWWWWWWWWWWWWWfk..',
      '..kWffffffffffffffffgk..',
      '..kWfkkkkkkkkkkkkkkfgk..',
      '..kWfkbbbbbbbbbbbbkfgk..',
      '..kWfkbbbbbRRbbbbbkfgk..',
      '..kWfkbbbbRRRRbbbbkfgk..',
      '..kWfkbbbRRRRRRbbbkfgk..',
      '..kWfkbbbbhhhhbbbbkfgk..',
      '..kWfkbbbbhddhbbbbkfgk..',
      '..kWfkcccchddhcccckfgk..',
      '..kWfkcccccccccccckfgk..',
      '..kWfkkkkkkkkkkkkkkfgk..',
      '..kWffffffffffffffLfgk..',
      '..kggggggggggggggggggk..',
      '...kkkkkkkkkkkkkkkkkk...',
      '.........kfffgk.........',
      '.......kWWWWWWWWk.......',
      '......kggggggggggk......',
      '.......kkkkkkkkkk.......',
      '........................',
      '........................',
    ],
  },
  // 놀이터: 앉아 있는 강아지
  playground: {
    colors: { k: '#9a6a45', W: '#fffaf2', f: '#f0e2cc', O: '#c98a52', o: '#e3ad74', n: '#2e211c', m: '#ff7f9a', R: '#ef4d68', Y: '#ffd23f' },
    24: [
      '........................',
      '........................',
      '........kkkkkkkk........',
      '......kkWWWWWWWWkk......',
      '.....kWWWWWWWWWWWWk.....',
      '...kkkWWWWWWWWWWWWkkk...',
      '..kOOkWWWWWWWWWWWWkOOk..',
      '..kOOkWWWWWWWoooWWkOOk..',
      '..kOokWWnnWWWonnoWkoOk..',
      '..kOokWWnnWWWonnoWkoOk..',
      '..kOokWWWWWnnWoooWkoOk..',
      '...kkkfWWWnmmnWWWfkkk...',
      '......kffWWmmWWffk......',
      '.......kRRRRRRRRk.......',
      '......kWWWWYYWWWWk..kk..',
      '.....kWWWWWWWWWWWWkkWWk.',
      '.....kWWWWWWWWWWWfWWk...',
      '.....kfWWWWWWWWWWfkk....',
      '.....kfWWkWWWWkWWfk.....',
      '.....kfWWkWWWWkWWfk.....',
      '.....kffWkWWWWkWffk.....',
      '......kkkkkkkkkkkk......',
      '........................',
      '........................',
    ],
  },
  // 집으로: 분홍 지붕 집
  home: {
    colors: { K: '#b04a68', r: '#ff9cb5', R: '#f06a8a', Q: '#d24f72', e: '#e98c6a', k: '#9a7a62', W: '#fff6e6', w: '#f2e0c2', d: '#9a5e2c', D: '#d39456', Y: '#ffd23f', X: '#ffffff', b: '#9fd8ff' },
    24: [
      '........................',
      '...........KK...........',
      '..........KrRK.KKKK.....',
      '.........KrrRRKKeeK.....',
      '........KrrrRRRKeeK.....',
      '.......KrrrrRRRRKeK.....',
      '......KrrrrrRRRRRKK.....',
      '.....KrrrrrrRRRRRRK.....',
      '....KrrrrrrrRRRRRRRK....',
      '...KQQQQQQQQQQQQQQQQK...',
      '..KKKKKKKKKKKKKKKKKKKK..',
      '....kwwwwwwwwwwwwwwk....',
      '....kWWWWWWWWWWWWWwk....',
      '....kWddddWWWkkkkkwk....',
      '....kWdDDdWWWkbXbkwk....',
      '....kWdDDdWWWkXXXkwk....',
      '....kWdDYdWWWkbXbkwk....',
      '....kWdDDdWWWkkkkkwk....',
      '....kWdDDdWWWWWWWWwk....',
      '....kWdDDdWWWWWWWWwk....',
      '....kkkkkkkkkkkkkkkk....',
      '........................',
      '........................',
      '........................',
    ],
  },
  // 미니게임: 분홍 게임기(방의 게임기 가구와 같은 모양)
  games: {
    colors: { k: '#c25a83', W: '#ffffff', p: '#ffd6e6', P: '#ffa8c8', Q: '#e9779f', n: '#5d5373', g: '#e6fff2', G: '#9fe6c4', R: '#ff4f86', u: '#5fb4ff', y: '#ffd23f' },
    24: [
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '...kkkkkkkkkkkkkkkkkk...',
      '..kpWWWppppppppppppppk..',
      '.kpPPPPnnnnnnnnnnPPPPQk.',
      '.kpPPPPnggGGGGGGnPPPPQk.',
      '.kpPPPPngGRGGRGGnPPuuQk.',
      '.kpPnPPnGRRRRRRGnPPuuQk.',
      '.kpnnnPnGRRRRRRGnyyPPQk.',
      '.kpPnPPnGGRRRRGGnyyPPQk.',
      '.kpPPPPnGGGRRGGGnPPPPQk.',
      '.kpPPPPnGGGGGGGGnPPPPQk.',
      '.kpPPPPnnnnnnnnnnPPPPQk.',
      '.kPQQQQQQQQQQQQQQQQQQQk.',
      '..kQQQQQQQQQQQQQQQQQQk..',
      '...kkkkkkkkkkkkkkkkkk...',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    16: [
      '................',
      '................',
      '................',
      '.kkkkkkkkkkkkkk.',
      'kpWWpppppppppppk',
      'kpPPPnnnnnnPPPQk',
      'kpPkPngGGGnPuPQk',
      'kpkkknGRRGnPPPQk',
      'kpPkPnGRRGnPPyQk',
      'kpPPPnGGGGnPPPQk',
      'kpPPPnnnnnnPPPQk',
      'kQQQQQQQQQQQQQQk',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
      '................',
    ],
  },
  // 공유하기: 하트로 봉한 편지 봉투
  share: {
    colors: { k: '#8a7fae', W: '#ffffff', f: '#f1edf9', g: '#cfc6e6', R: '#ff5d8f', r: '#ffa3c0', Q: '#d63c6e' },
    24: [
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '..kkkkkkkkkkkkkkkkkkkk..',
      '..kggWWWWWWWWWWWWWWggk..',
      '..kffggWWWWWWWWWWggffk..',
      '..kffffggWWWWWWggffffk..',
      '..kffffffRRWWRRffffffk..',
      '..kffffffrRRRRRffffffk..',
      '..kffffffRRRRRQffffffk..',
      '..kfffffffRRRQfffffffk..',
      '..kffffffffRQffffffffk..',
      '..kffffffggffggffffffk..',
      '..kffffggffffffggffffk..',
      '..kffggffffffffffggffk..',
      '..kggffffffffffffffggk..',
      '..kkkkkkkkkkkkkkkkkkkk..',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    16: [
      '................',
      '................',
      '................',
      'kkkkkkkkkkkkkkk.',
      'kggWWWWWWWWWggk.',
      'kffggWWWWWggffk.',
      'kffffgRWRgffffk.',
      'kfffffRRRfffffk.',
      'kffffggRggffffk.',
      'kffggfffffggffk.',
      'kggfffffffffggk.',
      'kfffffffffffffk.',
      'kkkkkkkkkkkkkkk.',
      '................',
      '................',
      '................',
    ],
  },
  // 배경음악: 시디 앞의 음표
  music: {
    colors: { k: '#7d86a3', K: '#b8336f', w: '#dde3ef', W: '#ffffff', g: '#b4bccf', G: '#8a90a8', h: '#f2f6fc', m: '#ffc2e2', y: '#fff3a8', c: '#b0f0ff', p: '#ffb3d6', P: '#ff6aa8', Q: '#d43f82' },
    24: [
      '........................',
      '............kkkkkk......',
      '..........kkcwwwwwkk....',
      '......KKKKKyccwwwwwwk...',
      '......KpPPPKyccwwwwwwk..',
      '......KpPPPPKyccwwwwwk..',
      '......KpPPPPPKhhhwwwwwk.',
      '......KpPKKPPKGGhhwwwwk.',
      '......KpPKmKPK..Ghcwwgk.',
      '......KpPKwKPK..Ghccggk.',
      '......KpPKwKQKGGhhyccgk.',
      '......KpPKwwKhhhhWWycck.',
      '......KpPKwwwwmmyWWWyk..',
      '......KpPKwwwwwmmyWWWk..',
      '......KpPKwwwwwgmmyWk...',
      '......KpPKkkwwgggmkk....',
      '...KKKKpPK..kkkkkk......',
      '..KpppPPPK..............',
      '.KpWpPPPPK..............',
      'KpppPPPPQK..............',
      'KPPPPPPQK...............',
      '.KQQQQQK................',
      '..KKKKK.................',
      '........................',
    ],
    16: [
      '................',
      '.......kkkkk....',
      '...KKKkWwwwwk...',
      '...KpPKcWWwwwwk.',
      '...KpPPKmWWwwggk',
      '...KpKPKwmhGhwgk',
      '...KpKKkwwG.Gwgk',
      '...KpK.kwwhGhcgk',
      '...KpK.kgwwwWWmk',
      '...KpK..kgwwWWgk',
      '...KpK...kggywk.',
      '.KKKpK....kkkkk.',
      'KpWPPK..........',
      'KPPPPK..........',
      '.KQQK...........',
      '..KK............',
    ],
  },
  // 실험실: 코르크 마개를 막은 삼각 플라스크와 초록 물약(시험 기능을 켜는 곳)
  labs: {
    colors: { k: '#4a8796', W: '#ffffff', f: '#eaf7fa', g: '#b9dde5', K: '#8f5a2c', p: '#d9a066', b: '#c8f7b8', L: '#6fdc6a', E: '#3cb85a', D: '#2a8a48' },
    24: [
      '........................',
      '........................',
      '........................',
      '.........KKKKKK.........',
      '.........KppppK.........',
      '........kKKKKKKk........',
      '........kWffffgk........',
      '.........kWffgk.........',
      '.........kWffgk.........',
      '.........kWffgk.........',
      '........kWfffggk........',
      '.......kWfffffggk.......',
      '......kWfffffffggk......',
      '.....kWbbbbbbbbbbEk.....',
      '....kWLLLLbLLLLLLEEk....',
      '...kWLLLLLLLLLLbLLEEk...',
      '..kWLLLbLLLLLLLLLLLEEk..',
      '..kLLLLLLLLLLLLLLLLEEk..',
      '..kEEEEEEEEEEEEEEEEDDk..',
      '...kkkkkkkkkkkkkkkkkk...',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
    16: [
      '................',
      '................',
      '......KKKK......',
      '.....kKppKk.....',
      '......kWgk......',
      '......kWgk......',
      '.....kWffgk.....',
      '....kWfffggk....',
      '...kbbbbbbbbk...',
      '..kWLLLLbLLEEk..',
      '.kWLLLLLLLLLEEk.',
      '.kLLLbLLLLLLEEk.',
      '.kEEEEEEEEEEDDk.',
      '..kkkkkkkkkkkk..',
      '................',
      '................',
    ],
  },
};

// 아이콘 자리 크기(px)마다 쓰는 그림의 칸 수
const SLOTS = { 48: 24, 24: 24, 16: 16 };

// 그림 한 칸이 화면 픽셀 정수 개가 되도록 자리마다 그림 크기를 고른다. main.js의 fit()이 무대 배율이 바뀔 때마다 부른다(known-issues 67).
// 무대는 창 크기에 맞춰 정수가 아닌 배율로 늘고 준다. 그대로 그리면 0.91배에서 한 칸이 1.82픽셀이 되어 어떤 칸은 1픽셀, 어떤 칸은 2픽셀이 되고,
// 한 칸이 1픽셀보다 작아지면 칸이 통째로 빠진다. 그래서 원래 크기의 0.7~1.4배 안에서 한 칸이 정수 픽셀이 되는 가장 가까운 크기로 그린다.
// 그런 크기가 없으면 원래 크기로 두고, 한 칸이 1픽셀보다 작을 때만 부드럽게 줄인다(칸이 빠지는 것보다 낫다).
// style: CSS 변수를 넣을 곳(document.documentElement.style), scale: 무대 배율, dpr: 화면 픽셀 비율(devicePixelRatio)
export function fitPixelIcons(style, scale, dpr) {
  for (const [slot, grid] of Object.entries(SLOTS)) {
    const raw = slot / grid * scale * dpr; // 그림 한 칸이 차지하는 화면 픽셀
    const k = [Math.floor(raw), Math.ceil(raw)]
      .filter(n => n >= 1 && n / raw >= 0.7 && n / raw <= 1.4)
      .sort((a, b) => Math.abs(Math.log(a / raw)) - Math.abs(Math.log(b / raw)))[0];
    style.setProperty(`--pixel-${slot}`, (k ? grid * k / (scale * dpr) : slot) + 'px');
    style.setProperty(`--pixel-${slot}-render`, k || raw >= 1 ? 'crispEdges' : 'auto');
  }
}

// 픽셀 그림 하나를 SVG 글로 만든다. 같은 색 칸이 가로로 이어지면 한 조각으로 묶는다.
const svgs = new Map();
function pixelSvg(name, grid) {
  const key = `${name}/${grid}`;
  if (svgs.has(key)) return svgs.get(key);
  const { colors, [grid]: rows } = PIXEL[name];
  const paths = {};
  const shadow = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < grid;) {
      let n = 1;
      while (row[x + n] === row[x]) n++;
      if (row[x] !== '.') (paths[row[x]] ??= []).push(`M${x} ${y}h${n}v1h-${n}z`);
      x += n;
    }
    // 그림자: 칠한 칸을 오른쪽 아래로 한 칸 민 자리(24칸 그림에만)
    if (grid === 24) for (const m of row.matchAll(/[^.]+/g)) shadow.push(`M${m.index + 1} ${y + 1}h${m[0].length}v1h-${m[0].length}z`);
  });
  const shade = shadow.length ? `<path fill="#00000033" d="${shadow.join('')}"/>` : '';
  const fills = Object.entries(paths).map(([c, d]) => `<path fill="${colors[c]}" d="${d.join('')}"/>`).join('');
  const svg = `<svg viewBox="0 0 ${grid} ${grid}" aria-hidden="true">${shade}${fills}</svg>`;
  svgs.set(key, svg);
  return svg;
}

// 아이콘 요소 하나. app: 앱 목록의 항목, size: 자리 크기(px)
export function iconEl(app, size = 48) {
  const box = document.createElement('span');
  box.className = 'app-icon';
  box.style.width = box.style.height = size + 'px';
  const name = app.icon?.startsWith('builtin:') ? app.icon.slice(8) : null;
  if (name && Object.hasOwn(PIXEL, name)) {
    const grid = size <= 16 && PIXEL[name][16] ? 16 : 24;
    box.classList.add('pixel');
    // 크기를 맞추는 자리(SLOTS)면 그 자리의 그림 크기를 쓴다. 16칸 그림이 없는 아이콘을 16px에 놓으면 칸이 빠지지 않게 부드럽게 줄인다
    if (SLOTS[size] === grid) box.dataset.slot = size;
    else if (grid > size) box.style.setProperty('--render', 'auto');
    box.innerHTML = pixelSvg(name, grid);
    return box;
  }
  const letter = () => {
    box.classList.add('letter');
    box.style.background = app.color || '#8a8fb0';
    box.style.fontSize = Math.round(size * 0.5) + 'px';
    box.textContent = [...app.title][0];
  };
  if (!app.icon || name) { letter(); return box; } // 그림이 없거나 PIXEL에 없는 기본 그림 이름이면 글자 타일
  const img = new Image();
  img.alt = '';
  img.draggable = false;
  img.onerror = () => { img.remove(); letter(); };
  img.src = app.icon;
  box.classList.add('picture');
  box.append(img);
  return box;
}
