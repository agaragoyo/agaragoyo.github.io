// 이 컴퓨터에 앉은 사용자가 바뀌었는지 알아본다(F36). 한 브라우저의 탭들은 저장소 하나를 같이 쓰므로, 한 탭에서 다른 아이디로 로그인하거나
// 이 컴퓨터에서 빼거나 초기화하면 다른 탭의 메모리에는 앞 사용자의 집이 남는다. 그대로 저장하거나 올리면 새 사용자의 저장본과 서버의 방을 앞 사용자의 방으로 덮는다.
//   reseat()         사용자를 바꾸는 일(로그인, 빼기, 초기화)이 무작위 표시(STORAGE_SEAT)를 저장소에 새로 남긴다. 다른 것을 지우거나 쓰기 전에 부른다
//   sit()            이 탭이 저장된 사용자를 새로 읽었다(로그인 화면, 친구 집에서 내 컴퓨터로). 그때의 표시를 기억한다
//   moved()          그 뒤에 다른 탭에서 사용자가 바뀌었는지. 저장하고 올리기 전에 본다. 바뀌었으면 하지 않고 로그인 화면으로 돌아간다(src/os.js의 leave)
//   seat()           기억한 표시. 나중에 할 일(예약한 올리기)에 적어 두었다가 할 때 movedFrom(표시)로 견준다
// 같은 사용자의 다시 로그인, 비밀번호 만들기와 바꾸기는 표시를 남기지 않는다. 다른 탭에 있는 것도 같은 사용자의 집이다.
// 표시가 아예 없어진 것은 브라우저의 사이트 데이터가 지워진 것이라 바뀐 것으로 보지 않는다. 열려 있는 탭의 다음 저장이 집을 되살린다.
import { STORAGE_SEAT } from './config.js';
import { loadJSON, saveJSON } from './util.js';

const stored = () => loadJSON(STORAGE_SEAT);
let mine = stored();

export const seat = () => mine;
export const sit = () => { mine = stored(); };
export const movedFrom = mark => {
  const now = stored();
  return now !== null && now !== mark;
};
export const moved = () => movedFrom(mine);
export function reseat() {
  saveJSON(STORAGE_SEAT, Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join(''));
  sit(); // 저장소를 못 쓰는 환경이면 표시가 남지 않는다. 남은 것을 그대로 기억한다
}
