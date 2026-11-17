// 말풍선 암호 999999999로 부르는 비둘기 떼(docs/requirements.md의 F32). 숫자 9는 "구"라서, 9를 아홉 번 부르면 "구구" 우는 비둘기가 온다는 말장난이다.
// 방 벽에 창문(id가 window로 끝나는 벽 가구)이 있으면 그 가운데 하나로, 없으면 방의 현관문(src/config.js의 SCENES door)으로
// 비둘기가 PIGEON.max마리까지 PIGEON.gap 간격으로 줄줄이 날아 들어와, 그 앞의 빈 바닥 칸에 서로 한 칸씩 띄워 내려앉는다(seats).
// 앉을 칸이 모자라면 앉을 수 있는 만큼만 온다. 처음 내려앉은 비둘기부터 두세 마리가 차례로 "구구" 하고(sing),
// 다 내려앉으면 저마다 내려앉은 칸 둘레(PIGEON.roam칸)에서 내 펫처럼 몇 칸씩 걷는다.
// 다 내려앉고 12~18초가 지나거나, 아바타가 어느 비둘기의 둘레 여덟 칸에 들어오거나(watch), 비둘기 하나를 두 번 눌러 아바타가 다가가면
// 떼 전체가 놀라게 한 쪽에 가까운 비둘기부터 PIGEON.wave 간격으로 차례로 날아올라 저마다 가장 가까운 창문(없으면 현관문)으로 나간다(leave).
// 아홉 마리가 칸을 막아 아바타가 갇히지 않게, 아바타가 다가가기만 하면 떼가 비켜 준다.
// 스타듀 밸리의 새는 0.2초마다 4칸 안에 사람이 있는지 보고 저마다 날아가며, 비둘기 떼는 먼저 놀란 새가 뜨면 둘레의 새가 뒤따라 뜬다. 그 두 가지를 본떴다.
// 아홉 마리가 한 구멍으로 드나들어도 그림이 겹치지 않게 세 가지를 지킨다. 공중에서는 먼저 뜬 비둘기의 길과 같은 때 겹치지 않게 늦게 뜨고(book),
// 앉은 비둘기 위로는 날지 않게 차례를 바꾸며(queue), 나는 동안 가구 뒤로 숨는 칸에는 앉거나 걸어 들어가지 않는다(hidden).
// 현관문으로 드나들 때는 첫 비둘기가 들어올 때와 마지막 비둘기가 나갈 때 문 닫히는 소리를 한 번씩 낸다. 다가온 아바타에 놀라 날아갈 때는
// 떼가 뜨기 시작할 때 새소리(src/sound.js의 pet-bird)를 한 번 내고, 머무는 시간이 다 되어 날아갈 때는 조용히 간다.
// 움직임 줄이기를 켠 사람에게는 날지 않고 내려앉을 칸에 하나씩 나타났다가 그 자리에서 하나씩 사라진다.
// 걷기, 날기, 그림은 내 펫과 같은 src/pet.js의 mountPet이 맡고(그림은 data/pets.js의 비둘기), 여기서는 드나드는 곳, 앉을 칸, 머무는 시간, 날아오르는 차례만 정한다.
// 떼가 와 있을 때 또 부르면 한 마리가 한 번 더 "구구" 한다(src/os.js의 callPigeon). 집 저장 형식과 링크에는 아무것도 담지 않는다.
import { N, PIGEON } from './config.js';
import { BY_ID } from '../data/furniture.js';
import { tile, wallPoint } from './iso.js';
import { isWall } from './rules.js';
import { blockedOf, covered } from './avatar.js';
import { mountPet, petCell, flyMs, flightAt, flightSeen, PET_ROWS } from './pet.js';
import { play } from './sound.js';
import { reduceMotion } from './util.js';

export const COO = '구구';          // 내려앉으면 하는 말. 9를 "구"로 읽는 말장난을 비둘기 울음으로 맺는다
const LOOK = 'pigeon/gray';        // 날아오는 비둘기. 길에서 흔히 보는 회색이다(data/pets.js)
const LAND = 3;                    // 드나드는 벽에서 이만큼 떨어진 줄 가까이에 내려앉는다
const SPREAD = 1.5;                // 앉을 칸을 고를 때 거리에 더하는 무작위 값의 한도(칸). 한 칸 건너 줄을 맞춘 바둑판처럼 앉지 않게 흩뜨린다
const SCARE = 1;                   // 아바타가 비둘기와 가로와 세로로 이만큼(칸) 안에 들어오면 떼가 날아간다. 1이면 둘레 여덟 칸이다
const WATCH_MS = 100;              // 아바타가 다가오는지 보는 간격. 아바타가 한 칸 걷는 시간(0.2초)보다 짧다
const CHORUS_GAP = 300;            // 앞 비둘기의 "구구" 말풍선이 사라지고 다음 비둘기가 울기까지
// 비둘기 그림 가운데가 지나는 창문 구멍의 가장자리 여백(벽 칸, 줄). 48×40px 그림이 창문 테두리 밖으로 나가지 않게 한다
const EDGE_U = 0.7;
const EDGE_V = 0.6;
const DOOR_U = 0.45;               // 현관문 구멍의 양옆 여백(벽 칸). 문은 두 칸뿐이라 창문보다 좁게 비워 여러 마리가 나란히 지나가게 한다
const DOOR_V = [0.25, 0.7];        // 현관문으로 드나들 때 그림 가운데가 지나는 높이의 범위(문 높이의 비율)
// 구멍 안의 가운데와 네 귀퉁이(벽을 따라, 높이의 비율). 나갈 때 비둘기마다 이 가운데 앉은 비둘기 위를 덜 지나고 가장 일찍 뜰 수 있는 자리로 가고(leave),
// 가구에 가려지는지도 이 자리들로 오가는 길로 따진다(hidden)
const SLOTS = [[0.5, 0.5], [0, 0], [1, 1], [1, 0], [0, 1]];
// 드나드는 비둘기끼리 공중에서 겹치지 않게 날 때를 고른다(book). RTS 게임에서 여러 유닛이 길을 나눠 쓸 때처럼, 먼저 잡힌 나는 길들을 시간마다 따져
// 새 비둘기의 길이 같은 때 그 가까이를 지나면 WAIT_MS씩 늦춘다. 겹친다고 보는 거리는 그림 칸 수로 잰다(칠한 부분이 24×20칸 가운데 22×17칸이다)
const CLEAR_COLS = 20;             // 두 비둘기의 발끝이 가로로 이 칸 수 안에 있고
const CLEAR_ROWS = 15;             // 세로로도 이 칸 수 안에 있으면 겹친다고 본다
const SEEN = 0.6;                  // 이보다 흐린 비둘기(구멍에서 나타나거나 사라지는 중)와는 겹쳐도 셈하지 않는다
const STEP_MS = 40;                // 겹치는지 볼 때 나는 길을 나누는 시간 간격
const WAIT_MS = 50;                // 겹치면 이만큼씩 늦춰 다시 본다
const WAIT_MAX = 1500;             // 늦추는 한도. 그래도 겹치면 가장 덜 겹치는 때에 난다
const HOLD_MS = 400;               // 걷던 비둘기가 멈춰 서기까지 걸리는 가장 긴 시간(한 칸 걷는 시간, src/pet.js의 STEP_MS)

export const isWindow = item => isWall(item) && /(^|-)window$/.test(item.id);
const far = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); // 가로와 세로 가운데 먼 쪽의 칸 수. 1 이하이면 둘레 여덟 칸 안이다
const any = list => list[Math.floor(Math.random() * list.length)];

// 드나드는 곳. 벽 wall의 칸 u0~u1(벽을 따라 모서리에서 잰 자리), 바닥에서 v0~v1줄 높이의 네모가 비둘기 그림 가운데가 지나는 구멍이다.
//   door  현관문인지(문 소리를 낸다)
//   near  떼가 앉을 칸을 고를 때 가운데로 삼는 칸. 구멍 가운데의 벽 칸에서 벽과 LAND줄 떨어진 칸이다. 나갈 곳을 고를 때 거리도 이 칸으로 잰다
function opening(wall, u0, u1, v0, v1, door = false) {
  const c = Math.max(1, Math.min(N - 1, Math.floor((u0 + u1) / 2)));
  return { wall, u0, u1, v0, v1, door, near: wall === 'R' ? { x: c, y: LAND } : { x: LAND, y: c } };
}
// 창문. 벽 가구의 x는 벽을 따라 시작하는 칸, y는 바닥에서 아래 끝까지의 줄이다(src/iso.js의 placementOf)
function windowGate(item) {
  const [w, rows] = BY_ID[item.id].size;
  return opening(item.wall, item.x + EDGE_U, item.x + w - EDGE_U, item.y + EDGE_V, item.y + rows - EDGE_V);
}
const doorGate = door => opening(door.wall, door.x + DOOR_U, door.x + door.w - DOOR_U, door.h * DOOR_V[0], door.h * DOOR_V[1], true);
// 칸 c가 구멍의 벽을 따라 어디쯤인지(벽 칸). 왼쪽 벽은 y, 오른쪽 벽은 x를 따라 늘어난다(src/iso.js의 wallPoint)
const along = (g, c) => (g.wall === 'R' ? c.x : c.y) + 0.5;
// 구멍 안의 한 점에서 날기 시작하거나 사라지는 발끝 자리(무대 px). a는 벽을 따라, b는 높이로 구멍 안의 비율(0~1)이다.
// 그림 가운데가 그 점에 오게 그림 키의 절반만큼 내린다
function pointIn(g, a, b) {
  const p = wallPoint(g.wall, g.u0 + (g.u1 - g.u0) * a, g.v0 + (g.v1 - g.v0) * b);
  return { x: p.x, y: p.y + (petCell() * PET_ROWS) / 2 };
}
// 구멍 g로 드나드는 비둘기들(list)의 자리를 나눈다. 앉은(앉을) 칸 cellOf(o)가 벽을 따라 놓인 차례대로 구멍의 이쪽 끝에서 저쪽 끝까지 고르게 늘어놓고,
// 이웃한 비둘기끼리는 높이를 세 층으로 엇갈린다. 나는 길이 서로 엇갈리지 않고, 여러 마리가 구멍의 한 점으로 모여 겹치지 않는다
function spread(g, list, cellOf) {
  const sorted = [...list].sort((p, q) => along(g, cellOf(p)) - along(g, cellOf(q)));
  return new Map(sorted.map((o, i) => [o, pointIn(g, sorted.length > 1 ? i / (sorted.length - 1) : 0.5, (i % 3) / 2)]));
}
// 두 비둘기 그림이 겹치는지(발끝 자리 p, q). 가로와 세로가 모두 CLEAR_COLS, CLEAR_ROWS 칸 안이면 겹친다
const touching = (p, q) => Math.abs(p.x - q.x) < petCell() * CLEAR_COLS && Math.abs(p.y - q.y) < petCell() * CLEAR_ROWS;
// 나는 길 p(a, b, ms, fade)가 보이는 동안 발끝 자리 foot에 앉은 비둘기 위를 지나는지
function crosses(p, foot) {
  for (let t = 0; t <= p.ms; t += STEP_MS) {
    if (flightSeen(t, p.ms, p.fade) >= SEEN && touching(flightAt(p.a, p.b, t / p.ms, p.fade), foot)) return true;
  }
  return false;
}
// 칸 c와 구멍 g 사이를 나는 비둘기가 가구에 가려지는지(fade 'in'은 구멍에서 칸으로, 'out'은 칸에서 구멍으로). 나는 동안의 앞뒤는 그 칸으로 정하므로
// (src/pet.js의 flight) 그 칸보다 앞에 그리는 가구가 나는 길과 겹치면 가린다. 창문 아래 침대의 머리맡 뒤 칸이 그렇다. 구멍 안의 자리(SLOTS)마다 본다
function hidden(items, c, g, fade) {
  const foot = tile(c.x + 0.5, c.y + 0.5);
  const size = petCell();
  for (const slot of SLOTS) {
    const q = pointIn(g, ...slot);
    const [a, b] = fade === 'in' ? [q, foot] : [foot, q];
    const ms = flyMs(a, b);
    for (let t = 0; t <= ms; t += STEP_MS) {
      if (flightSeen(t, ms, fade) < SEEN) continue;
      const p = flightAt(a, b, t / ms, fade);
      if (covered(items, c, { l: p.x - 11 * size, r: p.x + 11 * size, t: p.y - 17 * size, b: p.y })) return true;
    }
  }
  return false;
}
// 앉은 비둘기 위로 날지 않는 차례. list를 앞에서부터 고르되, 아직 남은 것 가운데 먼저 보내야 할 것(first(o)에 든 것)이 있으면 그것들 뒤로 미룬다.
// 서로 먼저 보내야 하는 짝이 있어 고를 것이 없으면 list에서 가장 앞의 것을 고른다
function queue(list, first) {
  const left = new Set(list);
  const out = [];
  while (left.size) {
    const o = list.find(x => left.has(x) && !first(x).some(y => left.has(y))) || list.find(x => left.has(x));
    out.push(o);
    left.delete(o);
  }
  return out;
}
// 앉을 칸들(homes)을 날아올 차례로 늘어놓는다. 구멍에서 본 방향으로 세 무리(이쪽, 가운데, 저쪽)로 나눠 무리를 돌아가며 하나씩 고르고,
// 무리 안에서는 구멍에서 먼 칸부터 고른다. 잇달아 오는 두 마리가 같은 쪽으로 날지 않는다. 다만 다른 비둘기가 날아 지나갈 칸에 앉을 비둘기는
// 그 비둘기가 다 지나간 뒤에 온다(queue). starts는 비둘기마다 구멍에서 나올 자리다(spread)
function arrivals(g, homes, starts) {
  const mid = (g.u0 + g.u1) / 2;
  const from = g.wall === 'R' ? { x: mid, y: 0 } : { x: 0, y: mid };
  const angle = c => Math.atan2(c.y + 0.5 - from.y, c.x + 0.5 - from.x);
  const dist = c => Math.hypot(c.x + 0.5 - from.x, c.y + 0.5 - from.y);
  const byAngle = [...homes].sort((a, b) => angle(a) - angle(b));
  const k = Math.min(3, byAngle.length);
  const groups = Array.from({ length: k }, (_, i) => byAngle.slice(Math.round((i * byAngle.length) / k), Math.round(((i + 1) * byAngle.length) / k)).sort((a, b) => dist(b) - dist(a)));
  const turns = [];
  for (let i = 0; turns.length < homes.length; i++) for (const list of groups) if (list[i]) turns.push(list[i]);
  const foot = c => tile(c.x + 0.5, c.y + 0.5);
  const path = c => ({ a: starts.get(c), b: foot(c), ms: flyMs(starts.get(c), foot(c)), fade: 'in' });
  const over = new Map(homes.map(c => [c, homes.filter(o => o !== c && crosses(path(o), foot(c)))]));
  return queue(turns, c => over.get(c));
}

// 나는 길 p({ a, b, ms, fade, t0 }. a에서 b까지 무대 px, t0 ms에 떠서 ms 동안 난다)에서 때 t의 발끝 자리. 그때 날고 있지 않거나 SEEN보다 흐리면 null
function where(p, t) {
  const dt = t - p.t0;
  if (dt < 0 || dt > p.ms || flightSeen(dt, p.ms, p.fade) < SEEN) return null;
  return flightAt(p.a, p.b, dt / p.ms, p.fade);
}
// 나는 길 p가 먼저 잡힌 길들(plans)과 같은 때 겹치는 횟수
function clashes(p, plans) {
  let n = 0;
  for (let t = p.t0; t <= p.t0 + p.ms; t += STEP_MS) {
    const me = where(p, t);
    if (!me) continue;
    for (const q of plans) {
      const o = where(q, t);
      if (o && touching(o, me)) n += 1;
    }
  }
  return n;
}
// 나는 길 p를 from(ms) 뒤로 잡는다. 먼저 잡힌 길들과 겹치지 않는 가장 이른 때를 WAIT_MS 간격으로 찾고, WAIT_MAX 안에 없으면 가장 덜 겹치는 때를 고른다.
// 움직임 줄이기를 켠 사람에게는 날지 않으므로 from 그대로다
function book(p, from, plans) {
  if (reduceMotion) return { ...p, t0: from, n: 0 };
  let best = null;
  for (let t0 = from; t0 <= from + WAIT_MAX; t0 += WAIT_MS) {
    const n = clashes({ ...p, t0 }, plans);
    if (!n) return { ...p, t0, n };
    if (!best || n < best.n) best = { ...p, t0, n };
  }
  return best;
}

// host: 떼가 다녀갈 곳(바탕화면 배경, src/os.js가 넘긴다)
//   layer, items(), avatar()  src/pet.js의 mountPet과 같다
//   pet()     내 펫(없으면 null). 그 칸과 둘레 한 칸에는 내려앉거나 걷지 않는다
//   door      방의 현관문(SCENES의 door). 창문이 없으면 여기로 드나든다
//   gone()    마지막 비둘기가 날아 나가 방에서 사라진 뒤 부른다
// 돌려주는 것: attach(here), birds(), claims(), coo(), destroy(). claims()는 비둘기들이 선 칸(걷는 중이면 두 칸)이다(known-issues 98)
// birds()는 방에 들어온 비둘기들(저마다 mountPet이 돌려준 것)이다. 아바타와 내 펫이 서로의 칸과 앞뒤를 맞출 때 부른다(src/avatar.js와 src/pet.js의 host.others)
export function visitFlock(host) {
  const flock = [];       // 방에 들어온 비둘기 { bird, home, landed, out }. home은 내려앉을 칸, landed는 내려앉았는지, out은 날아 나가는 중인지
  const timers = new Set(); // 줄줄이 들어오고 차례로 날아오르는 비둘기의 타이머
  let state = 'coming';   // 'coming' 나타나기 전, 'here' 와 있음, 'leaving' 날아 나가는 중, 'gone' 다녀갔다
  let coming = 0;         // 아직 내려앉지 않은 비둘기 수(나타나기 전 포함). 0이 되면 머무는 시간을 센다
  let chorus = 0;         // 차례로 "구구" 할 비둘기 수
  let knocked = false;    // 현관문으로 드나들며 문 소리를 냈는지
  let outByDoor = false;  // 현관문으로 나간 비둘기가 있는지. 마지막 비둘기가 나간 뒤 문 소리를 낸다
  let watchTimer = 0;
  let stayTimer = 0;
  let chorusTimer = 0;
  const sung = new Set();

  const later = (fn, ms) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  const scares = (x, y) => { const s = host.avatar()?.spot(); return !!s && far(s, { x, y }) <= SCARE; };
  // 칸 c에서 나갈 구멍. 가장 가까운 창문(없으면 현관문)이고, 거리는 창문 앞 칸(near)까지 잰다
  function exitGate(c) {
    const gates = host.items().filter(isWindow).map(windowGate);
    if (!gates.length) return doorGate(host.door);
    const d = g => Math.abs(g.near.x - c.x) + Math.abs(g.near.y - c.y);
    return gates.reduce((x, y) => (d(y) < d(x) ? y : x));
  }
  // 칸 c에서 날아 나갈 때 가구에 가려지지 않는지. 걸을 때마다 묻으므로 칸마다 한 번만 따져 둔다(방을 다시 그리면 비운다, attach)
  const clearOut = new Map();
  const visible = c => {
    const k = `${c.x},${c.y}`;
    if (!clearOut.has(k)) clearOut.set(k, !hidden(host.items(), c, exitGate(c), 'out'));
    return clearOut.get(k);
  };

  later(come, PIGEON.come);

  // 떼가 앉을 칸. 구멍 앞 칸(entry.near)에서 가까운 빈 바닥 칸부터 PIGEON.max개까지, 서로의 둘레 한 칸을 비워 고른다.
  // 아바타의 둘레(앉자마자 날아간다)와 내 펫의 둘레 한 칸(그림이 겹친다), 날아 들어오거나 나가는 동안 가구에 가려지는 칸에는 앉지 않는다
  function seats(entry) {
    const blocked = blockedOf(host.items());
    const pet = host.pet?.()?.claims() || [];
    const free = [];
    for (let x = 1; x < N; x++) {
      for (let y = 1; y < N; y++) {
        const c = { x, y };
        if (blocked.has(`${x},${y}`) || scares(x, y) || pet.some(p => far(p, c) <= 1)) continue;
        free.push({ c, d: Math.hypot(x - entry.near.x, y - entry.near.y) + Math.random() * SPREAD });
      }
    }
    free.sort((a, b) => a.d - b.d);
    const homes = [];
    for (const { c } of free) {
      if (homes.length === PIGEON.max) break;
      if (!homes.some(h => far(h, c) <= 1) && visible(c) && !hidden(host.items(), c, entry, 'in')) homes.push(c);
    }
    return homes;
  }

  // 창문 하나(없으면 현관문)를 골라 앉을 칸만큼 비둘기를 PIGEON.gap 간격으로 날려 보낸다. 앉을 칸이 없으면 아무도 오지 않고 다녀간 것으로 친다.
  // 비둘기마다 앉을 칸이 벽을 따라 놓인 자리대로 구멍의 이쪽과 저쪽에서 나오고(spread), 날아올 차례는 arrivals가 정한다.
  // 먼저 날아 들어온 비둘기와 공중에서 겹치면 그만큼 늦게 나온다(book)
  function come() {
    const windows = host.items().filter(isWindow);
    const entry = windows.length ? windowGate(any(windows)) : doorGate(host.door);
    const homes = seats(entry);
    if (!homes.length) {
      done();
      return;
    }
    state = 'here';
    coming = homes.length;
    chorus = Math.min(homes.length, PIGEON.chorus[0] + Math.floor(Math.random() * (PIGEON.chorus[1] - PIGEON.chorus[0] + 1)));
    const starts = spread(entry, homes, c => c);
    const plans = [];
    let t = 0;
    for (const home of arrivals(entry, homes, starts)) {
      const a = starts.get(home);
      const b = tile(home.x + 0.5, home.y + 0.5);
      const p = book({ a, b, ms: flyMs(a, b), fade: 'in' }, t, plans);
      plans.push(p);
      later(() => launch(entry, home, p), p.t0);
      t = p.t0 + PIGEON.gap[0] + Math.random() * (PIGEON.gap[1] - PIGEON.gap[0]);
    }
  }

  // 비둘기 한 마리가 나는 길 p대로 구멍에서 날아 들어와 home에 내려앉는다
  function launch(entry, home, p) {
    const me = { home, landed: false, out: false };
    me.bird = mountPet({
      layer: host.layer,
      items: host.items,
      avatar: host.avatar,
      others: () => [host.pet?.(), ...flock.filter(o => o !== me).map(o => o.bird)].filter(Boolean),
      look: () => LOOK,
      rest: PIGEON.rest,
      // 앉은 자리 둘레에서만 걷는다. 아바타 곁과 날아 나갈 때 가구에 가려지는 칸으로는 가지 않는다
      roam: (x, y) => far(me.home, { x, y }) <= PIGEON.roam && !scares(x, y) && visible({ x, y }),
      shy: () => leave(me.bird.spot(), true),
      title: '두 번 눌러 다가가기',
    });
    flock.push(me);
    if (!me.bird.flyIn({ at: p.a, near: home, ms: p.ms }, () => land(me))) {
      drop(me); // 그사이 앉을 칸 둘레가 다 막혔다
      return;
    }
    if (entry.door && !knocked) {
      knocked = true;
      play('enter');
    }
  }

  // 내려앉았다. 떼가 그사이 날아가기 시작했으면 곧바로 뒤따라 날아오른다.
  // 아직 날아오는 비둘기가 있으면 다 내려앉을 때까지 걷지 않고 앉아 있는다. 걷다가 뒤에 오는 비둘기의 나는 길 아래로 들어가지 않게 한다
  function land(me) {
    if (me.landed) return;
    me.landed = true;
    if (state === 'leaving') {
      takeOff(me);
      return;
    }
    me.bird.hold();
    if (!watchTimer) watchTimer = setInterval(watch, WATCH_MS);
    if (!sung.size) sing(me);
    settled();
  }
  // 오기로 한 비둘기가 다 내려앉았으면(앉지 못한 비둘기는 빼고) 모두 걷기 시작하고 머무는 시간을 센다
  function settled() {
    coming -= 1;
    if (coming === 0 && state === 'here') {
      for (const o of flock) o.bird.hold(false);
      stayTimer = setTimeout(() => leave(null, false), PIGEON.stay[0] + Math.random() * (PIGEON.stay[1] - PIGEON.stay[0]));
    }
  }
  // 앉을 칸이 없어 들어오지 못한 비둘기를 뺀다
  function drop(me) {
    me.bird.destroy();
    flock.splice(flock.indexOf(me), 1);
    if (!flock.length && state === 'leaving') done();
    else if (!me.landed) settled();
  }

  // 처음 내려앉은 비둘기부터 chorus마리가 차례로 "구구" 한다. 앞 비둘기의 말풍선이 사라지고 CHORUS_GAP 뒤에 아직 울지 않은 비둘기 하나가 운다.
  // 아홉 마리가 한꺼번에 울면 말풍선이 겹쳐 읽히지 않는다. 울 비둘기가 아직 날아오는 중이면 조금 기다렸다 고른다
  function sing(me) {
    me.bird.say(COO, PIGEON.coo);
    sung.add(me);
    const next = () => {
      if (state !== 'here' || sung.size >= chorus) return;
      const quiet = flock.filter(o => o.landed && !o.out && !sung.has(o));
      if (quiet.length) sing(any(quiet));
      else if (flock.some(o => !o.landed)) chorusTimer = setTimeout(next, CHORUS_GAP);
    };
    clearTimeout(chorusTimer);
    chorusTimer = setTimeout(next, PIGEON.coo + CHORUS_GAP);
  }

  // 아바타가 내려앉은 비둘기의 둘레 여덟 칸에 들어오면 떼가 날아간다. 걷는 아바타는 들어가는 칸으로 본다(spot)
  function watch() {
    const s = host.avatar()?.spot();
    if (s && flock.some(o => o.landed && !o.out && o.bird.claims().some(c => far(c, s) <= SCARE))) leave(s, true);
  }

  // 떼 전체가 날아 나간다. 모두 그 자리에 멈칫한 뒤(hold) cause(놀라게 한 칸. 아바타가 들어온 칸이나 두 번 누른 비둘기의 칸)에 가까운 비둘기부터
  // PIGEON.wave 간격으로 차례로 날아오른다. 머무는 시간이 다 되어 나갈 때(cause가 없을 때)는 아무 비둘기 하나가 먼저 뜨고 그 둘레부터 뒤따른다.
  // 아직 나타나지 않은 비둘기는 오지 않는다. 비둘기마다 지금 칸에서 가장 가까운 창문(없으면 현관문)으로 나가고(exitGate),
  // 다른 비둘기가 나갈 길 위에 앉은 비둘기는 그 비둘기보다 먼저 뜬다(queue). 앉은 비둘기 위로 날지 않게 하려는 것이다.
  // 구멍 안의 자리(SLOTS)는 먼저 뜬 비둘기와 공중에서 겹치지 않고 가장 일찍 뜰 수 있는 곳을 고른다(book).
  // startled: 다가온 아바타에 놀라 날아간다. 그때만 새소리를 한 번 내고, 머무는 시간이 다 되어 날아갈 때는 조용히 간다
  function leave(cause, startled) {
    if (state !== 'here') return;
    state = 'leaving';
    if (startled) play('pet-bird');
    clearTimeout(stayTimer);
    clearTimeout(chorusTimer);
    clearInterval(watchTimer);
    watchTimer = 0;
    for (const t of timers) clearTimeout(t);
    timers.clear();
    if (!flock.length) {
      done();
      return;
    }
    const spot = o => o.bird.spot() || o.home;
    const foot = o => tile(spot(o).x + 0.5, spot(o).y + 0.5);
    const start = cause || any(flock).home;
    const byWave = [...flock].sort((p, q) => Math.hypot(spot(p).x - start.x, spot(p).y - start.y) - Math.hypot(spot(q).x - start.x, spot(q).y - start.y));
    const gateOf = new Map(flock.map(o => [o, exitGate(spot(o))]));
    const path = o => { const b = pointIn(gateOf.get(o), 0.5, 0.5); return { a: foot(o), b, ms: flyMs(foot(o), b), fade: 'out' }; };
    const over = new Map(flock.map(o => [o, flock.filter(p => p !== o && crosses(path(p), foot(o)))]));
    const order = queue(byWave, o => flock.filter(p => over.get(p).includes(o))); // o의 길 위에 앉은 비둘기(p의 over에 o가 든 것)가 먼저 뜬다
    const plans = [];
    let wave = 0;
    let t = 0;
    for (const [i, o] of order.entries()) {
      const walking = o.bird.claims().length > 1; // 걷던 비둘기는 들어가던 칸에 다 와서 뜬다
      o.bird.hold();
      const g = gateOf.get(o);
      const a = foot(o);
      const sitting = order.slice(i + 1).map(foot); // 이 비둘기가 뜰 때 아직 앉아 있을 비둘기들
      let best = null;
      for (const slot of SLOTS) {
        const b = pointIn(g, ...slot);
        const ms = flyMs(a, b);
        const p = book({ a, b, ms, fade: 'out' }, walking ? Math.max(t, HOLD_MS) : t, plans);
        p.over = sitting.filter(f => crosses({ a, b, ms, fade: 'out' }, f)).length; // 앉은 비둘기 위로 지나가는 수. 적은 자리를 먼저 고른다
        if (!best || p.over < best.over || (p.over === best.over && (p.n < best.n || (p.n === best.n && p.t0 < best.t0)))) best = p;
      }
      plans.push(best);
      o.exit = { door: g.door, at: best.b, ms: best.ms };
      later(() => takeOff(o), best.t0);
      const gap = PIGEON.wave[0] + Math.random() * (PIGEON.wave[1] - PIGEON.wave[0]);
      wave += gap;
      t = Math.max(wave, best.t0 + gap); // 앞의 비둘기가 늦게 떴어도 뒤의 비둘기는 그보다 조금 늦게 뜬다
    }
  }

  // 한 마리가 날아오른다. 아직 날아오는 중이면 내려앉은 뒤 land가 다시 부른다
  function takeOff(o) {
    if (o.out || !o.landed) return;
    o.out = true;
    o.bird.flyOut({ at: o.exit.at, ms: o.exit.ms }, () => {
      flock.splice(flock.indexOf(o), 1);
      if (o.exit.door) outByDoor = true;
      if (flock.length) return;
      if (outByDoor) play('enter');
      done();
    });
  }

  function stop() {
    state = 'gone';
    for (const t of timers) clearTimeout(t);
    timers.clear();
    clearTimeout(stayTimer);
    clearTimeout(chorusTimer);
    clearInterval(watchTimer);
    for (const o of flock) o.bird.destroy();
    flock.length = 0;
  }
  // 방에서 사라졌다. os.js가 다음에 부를 때 새 떼가 오도록 알린다
  function done() {
    stop();
    host.gone();
  }

  return {
    // 방을 다시 그린 뒤 부른다(src/os.js의 renderWallpaper). 날아오던 비둘기는 내려앉을 칸에 바로 앉고, 날아 나가던 중이면 떼가 바로 사라진다.
    // 아직 나타나지 않은 비둘기는 제때 날아온다. here: 지금 공간이 내 방인지. 다른 공간이면 다녀간 것으로 친다
    attach(here) {
      if (state === 'coming') return;
      if (state !== 'here' || !here) {
        done();
        return;
      }
      clearOut.clear(); // 가구가 옮겨졌을 수 있다
      for (const o of [...flock]) {
        o.bird.attach(true);
        if (!o.bird.spot()) drop(o); // 다시 그린 방에 앉을 칸이 없다
        else land(o);
      }
    },
    birds: () => flock.map(o => o.bird),
    claims: () => flock.flatMap(o => o.bird.claims()),
    // 와 있는 비둘기 가운데 한 마리가 한 번 더 "구구" 한다. 아직 아무도 내려앉지 않았거나 날아 나가는 중이면 울지 않는다
    coo() {
      const here = flock.filter(o => o.landed && !o.out);
      if (state === 'here' && here.length) any(here).bird.say(COO, PIGEON.coo);
    },
    destroy: stop,
  };
}
