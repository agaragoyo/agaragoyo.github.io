// 기본 앱: 공유하기. 지금 집 모습을 담은 링크를 만들어 복사하게 한다.
import { encodeHome } from '../share.js';
import { h } from '../util.js';

export function openShareApp(os, app) {
  const link = `${location.origin}${location.pathname}#room=${encodeHome(os.home)}`;
  return os.wm.open({
    key: app.id,
    app,
    title: '공유 링크',
    width: 540,
    height: 150,
    build(body) {
      const input = h('input', { type: 'text', readOnly: true, value: link, 'aria-label': '공유 링크' });
      const copy = async () => {
        try { await navigator.clipboard.writeText(link); } catch { input.select(); document.execCommand('copy'); }
        os.toast('링크를 복사했습니다.');
      };
      body.append(
        h('p', {}, '이 링크를 받은 친구는 내 컴퓨터에 손님으로 들어와 지금 모습 그대로 방을 구경할 수 있습니다. ',
          '방을 고친 뒤에는 링크를 다시 복사해서 보내 주세요.'),
        h('div', { className: 'share-row' }, input, h('button', { type: 'button', className: 'btn', onclick: copy }, '복사')),
      );
    },
  });
}
