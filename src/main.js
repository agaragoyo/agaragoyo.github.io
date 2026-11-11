// 시작점. 모니터(크기 맞추기, 테두리 버튼, 화면 효과, 전원)를 맡고, 화면 안쪽은 os.js에 넘긴다.
import { STAGE_W, STAGE_H } from './config.js';
import { settings } from './settings.js';
import { reduceMotion } from './util.js';
import { initCursors } from './cursors.js';
import { createOS } from './os.js';
import { play, setPlace } from './sound.js';

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

// 화면은 2005년식 은색 평면 CRT 모니터와 XP 시절식 창으로 보여 준다(2026-11-10 시대를 2005로 정함).
// 그 모양은 style.css의 "모니터", "창", "작업 표시줄과 시작 메뉴", "부팅", "로그인" 절에 있다(시대를 비교하던 때의 "2005 모습" 절은 2026-11-11에 이 절들에 합쳤다).

// 화면 안 커서(src/cursors.js)
initCursors();

// ---------- 화면 맞추기 ----------
// MARGIN: 화면 가장자리와 모니터 사이(px). PAD, CTRL: 모니터 테두리 두께와 아래 버튼 줄 높이(무대 px).
// 테두리도 무대와 같은 비율로 커지므로, 큰 모니터에서 테두리만 얇아 보이거나 스피커 구멍만 길어지지 않는다.
// style.css의 .viewport 회전 조건과 같아야 한다.
const PAD = 72;
const CTRL = 108;
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
  const s = Math.max(0.2, Math.min((W - 2 * MARGIN) / (STAGE_W + 2 * PAD), (H - 2 * MARGIN) / (STAGE_H + PAD + CTRL)));
  const root = document.documentElement.style;
  root.setProperty('--margin', MARGIN + 'px');
  root.setProperty('--u', s + 'px');
  root.setProperty('--pad', PAD * s + 'px');
  root.setProperty('--ctrl', CTRL * s + 'px');
  mon.scale = s;
  const screen = $('#screen');
  screen.style.width = STAGE_W * s + 'px';
  screen.style.height = STAGE_H * s + 'px';
  stage.style.transform = `scale(${s})`;
}
// 창 크기를 끄는 동안 resize가 연달아 오므로 한 화면에 한 번만 맞춘다.
let fitQueued = false;
addEventListener('resize', () => {
  if (fitQueued) return;
  fitQueued = true;
  requestAnimationFrame(() => { fitQueued = false; fit(); });
});
PORTRAIT_PHONE.addEventListener('change', fit);

// ---------- 화면 효과 ----------
// 아주 약한 깜빡임과 구석 그늘은 늘 켜 둔다(style.css의 "화면 효과"). 화면을 볼록하게 휘던 효과와 그레인, 볼록 켜기 버튼은
// 2026-11-10에 뺐다(알파 테스트 피드백). 가는 가로줄(주사선)은 글자를 가려서 같은 날 뺐고(known-issues 55),
// 지직거리는 그레인도 2005년 PC 모니터에는 없던 것이라 2026-11-11에 뺐다.

// 모니터 OSD: 모니터 아래 단추를 누르면 그 시절 모니터가 화면 위에 띄우던 상자처럼 잠깐 보여 준다(style.css의 .osd).
// 꺼진 화면에는 띄우지 않는다. 글은 고정된 낱말만 넣는다(사용자가 쓴 글을 넣지 않는다).
const osd = $('#osd');
let osdTimer = 0;
function showOSD(title, on) {
  if (!powered) return;
  const cells = Array.from({ length: 10 }, () => `<i${on ? ' class="on"' : ''}></i>`).join('');
  osd.innerHTML = `<b>${title}</b><span class="osd-bar">${cells}</span><span class="osd-state">${on ? '켜짐' : '꺼짐'}</span>`;
  osd.hidden = false;
  clearTimeout(osdTimer);
  osdTimer = setTimeout(() => { osd.hidden = true; }, 1800);
}

// 설정이 바뀔 때마다 모니터 아래 소리 버튼의 불을 맞춘다.
function applySettings() {
  $('#sound-key').setAttribute('aria-pressed', String(!!settings.get('sound')));
}
fit();
settings.subscribe(applySettings);
applySettings();

// 모니터 아래 버튼(전원, 소리)은 마우스로 눌러도 키보드 초점을 가져가지 않는다. 초점이 남아 있으면
// 바탕화면에서 Enter(아바타 말하기)를 누를 때 그 버튼이 다시 눌려 전원이 꺼진다(known-issues 26).
document.querySelectorAll('.phys').forEach(btn => {
  btn.addEventListener('mousedown', e => e.preventDefault());
});
$('#sound-key').addEventListener('click', () => {
  settings.set({ sound: !settings.get('sound') });
  showOSD('소리', !!settings.get('sound'));
});

// ---------- 전원 ----------
// 사용자가 전원 버튼을 직접 누르게 해서 켠다. 브라우저는 첫 클릭 전까지 소리 재생을 막으므로, 이 클릭 뒤부터 소리가 난다.
// 끄면 실제 컴퓨터처럼 열린 창이 모두 사라지고 배경음악도 바로 멈춘다.
// 켤 때는 2005년 브라운관 모니터처럼 자기 제거(디가우스)로 색이 잠깐 출렁인 뒤 화면이 밝아진다(style.css의 "전원 연출").
const powerFx = $('#power-fx');
const powerBtn = $('#power');
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
// 끌 때는 화면이 어두워지는 애니메이션(off-bg), 켤 때는 디가우스 색 층(#degauss, power-fx 바로 뒤 형제)이 끝나면 마무리한다.
// 켤 때 power-fx가 밝아지는 애니메이션(1.2초)은 디가우스(2초)보다 먼저 끝나므로 이것으로는 마무리하지 않는다.
powerFx.addEventListener('animationend', e => { if (e.target === powerFx && e.animationName === 'off-bg') settlePower(); });
$('#degauss').addEventListener('animationend', settlePower);

function setPower(on) {
  if (on === powered) return;
  powered = on;
  powerBtn.setAttribute('aria-pressed', String(powered));
  play('button');
  if (!powered) { setPlace(null); osd.hidden = true; }
  if (reduceMotion) {
    setPowerState(powered ? 'on' : 'off');
    if (!powered) os.reset();
  } else {
    setPowerState(powered ? 'turning-on' : 'turning-off');
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settlePower, 2300); // 켤 때의 디가우스가 2초라 그보다 조금 길게
  }
  if (powered) os.boot();
}

const os = createOS({
  stage,
  toStage: mon.toLocal,
  requestPowerOff: () => setPower(false),
  settings,
});
powerBtn.addEventListener('click', () => setPower(!powered));

// 켜진 화면 안을 누르면 마우스 딸깍 소리. 스크립트가 보내는 가짜 이벤트(isTrusted가 거짓)는 세지 않는다.
// 모니터 아래 버튼(전원, 소리)은 화면 밖이라 나지 않는다. iframe 앱 안의 클릭은 부모 문서까지 오지 않는다.
document.addEventListener('pointerdown', e => {
  if (e.isTrusted && e.button === 0 && powered && e.target.closest?.('#screen')) play('mouse');
}, true);

// ---------- 첫 화면 ----------
// 여기까지 오면 모니터가 다 그려지고 버튼도 이어졌으므로 index.html의 가림막을 걷는다.
// 가림막이 없을 때는 이 파일이 돌기 전까지 모니터 없이 글씨만 먼저 보였다(known-issues 42).
// 첫 화면의 글자는 사이트 글자만 담은 작은 글꼴(AgaUI) 보통과 굵게 두 벌로 그린다(style.css의 "글꼴", known-issues 45).
// 둘을 받을 때까지 기다리되, 3초가 넘으면 먼저 걷는다. 3초는 브라우저가 웹 글꼴을 기다리며 글자를 숨기는 기본 시간이다.
// 그 뒤에는 기본 글꼴로 보이다가 글꼴이 오는 대로 바뀐다.
const FIRST_FONTS = ['12px AgaUI', 'bold 12px AgaUI'];
// 작은 글꼴에 없는 글자(사용자가 치는 닉네임과 말풍선)는 갈무리11 전체가 그린다. 첫 화면을 다 그린 뒤에 이어 받아 두어,
// 느린 연결에서 첫 화면의 짐을 나눠 지지 않으면서도 로그인 화면에서 닉네임을 칠 무렵에는 와 있게 한다.
const FULL_FONTS = ['12px Galmuri11', 'bold 12px Galmuri11'];
const loader = $('#page-loader');
Promise.race([
  Promise.all(FIRST_FONTS.map(f => document.fonts.load(f))).catch(() => {}),
  new Promise(done => setTimeout(done, 3000)),
]).then(() => {
  loader.classList.add('done');
  setTimeout(() => loader.remove(), 400); // 사라지는 데 0.25초. 다 사라진 뒤 점 깜빡임까지 멈추게 뺀다
  for (const f of FULL_FONTS) document.fonts.load(f).catch(() => {});
});
