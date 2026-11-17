// 숨은 암호. 내 컴퓨터의 바탕화면에서 Enter를 눌러 말풍선에 암호를 말하면 숨은 기능이 열린다.
// 말풍선에 쓴 말(앞뒤 공백을 뺀 글)은 src/os.js의 onSay가 trySecret으로 넘긴다. 손님 화면, 친구 집과 이웃집에서는 아무 일도 없다.
//
// 암호를 더하는 법
//   1. 아래 SECRETS에 한 줄을 더한다. word는 말풍선에 쓸 말이고, run(os)은 그 말을 했을 때 할 일이다.
//      loose: true이면 공백을 빼고 보아 그 말로 시작하는 말도 받는다(주문을 이어서 외는 분신사바).
//   2. docs/requirements.md의 기능 표에 새 번호로 한 줄을 쓴다. 공개 레포라 누구나 볼 수 있지만 팀원이 찾아 쓸 수 있게
//      그 줄에 암호도 적는다(실험실 F24, 분신사바 F29, 비둘기 F32와 같다).
//   3. 손님과 플레이테스터가 찾게 할 기능이면 아래 HINTS에 TV가 알려 줄 소문을 한 줄 더한다.
//   하는 일이 크면 파일을 따로 두고 여기서는 부르기만 한다(분신사바는 src/horror.js, 비둘기는 src/pigeon.js).
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
  // 분신사바(F29, src/horror.js). 방의 불이 꺼지고 공포 모드가 된다. 불을 켜면 풀린다.
  // "분신사바 분신사바 오딧세이 꾸다사이"처럼 주문을 끝까지 외어도 된다
  { word: '분신사바', loose: true, run: os => os.horror.start() },
  // 비둘기(F32, src/pigeon.js). 9는 "구"라서 9를 아홉 번 부르면 "구구" 우는 비둘기가 창문이나 현관문으로 날아와 조금 있다 간다
  { word: '999999999', run: os => os.callPigeon() },
];

// TV의 소문(src/apps/tv-app.js). 내 컴퓨터의 진짜 집에서 TV를 켜면 화면 아래 띠에 이 가운데 한 줄이 뜨고, 켤 때마다 다음 줄로 넘어간다.
// 스타듀 밸리의 TV 팁 채널과 옛 프로그램의 "오늘의 팁"처럼 한 번에 하나씩 알려 준다. 어디서 무엇을 하면 되는지는 알려 주되
// 무슨 일이 생기는지는 다 말하지 않는다. 실험실 암호는 팀원용이라 넣지 않는다. 말투는 AGENTS.md 말투 표의 "TV 화면 아래 띠의 소문" 줄이다
export const HINTS = [
  '말풍선에 9를 아홉 번 쓰면 반가운 손님이 날아온대요.',                    // 비둘기(F32)
  '말풍선에 "오딧세이 꾸다사이"로 끝나는 주문을 외우면 무서운 일이 생긴대요.', // 분신사바(F29)
  '병아리를 자꾸 쓰다듬어 주면 쑥쑥 자란대요.',                             // 병아리가 닭이 된다(F30)
];

const said = (text, secret) => (secret.loose ? text.replace(/\s/g, '').startsWith(secret.word) : text === secret.word);

// 말풍선에 쓴 말이 암호이면 그 일을 한다. 내 컴퓨터(os.mode가 'edit')에서만 듣는다
export function trySecret(os, text) {
  if (os.mode !== 'edit') return;
  SECRETS.find(secret => said(text, secret))?.run(os);
}
