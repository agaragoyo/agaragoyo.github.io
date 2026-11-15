// 숨은 암호. 내 컴퓨터의 바탕화면에서 Enter를 눌러 말풍선에 암호를 말하면 숨은 기능이 열린다.
// 말풍선에 쓴 말(앞뒤 공백을 뺀 글)은 src/os.js의 onSay가 trySecret으로 넘긴다. 손님 화면, 친구 집과 이웃집에서는 아무 일도 없다.
//
// 암호를 더하는 법
//   1. 아래 SECRETS에 한 줄을 더한다. word는 말풍선에 쓸 말이고, run(os)은 그 말을 했을 때 할 일이다.
//      loose: true이면 공백을 빼고 보아 그 말로 시작하는 말도 받는다(주문을 이어서 외는 분신사바).
//   2. docs/requirements.md의 기능 표에 새 번호로 한 줄을 쓴다. 공개 레포라 누구나 볼 수 있지만 팀원이 찾아 쓸 수 있게
//      그 줄에 암호도 적는다(실험실 F24, 분신사바 F28과 같다).
//   하는 일이 크면 파일을 따로 두고 여기서는 부르기만 한다(분신사바는 src/horror.js).
import { labsOpen, openLabs } from './labs.js';

export const SECRETS = [
  // 숨은 실험실(F24, src/labs.js). 바탕화면에 실험실 아이콘이 생긴다. 이미 열었으면 아무 일도 없다
  {
    word: '엔믹스지우',
    run: os => {
      if (labsOpen()) return;
      openLabs();
      os.toast('바탕화면에 실험실 아이콘이 생겼습니다.', 4000);
    },
  },
  // 분신사바(F28, src/horror.js). 방의 불이 꺼지고 공포 모드가 된다. 불을 켜면 풀린다.
  // "분신사바 분신사바 오딧세이 꾸다사이"처럼 주문을 끝까지 외어도 된다
  { word: '분신사바', loose: true, run: os => os.horror.start() },
];

const said = (text, secret) => (secret.loose ? text.replace(/\s/g, '').startsWith(secret.word) : text === secret.word);

// 말풍선에 쓴 말이 암호이면 그 일을 한다. 내 컴퓨터(os.mode가 'edit')에서만 듣는다
export function trySecret(os, text) {
  if (os.mode !== 'edit') return;
  SECRETS.find(secret => said(text, secret))?.run(os);
}
