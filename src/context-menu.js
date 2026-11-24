// 오른쪽 단추 메뉴(윈도우의 바로 가기 메뉴). 사이트의 오른쪽 단추 메뉴는 모두 이것 하나로 띄운다.
// 자리마다 무슨 줄을 담을지는 그 자리를 아는 곳이 정한다. 바탕화면, 아이콘, 가구, 현관문, 아바타는 src/os.js의 menuFor,
// 창 제목 줄과 작업 표시줄 단추는 src/win.js의 win.menu, 펫은 src/pet.js의 showMenu다.
// 누른 자리에 뜨고, 무대 밖으로 나가면 반대쪽으로 편다. 한 번에 하나만 뜬다.
// 줄을 고르거나, 메뉴 밖을 누르거나, Esc나 Tab을 누르거나, 브라우저 창이 뒤로 가면 닫힌다. 위아래 방향키로 줄을 옮기고 Enter로 고른다.
// 메뉴가 받은 키는 바탕화면(아바타의 방향키 걷기와 Enter 말하기)에 넘기지 않는다.
// 메뉴는 무대(.stage)에 넣는다. 방 상자(.wallpaper)와 창 층(.windows)은 쌓임 맥락이 따로라, 그 안에 넣으면 다른 창이나 작업 표시줄 아래로 들어간다.
//
//   openMenu({ root: 무대, toStage }, contextmenu 이벤트, 줄 목록, '메뉴 이름')
// 줄 하나는 { label, run }이고 아래 값을 더할 수 있다. 거짓 값인 줄은 건너뛰고, '-'는 나누는 줄이다(맨 앞과 맨 끝, 겹친 것은 뺀다).
//   main: true       굵은 줄. 그 자리를 두 번 누를 때 하는 일이다(윈도우의 기본 명령). 창 메뉴만 윈도우처럼 닫기가 굵다
//   disabled: true   지금은 할 수 없는 줄. 회색이고 고를 수 없다(최대화한 창의 최대화)
//   tip: '...'       마우스를 올리면 보이는 글. 새 탭으로 가는 줄은 external: true로 바깥 화살표를 달고 갈 곳을 여기에 쓴다(known-issues 32)
// 돌려주는 것: { el, close() }. close는 그 메뉴가 아직 떠 있을 때만 닫는다
import { h, clamp } from './util.js';

let shown = null; // 지금 떠 있는 메뉴

export function openMenu({ root, toStage }, e, items, label) {
  shown?.close();
  const back = document.activeElement; // Esc로 닫으면 초점을 돌려준다. 창 안의 게임은 초점을 잃으면 그리기를 멈추기도 한다(known-issues 91)
  const lines = [];
  for (const it of items.filter(Boolean)) {
    if (it !== '-' || (lines.length && lines.at(-1) !== '-')) lines.push(it);
  }
  if (lines.at(-1) === '-') lines.pop();
  const line = it => (it === '-'
    ? h('div', { className: 'ctx-menu-sep', role: 'separator' })
    : h('button', {
      type: 'button',
      className: ['ctx-menu-item', it.main && 'main', it.external && 'external'].filter(Boolean).join(' '),
      role: 'menuitem',
      disabled: it.disabled,
      title: it.tip,
      tabIndex: -1,
      onclick: () => {
        menu.close();
        it.run();
      },
    }, it.label));
  const el = h('div', { className: 'ctx-menu', role: 'menu', tabIndex: -1, 'aria-label': label }, ...lines.map(line));
  const menu = { el, close: () => close(false) };

  el.addEventListener('contextmenu', ev => ev.preventDefault()); // 메뉴 위에서 다시 누르면 아무것도 띄우지 않는다
  el.addEventListener('keydown', ev => {
    ev.stopPropagation();
    const live = [...el.querySelectorAll('.ctx-menu-item:not(:disabled)')];
    const i = live.indexOf(document.activeElement);
    if (ev.key === 'Escape' || ev.key === 'Tab') {
      ev.preventDefault();
      close(true);
    } else if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && live.length) {
      ev.preventDefault();
      const d = ev.key === 'ArrowDown' ? 1 : -1;
      live[i < 0 ? (d > 0 ? 0 : live.length - 1) : (i + d + live.length) % live.length].focus();
    }
  });
  const outside = ev => {
    if (!el.contains(ev.target)) close(false);
  };
  const leave = () => close(false);

  root.append(el);
  // 키보드(Shift+F10, 메뉴 키)로 연 메뉴는 좌표가 비어 오므로 그 요소의 왼쪽 아래에 띄운다
  const r = e.clientX || e.clientY ? null : e.target.getBoundingClientRect?.();
  const p = toStage(r ? r.left : e.clientX, r ? r.bottom : e.clientY);
  const w = el.offsetWidth;
  const hh = el.offsetHeight;
  const x = p.x + w > root.clientWidth ? p.x - w : p.x;
  const y = p.y + hh > root.clientHeight ? p.y - hh : p.y;
  el.style.left = `${Math.round(clamp(x, 0, root.clientWidth - w))}px`;
  el.style.top = `${Math.round(clamp(y, 0, root.clientHeight - hh))}px`;
  document.addEventListener('pointerdown', outside, true);
  window.addEventListener('blur', leave);
  el.focus({ preventScroll: true });
  shown = menu;
  return menu;

  function close(refocus) {
    if (shown !== menu) return;
    shown = null;
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('blur', leave);
    el.remove();
    if (refocus && back?.isConnected) back.focus({ preventScroll: true });
  }
}

// 떠 있는 메뉴를 닫는다. 바탕화면을 떠날 때(로그아웃, 전원 끄기) 부른다
export function closeMenu() {
  shown?.close();
}
