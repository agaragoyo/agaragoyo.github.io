// 기본 앱: 마우스. 화면 안 커서의 색과 크기를 고르고, 화살표나 손가락을 32×32칸에 직접 그려 바꾼다.
// 고른 값은 settings의 cursor에 저장되고, src/cursors.js가 바로 다시 그려 화면과 열린 미니게임에 넣는다.
// 배치는 그 시절 대화상자와 그림판을 따랐다: 제목 붙은 묶음(fieldset), 왼쪽 세로 도구, 실제 색이 보이는 색 칸,
// 오른쪽 아래 명령 버튼. 그림판처럼 왼쪽 버튼은 고른 칸으로, 오른쪽 버튼은 채울 색으로 칠한다.
import { SIZE, KEYS, defaultPixels, cursorImage, pixelImage, lineColor, fillColor } from '../cursors.js';
import { h } from '../util.js';

const LINES = [null, '#000000', '#2a1f18', '#1d2733', '#6b2d5c', '#2f5d6e', '#ffffff'];
const FILLS = [null, '#ffffff', '#000000', '#f2e6cb', '#e8b84a', '#f4b6cf', '#a9d6e5', '#b9e0a5'];
const NAMES = { arrow: '화살표', hand: '손가락', grab: '잡기', grabbing: '끄는 중', wait: '기다림' };
const DRAWABLE = ['arrow', 'hand']; // 직접 그려 바꿀 수 있는 커서
const CELL = 7; // 그리기 판 한 칸의 크기(px)
const SVG_NS = 'http://www.w3.org/2000/svg';

// 클릭 지점 도구 아이콘(빨간 과녁)
function targetIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', 'mouse-chip');
  svg.innerHTML = "<circle cx='8' cy='8' r='6' fill='none' stroke='#c0392b' stroke-width='1.6'/>"
    + "<path d='M8 0v5M8 11v5M0 8h5M11 8h5' stroke='#c0392b' stroke-width='1.6'/>";
  return svg;
}

export function openMouseApp(os, app) {
  const { settings } = os;
  const prefs = () => ({ line: null, fill: null, size: 1, custom: {}, ...settings.get('cursor') });
  const save = patch => settings.set({ cursor: { ...prefs(), ...patch } });
  const group = (title, ...children) => h('fieldset', { className: 'mouse-group' }, h('legend', {}, title), ...children);

  return os.wm.open({
    key: app.id,
    app,
    title: '마우스',
    width: 640,
    height: 712,
    build(body) {
      body.classList.add('mouse-app');

      // ---------- 미리보기: 칸마다 마우스를 올리면 그 커서가 나온다 ----------
      const tiles = KEYS.map(key => {
        const img = h('span', { className: 'mouse-big' });
        const tile = h('div', { className: 'mouse-tile', style: { cursor: `var(--cur-${key})` } }, img, h('span', {}, NAMES[key]));
        return { key, img, tile };
      });

      // ---------- 색과 크기 ----------
      const swatchRow = (label, colors, field) => h('div', { className: 'mouse-row' },
        h('span', { className: 'mouse-label' }, label),
        ...colors.map(c => h('button', {
          type: 'button',
          className: 'swatch' + (c ? '' : ' swatch-default'),
          style: c ? { background: c } : {},
          title: c || '시대 기본',
          dataset: { field, color: c || '' },
          onclick: () => save({ [field]: c }),
        }, c ? '' : '기본')));
      const sizeBtn = (size, label) => h('button', { type: 'button', className: 'btn mouse-size', dataset: { size }, onclick: () => save({ size }) }, label);

      // ---------- 직접 그리기 ----------
      let slot = 'arrow';
      let tool = '1'; // '1' 선 색, '0' 채울 색, '.' 투명, 'hot' 클릭 지점
      let draft = null; // { px: 글자 배열, hot: [x, y] }
      const canvas = h('canvas', { className: 'mouse-canvas', width: SIZE * CELL, height: SIZE * CELL });
      const ctx = canvas.getContext('2d');
      const slotBtns = DRAWABLE.map(key => h('button', {
        type: 'button', className: 'btn mouse-slot', dataset: { slot: key }, onclick: () => { slot = key; loadDraft(); },
      }, NAMES[key]));

      // 도구: 실제 색이 보이는 칸. 눌린 칸이 지금 왼쪽 버튼으로 칠하는 것이다.
      const chipLine = h('span', { className: 'mouse-chip' });
      const chipFill = h('span', { className: 'mouse-chip' });
      const tools = [
        ['1', chipLine, '선 색'],
        ['0', chipFill, '채울 색'],
        ['.', h('span', { className: 'mouse-chip mouse-chip-clear' }), '투명'],
        ['hot', targetIcon(), '클릭 지점'],
      ].map(([t, chip, label]) => h('button', {
        type: 'button', className: 'btn mouse-tool', dataset: { tool: t }, onclick: () => { tool = t; sync(); },
      }, chip, label));

      const real = h('span', { className: 'mouse-real' });
      const twice = h('span', { className: 'mouse-twice' });
      const hotText = h('span', {});
      const note = h('span', { className: 'meta' });

      function loadDraft() {
        const saved = prefs().custom?.[slot];
        const src = saved?.px?.length === SIZE * SIZE ? saved : defaultPixels(slot);
        draft = { px: [...src.px], hot: [...(src.hot || [0, 0])] };
        sync();
      }

      function drawBoard() {
        const p = prefs();
        const line = lineColor(settings.get('era'), p);
        const fill = fillColor(p);
        for (let y = 0; y < SIZE; y++) {
          for (let x = 0; x < SIZE; x++) {
            const c = draft.px[y * SIZE + x];
            ctx.fillStyle = c === '1' ? line : c === '0' ? fill : ((x + y) % 2 ? '#d9d4c7' : '#ebe7dc');
            ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
          }
        }
        // 클릭 지점: 빨간 과녁(칸 테두리와 가로세로 선)
        const [hx, hy] = draft.hot;
        const cx = hx * CELL + CELL / 2;
        const cy = hy * CELL + CELL / 2;
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + 0.5, Math.max(0, cy - 3 * CELL));
        ctx.lineTo(cx + 0.5, cy + 3 * CELL);
        ctx.moveTo(Math.max(0, cx - 3 * CELL), cy + 0.5);
        ctx.lineTo(cx + 3 * CELL, cy + 0.5);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeRect(hx * CELL + 1, hy * CELL + 1, CELL - 2, CELL - 2);
        // 미리보기(실제 크기, 두 배)
        const img = pixelImage(draft.px.join(''), line, fill);
        real.style.backgroundImage = img;
        twice.style.backgroundImage = img;
        hotText.textContent = `클릭 지점 (${hx}, ${hy})`;
      }

      // 판 위 마우스 위치 → 칸. 볼록 화면에서도 보정된 좌표가 들어오므로 그대로 쓴다.
      const cellAt = e => {
        const r = canvas.getBoundingClientRect();
        const x = Math.floor(((e.clientX - r.left) / r.width) * SIZE);
        const y = Math.floor(((e.clientY - r.top) / r.height) * SIZE);
        return x >= 0 && y >= 0 && x < SIZE && y < SIZE ? [x, y] : null;
      };
      let paintWith = null; // 누르고 있는 동안 칠하는 것('1', '0', '.', 'hot')
      let lastCell = null;
      const paint = e => {
        const c = cellAt(e);
        if (!c) { lastCell = null; return; }
        if (paintWith === 'hot') {
          draft.hot = c;
        } else {
          // 마우스를 빨리 움직이면 이벤트 사이 칸을 건너뛰므로, 앞 칸에서 이 칸까지 선으로 잇는다.
          const [x0, y0] = lastCell || c;
          const steps = Math.max(Math.abs(c[0] - x0), Math.abs(c[1] - y0), 1);
          for (let i = 0; i <= steps; i++) {
            const x = Math.round(x0 + ((c[0] - x0) * i) / steps);
            const y = Math.round(y0 + ((c[1] - y0) * i) / steps);
            draft.px[y * SIZE + x] = paintWith;
          }
          lastCell = c;
        }
        drawBoard();
      };
      canvas.addEventListener('pointerdown', e => {
        if (e.button === 0) paintWith = tool;
        else if (e.button === 2) paintWith = '0'; // 그림판처럼 오른쪽 버튼은 채울 색
        else return;
        e.preventDefault();
        lastCell = null;
        paint(e);
      });
      canvas.addEventListener('pointermove', e => { if (paintWith && e.buttons & 3) paint(e); });
      canvas.addEventListener('contextmenu', e => e.preventDefault()); // 오른쪽 버튼으로 칠할 때 메뉴가 뜨지 않게
      const stop = () => { paintWith = null; lastCell = null; };
      window.addEventListener('pointerup', stop);

      const command = (label, onclick, extra = '') => h('button', { type: 'button', className: 'btn' + extra, onclick }, label);
      const commands = h('div', { className: 'mouse-commands' },
        command('기본 모양 불러오기', () => {
          const d = defaultPixels(slot);
          draft = { px: [...d.px], hot: [...d.hot] };
          sync();
        }),
        command('모두 지우기', () => { draft.px.fill('.'); sync(); }),
        h('span', { className: 'grow' }),
        command('원래대로', () => {
          const custom = { ...prefs().custom };
          delete custom[slot];
          save({ custom });
          loadDraft();
        }),
        command('이 커서로 쓰기', () => {
          if (!draft.px.some(c => c !== '.')) { os.toast('빈 그림은 쓸 수 없습니다.'); return; }
          save({ custom: { ...prefs().custom, [slot]: { px: draft.px.join(''), hot: draft.hot } } });
          os.toast(`${NAMES[slot]} 커서를 내 그림으로 바꿨습니다.`);
        }, ' mouse-default'),
      );

      // ---------- 화면 맞추기 ----------
      function sync() {
        const p = prefs();
        const era = settings.get('era');
        for (const t of tiles) t.img.style.backgroundImage = cursorImage(t.key, era, p);
        for (const b of body.querySelectorAll('.swatch')) b.classList.toggle('on', (p[b.dataset.field] || '') === b.dataset.color);
        for (const b of body.querySelectorAll('.mouse-size')) b.classList.toggle('on', +b.dataset.size === p.size);
        for (const b of slotBtns) b.classList.toggle('on', b.dataset.slot === slot);
        for (const b of tools) b.classList.toggle('on', b.dataset.tool === tool);
        chipLine.style.background = lineColor(era, p);
        chipFill.style.background = fillColor(p);
        note.textContent = p.custom?.[slot] ? `${NAMES[slot]}: 내 그림을 쓰는 중` : `${NAMES[slot]}: 원래 커서를 쓰는 중`;
        drawBoard();
      }

      body.append(
        group('미리보기 (칸 위에 마우스를 올리면 그 커서가 실제로 나옵니다)',
          h('div', { className: 'mouse-preview' }, ...tiles.map(t => t.tile))),
        group('색과 크기',
          swatchRow('선 색', LINES, 'line'),
          swatchRow('채울 색', FILLS, 'fill'),
          h('div', { className: 'mouse-row' },
            h('span', { className: 'mouse-label' }, '크기'), sizeBtn(1, '보통'), sizeBtn(1.5, '크게'),
            h('span', { className: 'grow' }),
            command('모두 처음대로', () => { save({ line: null, fill: null, size: 1, custom: {} }); loadDraft(); }))),
        group('직접 그리기',
          h('div', { className: 'mouse-row' }, h('span', { className: 'mouse-label' }, '바꿀 커서'), ...slotBtns, h('span', { className: 'grow' }), note),
          h('div', { className: 'mouse-draw' },
            h('div', { className: 'mouse-tools' }, ...tools),
            canvas,
            h('div', { className: 'mouse-side' },
              h('span', {}, '실제 크기'), h('span', { className: 'mouse-view' }, real),
              h('span', {}, '두 배'), h('span', { className: 'mouse-view mouse-view-2' }, twice),
              hotText,
              h('span', { className: 'meta mouse-hot-note' }, '실제로 눌리는 칸'))),
          // 무대는 1280 고정 좌표라 줄바꿈 자리가 화면 크기와 상관없이 같다. 문장 경계에서 직접 끊는다.
          h('p', { className: 'meta' }, '왼쪽 버튼은 고른 칸, 오른쪽 버튼은 채울 색으로 칠합니다.', h('br'), '색은 위에서 바꾸면 그린 그림에도 들어갑니다.'),
          commands),
      );

      // 다른 곳(시대 바꾸기 등)에서 설정이 바뀌어도 미리보기를 맞춘다.
      const off = settings.subscribe(patch => { if ('era' in patch || 'cursor' in patch) sync(); });
      loadDraft();
      return () => {
        off();
        window.removeEventListener('pointerup', stop);
      };
    },
  });
}
