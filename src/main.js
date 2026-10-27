// 시작점. 모니터(크기 맞추기, 테두리 버튼, 화면 효과, 전원)를 맡고, 화면 안쪽은 os.js에 넘긴다.
import { STAGE_W, STAGE_H, STORAGE_SETTINGS } from './config.js';
import { loadJSON, saveJSON } from './share.js';
import { initCRT } from './crt.js';
import { createOS } from './os.js';

const $ = sel => document.querySelector(sel);
const stage = $('#stage');

const mon = {
  scale: 1,
  rotated: false,
  // 화면 좌표를 1280×840 무대 좌표로 바꾼다.
  toLocal(clientX, clientY) {
    const r = stage.getBoundingClientRect();
    if (mon.rotated) {
      // 시계 방향으로 90도 돌린 상태: 무대 왼쪽 위 모서리가 화면의 오른쪽 위에 있고,
      // 무대의 x축은 화면 아래쪽, y축은 화면 왼쪽을 향한다.
      return { x: (clientY - r.top) / mon.scale, y: (r.right - clientX) / mon.scale };
    }
    return { x: (clientX - r.left) / mon.scale, y: (clientY - r.top) / mon.scale };
  },
};

// ---------- 화면 맞추기 ----------
// MARGIN: 화면 가장자리와 모니터 사이(px). PAD, CTRL: 모니터 테두리 두께와 아래 버튼 줄 높이(무대 px).
// 테두리도 무대와 같은 비율로 커지므로, 큰 모니터에서 테두리만 얇아 보이거나 스피커 구멍만 길어지지 않는다.
// style.css의 .viewport 회전 조건과 같아야 한다.
const PORTRAIT_PHONE = matchMedia('(orientation: portrait) and (hover: none) and (max-width: 900px)');

function fit() {
  mon.rotated = PORTRAIT_PHONE.matches;
  // 돌려 놓았으면 화면의 세로가 곧 모니터의 가로다.
  const W = mon.rotated ? innerHeight : innerWidth;
  const H = mon.rotated ? innerWidth : innerHeight;
  const viewport = $('#viewport');
  viewport.style.width = mon.rotated ? W + 'px' : '';
  viewport.style.height = mon.rotated ? H + 'px' : '';

  const MARGIN = 16;
  const TOP = mon.rotated ? 0 : 44; // 위쪽 시대 스위치 자리
  const PAD = 72;
  const CTRL = 108;
  const s = Math.max(0.2, Math.min((W - 2 * MARGIN) / (STAGE_W + 2 * PAD), (H - TOP - 2 * MARGIN) / (STAGE_H + PAD + CTRL)));
  const root = document.documentElement.style;
  root.setProperty('--margin', MARGIN + 'px');
  root.setProperty('--top', TOP + 'px');
  root.setProperty('--u', s + 'px');
  root.setProperty('--pad', PAD * s + 'px');
  root.setProperty('--ctrl', CTRL * s + 'px');
  mon.scale = s;
  const screen = $('#screen');
  screen.style.width = STAGE_W * s + 'px';
  screen.style.height = STAGE_H * s + 'px';
  stage.style.transform = `scale(${s})`;
  crt.apply();
}
addEventListener('resize', fit);
PORTRAIT_PHONE.addEventListener('change', fit);

// ---------- 테두리 버튼 설정 ----------
const settings = { grain: true, curve: true, night: false, era: '1998', ...loadJSON(STORAGE_SETTINGS) };

// ---------- 시대 ----------
// 같은 사이트를 두 시대 모습으로 보여 준다(팀 의견을 듣기 위한 비교용).
//   1998: 베이지 CRT, 윈도우 98식 회색 창, BIOS 부팅
//   2005: 은색 평면 CRT, XP 시절식 파란 창과 둥근 시작 버튼, 로고 부팅
// 주소에 ?era=2005 를 붙이면 그 시대로 열리고 설정에도 남는다.
// warp: 화면이 휘는 정도. 2005년식 완전평면 CRT는 유리 앞면이 평평해서 휘지 않는다(0이면 왜곡과 클릭 보정을 끈다).
const ERAS = { 1998: { warp: 0.06 }, 2005: { warp: 0 } };
const fromUrl = new URLSearchParams(location.search).get('era');
if (ERAS[fromUrl]) settings.era = fromUrl;
if (!ERAS[settings.era]) settings.era = '1998';
function applySettings() {
  for (const key of ['grain', 'curve']) {
    document.body.classList.toggle(key, !!settings[key]);
    $(`[data-toggle="${key}"]`).setAttribute('aria-pressed', String(!!settings[key]));
  }
  // 밤 모드: 스탠드나 가로등으로 켜고 끈다. 화면 안쪽(방 그림과 OS 창) 색이 바뀐다.
  stage.dataset.theme = settings.night ? 'night' : 'day';
  document.body.dataset.era = settings.era;
  for (const b of document.querySelectorAll('[data-era-pick]')) b.setAttribute('aria-pressed', String(b.dataset.eraPick === settings.era));
  crt.setStrength(ERAS[settings.era].warp);
}

// 화면을 실제로 휘는 볼록 효과는 지금은 마우스를 쓰는 PC에서만 켠다.
const HAS_MOUSE = matchMedia('(hover: hover) and (pointer: fine)');
const crt = initCRT({
  screen: $('#screen'),
  warpEl: $('#crt'),
  input: $('#crt-input'),
  grain: $('#grain'),
  isWarpOn: () => settings.curve && HAS_MOUSE.matches && !mon.rotated && ERAS[settings.era].warp > 0,
  isGrainOn: () => settings.grain,
});
fit();
document.querySelectorAll('[data-toggle]').forEach(btn => {
  btn.addEventListener('click', () => {
    settings[btn.dataset.toggle] = !settings[btn.dataset.toggle];
    saveJSON(STORAGE_SETTINGS, settings);
    applySettings();
  });
});
document.querySelectorAll('[data-era-pick]').forEach(btn => {
  btn.addEventListener('click', () => {
    settings.era = btn.dataset.eraPick;
    saveJSON(STORAGE_SETTINGS, settings);
    const url = new URL(location.href);
    url.searchParams.set('era', settings.era);
    history.replaceState(null, '', url);
    applySettings();
  });
});
applySettings();

// ---------- 전원 ----------
// 소리를 나중에 넣을 때를 생각해, 사용자가 전원 버튼을 직접 누르게 해서 켠다.
// (브라우저는 첫 클릭 전까지 소리 재생을 막는다.) 끄면 실제 컴퓨터처럼 열린 창이 모두 사라진다.
const powerFx = $('#power-fx');
const powerBtn = $('#power');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let powered = false;

function setPowerState(state) { powerFx.className = `power-fx ${state}`; }

// 연출이 끝나면 화면을 켜거나 끈다. 탭이 뒤에 있으면 애니메이션이 멈춰 animationend가 오지 않으므로 타이머로도 끝낸다.
let settleTimer = 0;
function settlePower() {
  clearTimeout(settleTimer);
  if (!powerFx.className.includes('turning')) return;
  setPowerState(powered ? 'on' : 'off');
  if (!powered) os.reset();
}
powerFx.querySelector('.beam').addEventListener('animationend', settlePower);

function setPower(on) {
  if (on === powered) return;
  powered = on;
  powerBtn.setAttribute('aria-pressed', String(powered));
  if (reduceMotion) {
    setPowerState(powered ? 'on' : 'off');
    if (!powered) os.reset();
  } else {
    setPowerState(powered ? 'turning-on' : 'turning-off');
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settlePower, 900);
  }
  if (powered) os.boot();
}

const os = createOS({
  stage,
  toStage: mon.toLocal,
  requestPowerOff: () => setPower(false),
  crt,
  getNight: () => settings.night,
  getEra: () => settings.era,
  setNight: on => {
    settings.night = on;
    saveJSON(STORAGE_SETTINGS, settings);
    applySettings();
  },
});
powerBtn.addEventListener('click', () => setPower(!powered));
