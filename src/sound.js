// 소리: 효과음과 배경음악. 파일은 assets/sounds/에 있고, 무엇을 언제 트는지는 docs/requirements.md의 "소리" 표를 따른다.
// 효과음은 play('이름')으로 튼다. 배경음악은 지금 상황에 맞는 곡 하나만 튼다. 화면 쪽에서는 바탕화면의 공간(setPlace)과
// 창이 열려 있는 동안 바꿀 음악(holdMusic)만 알린다. 설정의 sound가 꺼지면 모든 소리가, musicOn이 꺼지면 배경음악만 멈춘다.
// 브라우저는 사용자가 한 번 누르기 전까지 재생을 막는데, 이 사이트는 전원 버튼을 눌러야 켜지므로 첫 소리는 늘 그 뒤에 난다.
// 이 창이 뒤로 가면(다른 탭이나 다른 프로그램으로 넘어가거나 창을 내리면) 효과음과 배경음악을 끄고, 돌아오면 다시 낸다(F27, 맨 아래 checkAway).
import { settings } from './settings.js';

const DIR = 'assets/sounds/';

// vol은 0~1. 파일마다 다른 크기를 비슷하게 맞춘 값이다. 여러 파일이 있으면 그 가운데 하나를 고른다.
const EFFECTS = {
  button: { files: ['button.mp3'], vol: 0.5 },                         // 모니터의 전원 버튼
  key: { files: ['key-1.mp3', 'key-2.mp3', 'key-3.mp3'], vol: 0.5 },   // 로그인 화면에서 아이디를 칠 때 한 글자마다
  mouse: { files: ['mouse.mp3'], vol: 0.35 },                          // 화면 안을 누를 때
  step: { files: ['step-1.mp3', 'step-2.mp3', 'step-3.mp3'], vol: 0.4 }, // 아바타가 걸을 때 두 칸마다
  light: { files: ['light.mp3'], vol: 0.6 },                           // 불 끄고 켜기
  enter: { files: ['enter.mp3'], vol: 0.5 },                           // 방과 놀이터 사이를 오갈 때(문 닫히는 소리)
  furniture: { files: ['furniture-1.mp3', 'furniture-2.mp3', 'furniture-3.mp3'], vol: 0.45 }, // 가구를 놓을 때
};

// 바탕화면 내 방의 배경음악. 주인이 배경음악 앱(src/apps/music-app.js)에서 고른다.
export const ROOM_MUSIC = [
  { id: 'kpop', name: '케이팝', file: 'bgm-kpop.mp3' },
  { id: 'upbeat', name: '신나는 곡', file: 'bgm-upbeat.mp3' },
  { id: 'calm', name: '차분한 곡', file: 'bgm-calm.mp3' },
  { id: 'country', name: '컨트리', file: 'bgm-country.mp3' },
];
const LOUD_VOL = 0.28; // 내 방 네 곡과 미니게임 두 곡은 방 꾸미기, 놀이터 곡보다 약 10dB 크게 만들어져 있다
// 공간과 창에 붙는 음악. 이름은 공간 id(놀이터)와 data/apps.js의 music 값으로 쓴다.
// data/apps.js에서 music: 'own'인 게임은 게임 안에 음악이 있어서, 그 창이 열려 있는 동안 사이트 음악을 멈춘다.
const MUSIC = {
  office: { file: 'bgm-office.mp3', vol: 0.8 },          // 방 꾸미기 창(내 집을 꾸밀 때)
  playground: { file: 'bgm-playground.mp3', vol: 0.65 }, // 바탕화면이 놀이터일 때
  'tidy-up': { file: 'bgm-tidy-up.mp3', vol: LOUD_VOL },   // 짐 정리 창
  'file-ten': { file: 'bgm-file-ten.mp3', vol: LOUD_VOL }, // 파일 정리 10 창
};
export const MUSIC_NAMES = [...Object.keys(MUSIC), 'room', 'own'];

let place = null;
const holds = []; // 창이 열려 있는 동안 바꿀 음악. 나중에 연 창이 이긴다. { id, name }
const players = new Map(); // 파일 이름 → 되풀이해 트는 Audio
let current = null; // 지금 트는 배경음악 { key, file, vol, audio }
let fadeTimer = 0;
const effects = new Set(); // 지금 나고 있는 효과음. 창이 뒤로 가면 나던 것도 끈다(문 소리는 2초쯤 간다)

const soundOn = () => !!settings.get('sound');

// 이 창이 뒤에 있는지. 탭이 가려졌거나(다른 탭, 창 내리기) 키보드 초점이 다른 곳으로 갔다(다른 프로그램, 주소창).
// 게임 창이나 라디오 플레이어(iframe) 안을 누르면 이 문서의 window에 blur가 오지만, 초점은 이 페이지 안에 있어 hasFocus()는 true다
const isAway = () => document.hidden || !document.hasFocus();
let away = isAway();

export function play(name) {
  const fx = EFFECTS[name];
  if (!fx || !soundOn() || isAway()) return;
  const a = new Audio(DIR + fx.files[Math.floor(Math.random() * fx.files.length)]);
  a.volume = fx.vol;
  effects.add(a);
  a.onended = a.onerror = () => effects.delete(a);
  a.play().catch(() => effects.delete(a));
}

export function roomMusic() {
  return ROOM_MUSIC.find(m => m.id === settings.get('music')) || ROOM_MUSIC[0];
}

// 바탕화면의 공간('room', 'playground'). 바탕화면을 떠나면(로그인, 부팅, 전원 끄기) null.
export function setPlace(id) {
  place = id;
  update();
}

// 창이 열려 있는 동안 배경음악을 바꾼다. name은 MUSIC의 이름, 'room'(내 방 곡), 'own'(멈춤).
// 돌려준 함수를 창을 닫을 때 부르면 원래 음악으로 돌아간다.
export function holdMusic(id, name) {
  holds.push({ id, name });
  update();
  return () => {
    const i = holds.findIndex(x => x.id === id);
    if (i >= 0) holds.splice(i, 1);
    update();
  };
}

function wanted() {
  if (!soundOn() || !settings.get('musicOn') || !place) return null;
  const name = holds.length ? holds[holds.length - 1].name : place;
  if (name === 'own') return null;
  if (MUSIC[name]) return { key: name, ...MUSIC[name] };
  const m = roomMusic();
  return { key: m.id, file: m.file, vol: LOUD_VOL };
}

function player(file) {
  let a = players.get(file);
  if (!a) {
    a = new Audio(DIR + file);
    a.loop = true;
    a.muted = away;
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
  if ('sound' in patch || 'music' in patch || 'musicOn' in patch) update();
});

// 창이 뒤로 가면 소리를 끄고 돌아오면 다시 낸다(F27). 저장된 설정(sound, musicOn)과 모니터의 소리 단추는 그대로 두고,
// 곡은 멈추지 않고 소리만 끈다(muted). 멈췄다가 다시 틀면 돌아왔을 때 브라우저가 누르지 않은 재생을 막을 수 있고, 뒤에서 곡이 흘러가도 괜찮다.
// 2000년대 윈도우 게임(DirectSound의 보통 버퍼)과 웹 게임 엔진(Phaser의 pauseOnBlur)처럼 줄이지 않고 바로 끄고 바로 켠다.
// 줄이려면 타이머가 필요한데, 가려진 탭에서는 타이머가 1초에 한 번으로 느려진다(known-issues 8, 23).
// 라디오의 음악 창과 게임 창(iframe) 안에서 나는 소리는 그 사이트가 내는 소리라 여기서 끄지 않는다(라디오는 틀어 놓고 듣는 음악이라 뒤에서도 난다).
function checkAway() {
  const now = isAway();
  if (now === away) return;
  away = now;
  for (const a of [...players.values(), ...effects]) a.muted = away;
}
document.addEventListener('visibilitychange', checkAway);
window.addEventListener('focus', checkAway);
// 초점이 iframe으로 옮겨 가는 중이면 바로 뒤의 hasFocus()가 브라우저에 따라 아직 false일 수 있어 잠깐 뒤에 본다
window.addEventListener('blur', () => setTimeout(checkAway, 200));
// iframe 안에 초점이 있는 동안에는 다른 프로그램으로 넘어가거나 돌아와도 이 문서에 blur와 focus가 오지 않아서 0.5초마다 다시 본다(known-issues 74)
setInterval(checkAway, 500);
