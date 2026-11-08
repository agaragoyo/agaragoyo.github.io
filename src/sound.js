// 소리: 효과음과 배경음악. 파일은 assets/sounds/에 있고, 무엇을 언제 트는지는 docs/requirements.md의 "소리" 표를 따른다.
// 효과음은 play('이름')으로 튼다. 배경음악은 지금 상황에 맞는 곡 하나만 틀고, 화면 쪽에서는 setPlace와 setDecorating으로 상황만 알린다.
// 설정의 sound가 꺼져 있으면 아무것도 틀지 않는다. 브라우저는 사용자가 한 번 누르기 전까지 재생을 막는데,
// 이 사이트는 전원 버튼을 눌러야 켜지므로 첫 소리는 늘 그 뒤에 난다.
import { settings } from './settings.js';

const DIR = 'assets/sounds/';

// vol은 0~1. 파일마다 다른 크기를 비슷하게 맞춘 값이다. 여러 파일이 있으면 그 가운데 하나를 고른다.
const EFFECTS = {
  button: { files: ['button.mp3'], vol: 0.5 },     // 모니터의 전원 버튼
  keyboard: { files: ['keyboard.mp3'], vol: 0.6 }, // 로그인
  mouse: { files: ['mouse.mp3'], vol: 0.35 },      // 화면 안을 누를 때
  light: { files: ['light.mp3'], vol: 0.6 },       // 불 끄고 켜기
  enter: { files: ['enter.mp3'], vol: 0.5 },       // 방과 놀이터 사이를 오갈 때
  furniture: { files: ['furniture-1.mp3', 'furniture-2.mp3', 'furniture-3.mp3'], vol: 0.45 }, // 가구를 놓을 때
};

// 바탕화면 내 방의 배경음악. 시작 메뉴에서 차례로 바꿔 들어 볼 수 있다(주인이 고르게 할지는 팀에서 정하는 중).
export const ROOM_MUSIC = [
  { id: 'kpop', name: '케이팝', file: 'bgm-kpop.mp3' },
  { id: 'upbeat', name: '신나는 곡', file: 'bgm-upbeat.mp3' },
  { id: 'calm', name: '차분한 곡', file: 'bgm-calm.mp3' },
  { id: 'country', name: '컨트리', file: 'bgm-country.mp3' },
];
const ROOM_VOL = 0.28; // 내 방 네 곡은 아래 두 곡보다 약 10dB 크게 만들어져 있다
const MUSIC = {
  office: { file: 'bgm-office.mp3', vol: 0.8 },          // 방 꾸미기 창이 열려 있을 때
  playground: { file: 'bgm-playground.mp3', vol: 0.65 }, // 바탕화면이 놀이터일 때(공간 id와 같은 이름)
};

const state = { place: null, decorating: false };
const players = new Map(); // 파일 이름 → 되풀이해 트는 Audio
let current = null; // 지금 트는 배경음악 { key, file, vol, audio }
let fadeTimer = 0;

const soundOn = () => !!settings.get('sound');

export function play(name) {
  const fx = EFFECTS[name];
  if (!fx || !soundOn()) return;
  const a = new Audio(DIR + fx.files[Math.floor(Math.random() * fx.files.length)]);
  a.volume = fx.vol;
  a.play().catch(() => {});
}

export function roomMusic() {
  return ROOM_MUSIC.find(m => m.id === settings.get('music')) || ROOM_MUSIC[0];
}

// 바탕화면의 공간('room', 'playground'). 바탕화면을 떠나면(로그인, 부팅, 전원 끄기) null.
export function setPlace(place) {
  state.place = place;
  update();
}

// 방 꾸미기 창이 열려 있는 동안은 공간과 상관없이 방 꾸미기 음악을 튼다.
export function setDecorating(on) {
  state.decorating = on;
  update();
}

function wanted() {
  if (!soundOn() || !state.place) return null;
  if (state.decorating) return { key: 'office', ...MUSIC.office };
  if (MUSIC[state.place]) return { key: state.place, ...MUSIC[state.place] };
  const m = roomMusic();
  return { key: m.id, file: m.file, vol: ROOM_VOL };
}

function player(file) {
  let a = players.get(file);
  if (!a) {
    a = new Audio(DIR + file);
    a.loop = true;
    players.set(file, a);
  }
  return a;
}

function update() {
  const next = wanted();
  if (current?.key === next?.key) return;
  const prev = current;
  current = next && { ...next, audio: player(next.file) };
  crossfade(prev, current);
}

// 앞 곡은 0.4초 동안 줄여서 멈추고(멈춘 자리에서 다음에 다시 이어 튼다), 다음 곡은 0.2초 뒤부터 0.6초 동안 키운다.
// 탭이 뒤에 있어도 끝까지 가도록 requestAnimationFrame 대신 타이머를 쓴다.
function crossfade(prev, next) {
  clearInterval(fadeTimer);
  for (const a of players.values()) if (a !== prev?.audio && a !== next?.audio) a.pause();
  const from = prev ? prev.audio.volume : 0;
  if (next) {
    next.audio.volume = 0;
    next.audio.play().catch(() => {});
  }
  const start = Date.now();
  const step = () => {
    const t = (Date.now() - start) / 1000;
    if (prev) {
      prev.audio.volume = Math.max(0, from * (1 - t / 0.4));
      if (t >= 0.4) prev.audio.pause();
    }
    if (next) next.audio.volume = next.vol * Math.min(1, Math.max(0, (t - 0.2) / 0.6));
    if (t >= 0.8) clearInterval(fadeTimer);
  };
  fadeTimer = setInterval(step, 50);
  step();
}

settings.subscribe(patch => {
  if ('sound' in patch || 'music' in patch) update();
});
