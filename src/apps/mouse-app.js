// 기본 앱: 마우스. 화면 안 커서의 색과 크기를 고르고, 화살표나 손가락을 32×32칸에 직접 그려 바꾼다.
// 고른 값은 settings의 cursor에 저장되고, src/cursors.js가 바로 다시 그려 화면과 열린 미니게임에 넣는다.
import { SIZE, KEYS, defaultPixels, cursorImage } from '../cursors.js';
import { h } from '../util.js';

const LINES = [null, '#000000', '#2a1f18', '#1d2733', '#6b2d5c', '#2f5d6e', '#ffffff'];
const FILLS = [null, '#ffffff', '#000000', '#f2e6cb', '#e8b84a', '#f4b6cf', '#a9d6e5', '#b9e0a5'];
const NAMES = { arrow: '화살표', hand: '손가락', grab: '잡기', grabbing: '끄는 중', wait: '기다림' };
const DRAWABLE = ['arrow', 'hand']; // 직접 그려 바꿀 수 있는 커서
const CELL = 8; // 그리기 판 한 칸의 크기(px)

export function openMouseApp(os, app) {
  const { settings } = os;
  const prefs = () => ({ line: null, fill: null, size: 1, custom: {}, ...settings.get('cursor') });
  const save = patch => settings.set({ cursor: { ...prefs(), ...patch } });

  return os.wm.open({
    key: app.id,
    app,
    title: '마우스',
    width: 640,
    height: 540,
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
      let tool = '1';
      let draft = null; // { px: 글자 배열, hot: [x, y] }
      const canvas = h('canvas', { className: 'mouse-canvas', width: SIZE * CELL, height: SIZE * CELL });
      const ctx = canvas.getContext('2d');
      const slotBtns = DRAWABLE.map(key => h('button', {
        type: 'button', className: 'btn mouse-slot', dataset: { slot: key }, onclick: () => { slot = key; loadDraft(); },
      }, NAMES[key]));
      const toolBtns = [['1', '테두리색'], ['0', '속 색'], ['.', '지우개'], ['hot', '누르는 점']].map(([t, label]) => h('button', {
        type: 'button', className: 'btn mouse-tool', dataset: { tool: t }, onclick: () => { tool = t; sync(); },
      }, label));
      const note = h('p', { className: 'meta mouse-note' });

      function loadDraft() {
        const saved = prefs().custom?.[slot];
        const src = saved?.px?.length === SIZE * SIZE ? saved : defaultPixels(slot);
        draft = { px: [...src.px], hot: [...(src.hot || [0, 0])] };
        sync();
      }

      function drawBoard() {
        const p = prefs();
        const line = p.line || '#000000';
        const fill = p.fill || '#ffffff';
        for (let y = 0; y < SIZE; y++) {
          for (let x = 0; x < SIZE; x++) {
            const c = draft.px[y * SIZE + x];
            ctx.fillStyle = c === '1' ? line : c === '0' ? fill : ((x + y) % 2 ? '#d9d4c7' : '#ebe7dc');
            ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
          }
        }
        ctx.strokeStyle = '#e5534b';
        ctx.lineWidth = 2;
        ctx.strokeRect(draft.hot[0] * CELL + 1, draft.hot[1] * CELL + 1, CELL - 2, CELL - 2);
      }

      // 판 위 마우스 위치 → 칸. 볼록 화면에서도 보정된 좌표가 들어오므로 그대로 쓴다.
      const cellAt = e => {
        const r = canvas.getBoundingClientRect();
        const x = Math.floor(((e.clientX - r.left) / r.width) * SIZE);
        const y = Math.floor(((e.clientY - r.top) / r.height) * SIZE);
        return x >= 0 && y >= 0 && x < SIZE && y < SIZE ? [x, y] : null;
      };
      const paint = e => {
        const c = cellAt(e);
        if (!c) return;
        if (tool === 'hot') draft.hot = c;
        else draft.px[c[1] * SIZE + c[0]] = tool;
        drawBoard();
      };
      let painting = false;
      canvas.addEventListener('pointerdown', e => { if (e.button === 0) { painting = true; paint(e); } });
      canvas.addEventListener('pointermove', e => { if (painting && e.buttons & 1) paint(e); });
      const stop = () => { painting = false; };
      window.addEventListener('pointerup', stop);

      const actions = h('div', { className: 'mouse-actions' },
        h('button', { type: 'button', className: 'btn', onclick: () => {
          const d = defaultPixels(slot);
          draft = { px: [...d.px], hot: [...d.hot] };
          sync();
        } }, '기본 모양 불러오기'),
        h('button', { type: 'button', className: 'btn', onclick: () => { draft.px.fill('.'); sync(); } }, '모두 지우기'),
        h('button', { type: 'button', className: 'btn', onclick: () => {
          if (!draft.px.some(c => c !== '.')) { os.toast('빈 그림은 쓸 수 없습니다.'); return; }
          save({ custom: { ...prefs().custom, [slot]: { px: draft.px.join(''), hot: draft.hot } } });
          os.toast(`${NAMES[slot]} 커서를 내 그림으로 바꿨습니다.`);
        } }, '이 그림으로 쓰기'),
        h('button', { type: 'button', className: 'btn', onclick: () => {
          const custom = { ...prefs().custom };
          delete custom[slot];
          save({ custom });
          loadDraft();
        } }, '원래 커서로'),
      );

      // ---------- 화면 맞추기 ----------
      function sync() {
        const p = prefs();
        const era = settings.get('era');
        for (const t of tiles) t.img.style.backgroundImage = cursorImage(t.key, era, p);
        for (const b of body.querySelectorAll('.swatch')) b.classList.toggle('on', (p[b.dataset.field] || '') === b.dataset.color);
        for (const b of body.querySelectorAll('.mouse-size')) b.classList.toggle('on', +b.dataset.size === p.size);
        for (const b of slotBtns) b.classList.toggle('on', b.dataset.slot === slot);
        for (const b of toolBtns) b.classList.toggle('on', b.dataset.tool === tool);
        note.textContent = p.custom?.[slot] ? `${NAMES[slot]}: 내 그림을 쓰는 중` : `${NAMES[slot]}: 원래 커서를 쓰는 중`;
        drawBoard();
      }

      body.append(
        h('section', { className: 'mouse-preview' }, ...tiles.map(t => t.tile)),
        h('p', { className: 'meta' }, '칸 위에 마우스를 올리면 그 커서가 실제로 나옵니다.'),
        swatchRow('테두리', LINES, 'line'),
        swatchRow('속', FILLS, 'fill'),
        h('div', { className: 'mouse-row' },
          h('span', { className: 'mouse-label' }, '크기'), sizeBtn(1, '보통'), sizeBtn(1.5, '크게'),
          h('span', { className: 'grow' }),
          h('button', { type: 'button', className: 'btn', onclick: () => { save({ line: null, fill: null, size: 1, custom: {} }); loadDraft(); } }, '모두 처음대로')),
        h('div', { className: 'mouse-draw' },
          canvas,
          h('div', { className: 'mouse-side' },
            h('div', { className: 'mouse-label' }, '직접 그리기'),
            h('div', { className: 'mouse-btns' }, ...slotBtns),
            h('div', { className: 'mouse-btns' }, ...toolBtns),
            actions,
            note)),
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
