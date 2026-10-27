// 아이콘 그림. 기본 앱은 SVG를 직접 그리고, 나머지는 앱 목록의 그림 경로를 쓴다.
const BUILTIN = {
  room: `<svg viewBox="0 0 48 48"><polygon points="24,6 42,15 42,33 24,42 6,33 6,15" fill="#f2e6cb" stroke="#5a4632" stroke-width="2"/>
    <polygon points="24,24 42,15 42,33 24,42" fill="#e3d2ad" stroke="#5a4632" stroke-width="2"/>
    <polygon points="6,33 24,42 42,33 24,24" fill="#c69a6b" stroke="#5a4632" stroke-width="2"/>
    <polygon points="20,30 28,26 32,28 24,32" fill="#8fa9d6" stroke="#3b4f73" stroke-width="1.5"/></svg>`,
  folder: `<svg viewBox="0 0 48 48"><path d="M5 12 h14 l4 5 h20 v23 h-38 z" fill="#e8b84a" stroke="#7a5a12" stroke-width="2"/>
    <path d="M5 19 h38 v21 h-38 z" fill="#f6cf6a" stroke="#7a5a12" stroke-width="2"/>
    <rect x="19" y="25" width="10" height="7" rx="2" fill="#7a5a12"/><circle cx="21.5" cy="28.5" r="1" fill="#f6cf6a"/><circle cx="26.5" cy="28.5" r="1" fill="#f6cf6a"/></svg>`,
  share: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="17" fill="#a9d6e5" stroke="#2f5d6e" stroke-width="2"/>
    <path d="M7 24 h34 M24 7 c-8 9 -8 25 0 34 M24 7 c8 9 8 25 0 34" fill="none" stroke="#2f5d6e" stroke-width="1.8"/>
    <rect x="25" y="27" width="16" height="10" rx="5" fill="#f7f3e8" stroke="#6b2d5c" stroke-width="2"/><path d="M30 32 h6" stroke="#6b2d5c" stroke-width="2"/></svg>`,
  furniture: `<svg viewBox="0 0 48 48"><rect x="8" y="10" width="32" height="28" rx="3" fill="#f7f3e8" stroke="#5a4632" stroke-width="2"/>
    <rect x="8" y="10" width="32" height="7" fill="#6b2d5c"/><path d="M14 24 h20 M14 30 h14" stroke="#5a4632" stroke-width="2"/></svg>`,
};

// 아이콘 요소 하나. app: 앱 목록의 항목
export function iconEl(app, size = 48) {
  const box = document.createElement('span');
  box.className = 'app-icon';
  box.style.width = box.style.height = size + 'px';
  if (app.icon?.startsWith('builtin:')) {
    box.innerHTML = BUILTIN[app.icon.slice(8)] || BUILTIN.furniture;
    return box;
  }
  const letter = () => {
    box.classList.add('letter');
    box.style.background = app.color || '#8a8fb0';
    box.style.fontSize = Math.round(size * 0.5) + 'px';
    box.textContent = [...app.title][0];
  };
  if (!app.icon) { letter(); return box; }
  const img = new Image();
  img.alt = '';
  img.draggable = false;
  img.onerror = () => { img.remove(); letter(); };
  img.src = app.icon;
  box.classList.add('picture');
  box.append(img);
  return box;
}
