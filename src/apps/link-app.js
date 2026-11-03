// 다른 사이트의 페이지를 창 대신 새 탭으로 연다. data/apps.js에서 href가 있는 앱은 모두 이걸로 열린다.
// 추억의 플래시 게임처럼 다른 사이트의 창(iframe) 안에서는 게임이 시작되지 않는 곳에 쓴다(known-issues 31).
// 바로 열지 않고, 새 탭에서 열린다는 것과 열리는 주소를 먼저 보여 준다(known-issues 32). 이 탭이 그대로 남는다는 것처럼 당연한 말은 적지 않는다.
// 단추도 "예/아니오" 대신 누른 결과를 말하는 "새 탭에서 열기"와 "취소"로 둔다.
import { h } from '../util.js';

export function openLinkApp(os, app) {
  const host = new URL(app.href).host;
  return os.wm.open({
    key: app.id,
    app,
    title: app.title,
    width: 360,
    height: 190,
    build(body, win) {
      // 새 탭은 진짜 링크(target="_blank")로 연다. 사람이 누른 링크는 팝업 차단에 걸리지 않고, 마우스를 올리면 브라우저가 주소도 보여 준다.
      // 창은 링크가 열린 다음에 닫는다. 누르는 도중에 링크를 화면에서 빼면 브라우저가 링크를 따라가지 않는다.
      const open = h('a', { className: 'btn', href: app.href, target: '_blank', rel: 'noopener', onclick: () => setTimeout(() => win.close()) }, '새 탭에서 열기');
      body.append(
        h('p', {}, '이 게임은 원작 사이트의 새 탭에서 열립니다.'),
        h('p', { className: 'meta' }, `열리는 곳: ${host}`),
        h('div', { className: 'link-row' },
          open,
          h('button', { className: 'btn', type: 'button', onclick: () => win.close() }, '취소')),
      );
    },
  });
}
