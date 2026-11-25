// 내 방을 서버의 방과 맞춘다(F36). 비밀번호가 있는 사용자(src/cloud.js의 hasPassword)가 링크를 만든 방에만 한다. 그 밖의 사용자에게는 아무 일도 하지 않는다.
// 같은 사용자의 방을 두 브라우저에서 고쳤을 때 나중에 올린 쪽이 먼저 올린 것을 조용히 덮지 않게 한다.
//   들어갈 때      부팅하는 동안 서버의 방을 미리 읽고(prefetch), 내 컴퓨터로 들어가는 환영 화면에서 최대 WAIT 동안 기다린다(read).
//                  한쪽만 바뀌었으면 바뀐 쪽을 묻지 않고 쓰고(settle), 양쪽이 다르게 바뀌었으면 바탕화면이 뜬 뒤에 고르게 한다(ask).
//                  서버에 닿지 못하면 이 컴퓨터의 방으로 들어간다. 그 뒤의 올리기는 src/cloud.js가 판(rev)을 걸어 막는다
//   앉아 있는 동안  올리기가 거절되면(src/cloud.js의 onServerRoom) 조용한 때(busy가 거짓인 때)를 기다려 같은 일을 한다
// 어느 쪽을 쓸지 정하는 것은 src/room-merge.js이고, 고르는 창은 src/apps/two-rooms-app.js다.
// 튜토리얼 연습 방(os.realHome)에서는 아무것도 하지 않는다. 연습이 끝난 뒤에 한다(known-issues 40).
import { STORAGE_ROOM } from './config.js';
import { decodeHome } from './share.js';
import {
  hasPassword, sharedId, readMine, isFresh, isKnown, landed, acceptServer, forgetRemoved, pauseSync, sentCode, lastEdited,
  onServerRoom, onRemoved, syncLater, syncNow,
} from './cloud.js';
import { mergeRooms, decide } from './room-merge.js';
import { saveOwnPicture } from './user-pictures.js';
import { myRecords } from './records.js';
import { preloadFurniture } from './room.js';
import { openTwoRooms } from './apps/two-rooms-app.js';
import { saveJSON, wait } from './util.js';

const WAIT = 4000;   // 환영 화면에서 서버의 방을 기다리는 가장 긴 시간
const FRESH = 30000; // 부팅할 때 읽은 서버의 방을 그대로 쓰는 시간. 로그인 화면에 오래 있었으면 다시 읽는다
const RETRY = 1000;  // 조용하지 않을 때 다시 보는 간격

// os: 창과 집, 설정. roomCode(집): 서버에 올리는 글자. runOf(): 지금 실행 번호. isCurrent(번호): 그 실행이 아직인지
// busy(): 저절로 뜨는 창이 끼어들면 안 되는 때인지. redraw(): 바탕화면 방을 다시 그리고 예전 방을 보던 창을 닫는다. notice(글): 다른 알림 뒤에 띄우는 알림
export function createHomeSync({ os, settings, roomCode, runOf, isCurrent, busy, redraw, notice }) {
  let pulled = null; // 부팅할 때 읽기 시작한 일 { at, done }
  let asking = null; // 바탕화면이 뜬 뒤에 물을 서버의 방
  let timer = 0;

  const active = () => hasPassword() && !!sharedId();

  // 서버의 방을 읽는다. { id, theirs, seen }이고 닿지 못하면 undefined다
  const startRead = () => ({
    at: Date.now(),
    done: readMine().catch(err => {
      console.warn('내 방을 서버에서 읽지 못했다', err);
      return undefined;
    }),
  });

  // 부팅할 때 서버의 방을 미리 읽고 그 방의 가구 그림을 받아 둔다(환영 화면을 지나면 바로 쓴다)
  function prefetch() {
    if (!active()) return;
    pulled = startRead();
    pulled.done.then(got => {
      const home = got?.theirs && decodeHome(got.theirs.code);
      if (home) preloadFurniture([home]);
    });
  }

  // 내 컴퓨터로 들어갈 때 부른다. 비밀번호가 없는 사용자이거나 링크가 없으면 null이고, 있으면 서버의 방을 읽는 일(Promise)이다
  function read() {
    if (!active()) return null;
    pauseSync(false); // 지난번에 고르지 않고 닫아 멈춰 둔 올리기. 아래에서 다시 묻는다
    const job = pulled && Date.now() - pulled.at < FRESH ? pulled : startRead();
    pulled = null;
    return Promise.race([job.done, wait(WAIT).then(() => undefined)]);
  }

  // 환영 화면에서 읽은 것(read)으로 들어갈 집을 정한다. home은 이 컴퓨터에 저장된 집이다. 바탕화면을 열기 전에 부르고, 물을 것이 있으면 asking에 남긴다
  function enter(got, home) {
    asking = null;
    if (!got || !isFresh(got)) return home; // 닿지 못했거나 그사이에 이 컴퓨터가 올렸다
    const { theirs } = got;
    if (!theirs) {
      forgetRemoved(); // 다른 브라우저에서 링크를 지웠다
      return home;
    }
    if (isKnown(theirs)) return home; // 서버의 방이 마지막에 본 그대로다
    const merge = compare(theirs, home);
    if (merge.room === 'ask') asking = theirs;
    if (merge.room === 'ask' || merge.room === 'unreadable') pauseSync(true); // 고를 때까지, 또는 풀 수 없는 방을 덮지 않게 올리지 않는다
    else settle(theirs, decide(merge), merge);
    return os.home;
  }

  // 서버의 방과 이 컴퓨터의 방을 견준다. 답을 잃은 내 올리기였으면 먼저 sent를 맞춘다
  function compare(theirs, home) {
    landed(theirs);
    return mergeRooms({ base: sentCode(), mine: roomCode(home), theirs: theirs.code });
  }

  // 결론을 이 컴퓨터에 쓴다. 서버의 방을 쓰기로 했으면 저장된 방과 사진을 바꾸고, 펫은 설정에, 기록은 큰 쪽을 게임마다 남긴다.
  // 집 상태에는 사진, 기록, 펫을 두지 않는다(따로 저장한다). 여기까지 하면 이 컴퓨터의 바탕이 서버의 방이 된다
  function settle(theirs, { room, pet, records }, merge) {
    const adopt = room === 'theirs';
    if (adopt) {
      const { picture, records: _records, pet: _pet, ...home } = merge.theirs;
      saveJSON(STORAGE_ROOM, home);
      if (picture) saveOwnPicture(picture);
      os.home = home;
    }
    acceptServer(theirs, adopt); // 예전 방의 올리던 글자를 버린 다음에 펫을 바꾼다
    if (pet) settings.set({ pet: pet.id, petPats: pet.pats });
    const mine = myRecords() || {};
    for (const [id, v] of Object.entries(records || {})) {
      if (v > (mine[id] || 0)) saveJSON(`${id}.best`, v);
    }
  }

  // 바탕화면이 뜬 뒤 부른다. 들어올 때 물을 것이 남았으면 창을 띄운다. 물을 것이 없으면 지금 방을 올린다
  function arrived(my) {
    if (asking) {
      const theirs = asking;
      asking = null;
      meet(theirs, my);
    } else {
      syncLater(() => roomCode(os.home));
    }
  }

  // 서버의 방(theirs)과 견줘 정한다. 앉아 있는 동안 올리기가 거절되었을 때와, 들어온 뒤 물을 것이 있을 때 부른다.
  // 조용하지 않으면 1초 뒤에 다시 본다. 친구 집이나 로그인 화면으로 갔으면 다음에 내 컴퓨터로 들어올 때 다시 읽는다
  function meet(theirs, my = runOf()) {
    clearTimeout(timer);
    if (!isCurrent(my) || os.mode !== 'edit') return;
    const later = () => { timer = setTimeout(() => meet(theirs, my), RETRY); };
    if (busy()) return later();
    const merge = compare(theirs, os.home);
    if (merge.room === 'unreadable') return pauseSync(true);
    if (merge.room === 'ask') {
      pauseSync(true);
      return openTwoRooms(os, {
        mine: { home: merge.mine, at: lastEdited() },
        theirs: { home: merge.theirs, at: Date.parse(theirs.rev) || 0 },
        pick: choice => choose(theirs, choice),
      });
    }
    if (merge.room === 'theirs' && os.wm.get('room')) return later(); // 방 꾸미기를 하는 중에는 방을 바꾸지 않는다. 고쳤으면 다음에 볼 때 묻는다
    const { room } = decide(merge);
    settle(theirs, decide(merge), merge);
    if (room === 'theirs') {
      redraw();
      notice('다른 브라우저에서 고친 방으로 바꿨습니다.');
    }
    syncLater(() => roomCode(os.home));
  }

  // 주인이 고른 방을 남긴다. mine이면 이 컴퓨터의 방을 서버에 올리고, theirs면 이 컴퓨터의 방을 서버의 방으로 바꾼다.
  // 고르는 사이에 이 컴퓨터의 방을 더 고쳤을 수 있어 지금 방으로 다시 견준다
  async function choose(theirs, choice) {
    const merge = compare(theirs, os.home);
    settle(theirs, decide(merge, choice), merge);
    if (choice === 'theirs') {
      redraw();
      syncLater(() => roomCode(os.home)); // 기록이나 펫이 이 컴퓨터가 더 컸으면 올린다
      os.toast('서버의 방을 남겼습니다.', 4000);
      return;
    }
    try {
      await syncNow(() => roomCode(os.home));
      os.toast('이 컴퓨터의 방을 남겼습니다.', 4000);
    } catch (err) {
      if (['changed', 'removed', 'lost'].includes(err.reason)) return; // 따로 알린다
      console.warn('고른 방을 서버에 올리지 못했다', err);
      os.toast('고른 방을 서버에 올리지 못했습니다. 잠시 후 다시 시도해 주세요.', 7000);
    }
  }

  onServerRoom(theirs => meet(theirs));
  onRemoved(() => notice('다른 브라우저에서 공유 링크를 지웠습니다.'));

  return { prefetch, read, enter, arrived };
}
