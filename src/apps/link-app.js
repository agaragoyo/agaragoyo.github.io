// 다른 사이트의 페이지를 창 대신 새 탭으로 연다. data/apps.js에서 href가 있는 앱은 모두 이걸로 열린다.
// 추억의 플래시 게임처럼 다른 사이트의 창(iframe) 안에서는 게임이 시작되지 않는 곳에 쓴다(known-issues 31).
// 바로 열지 않고, 새 탭에서 열린다는 것과 열리는 주소를 먼저 보여 준다(known-issues 32). 이 탭이 그대로 남는다는 것처럼 당연한 말은 적지 않는다.
// 단추도 "예/아니오" 대신 누른 결과를 말하는 "새 탭에서 열기"와 "취소"로 둔다.
// 난이도가 나뉜 게임처럼 주소가 여럿이면 data/apps.js의 links에 { label, href }를 적는다. 단추마다 label을 그대로 쓰므로
// label도 누른 결과를 말하게 적는다(예: '초급으로 열기'). noun을 적으면 "이 게임은" 대신 그 말을 쓴다(예: '영상').
import { h } from '../util.js';

export function openLinkApp(os, app) {
  const links = app.links || [{ label: '새 탭에서 열기', href: app.href }];
  const host = new URL(links[0].href).host;
  return os.wm.open({
    key: app.id,
    app,
    title: app.title,
    width: 360 + (links.length - 1) * 110, // 단추 셋과 취소가 한 줄에 들어가는 폭(예전에 가장 넓던 2010 단추 약 132px 기준이라 2005에서는 조금 넉넉하다)
    height: 190,
    build(body, win) {
      // 새 탭은 진짜 링크(target="_blank")로 연다. 사람이 누른 링크는 팝업 차단에 걸리지 않고, 마우스를 올리면 브라우저가 주소도 보여 준다.
      // 창은 링크가 열린 다음에 닫는다. 누르는 도중에 링크를 화면에서 빼면 브라우저가 링크를 따라가지 않는다.
      const opens = links.map(l => h('a', { className: 'btn', href: l.href, target: '_blank', rel: 'noopener', onclick: () => setTimeout(() => win.close()) }, l.label));
      body.append(
        h('p', {}, `이 ${app.noun || '게임'}은 원작 사이트의 새 탭에서 열립니다.`),
        h('p', { className: 'meta' }, `열리는 곳: ${host}`),
        h('div', { className: 'link-row' },
          ...opens,
          h('button', { className: 'btn', type: 'button', onclick: () => win.close() }, '취소')),
      );
    },
  });
}
