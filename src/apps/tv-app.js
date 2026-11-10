// 가구 기믹: TV(F12). 누르면 TV를 가까이 보며, 화면에 주인이 넣어 둔 영화와 TV 시리즈의 포스터가 넷플릭스 추천 줄처럼 늘어선다.
// 휠이나 ←, → 방향키로 넘겨 보고, 고른 작품의 이름, 연도, 감독, 추천 이유와 보러 갈 링크(새 탭)가 아래에 뜬다.
// 주인은 작품을 6편까지 넣는다. 넣을 때는 이름으로 찾는 단계를 거치고, 찾기는 API 키가 필요 없는 위키데이터를 쓴다(2026-11-10 정함).
// 찾은 작품을 고르면 이름, 연도, 감독, 위키백과 링크가 채워지고, 포스터는 주인이 그림 주소를 붙여 넣는다. 포스터가 없으면 책 표지처럼 제목 카드를 건다.
// 넣은 작품은 likes.tv에 저장되고 공유 링크에도 담긴다(src/likes.js). 손님에게는 넣기, 고치기, 빼기 단추가 없다.
import { h, clamp } from '../util.js';
import { openCloseup } from '../closeup.js';
import { BOOK_COLORS } from './bookshelf-app.js';
import { LIMIT, safeLink, safeImage, setLike, isOwner } from '../likes.js';

// ---------- 위키데이터(키 없이 다른 사이트에서 부를 수 있다, origin=*) ----------
const WD = 'https://www.wikidata.org/w/api.php';
async function wd(params) {
  const r = await fetch(`${WD}?${new URLSearchParams({ ...params, format: 'json', origin: '*' })}`);
  if (!r.ok) throw new Error(`위키데이터가 ${r.status}로 답했다`);
  return r.json();
}
// 찾을 작품의 종류(위키데이터 P31, "무엇의 한 종류인가"). 이름 검색만 하면 같은 이름의 음반, 노래, 낱말 뜻까지 나와서
// 영화와 TV 작품으로 분류된 문서만 고른다. 일본 애니메이션 영화는 "영화"가 아니라 "애니메이션 영화"(Q20650540)로 분류되는 식이라 갈래마다 적는다.
const WORK_TYPES = [
  'Q11424',    // 영화
  'Q29168811', // 장편 애니메이션 영화
  'Q20650540', // 일본 애니메이션 영화
  'Q202866',   // 애니메이션 영화
  'Q24862',    // 단편 영화
  'Q17517379', // 단편 애니메이션 영화
  'Q93204',    // 다큐멘터리 영화
  'Q229390',   // 3D 영화
  'Q506240',   // TV 영화
  'Q24856',    // 영화 시리즈
  'Q5398426',  // TV 시리즈(드라마 대부분)
  'Q1259759',  // 미니시리즈
  'Q581714',   // 애니메이션 시리즈
  'Q63952888', // 일본 애니메이션 TV 시리즈
  'Q526877',   // 웹 시리즈
  'Q15416',    // TV 프로그램(예능 등)
];
// 이름으로 찾기. 위키데이터 전문 검색에 종류 조건(haswbstatement)을 붙여 영화와 TV 작품만 받고, 이름과 설명은 따로 받는다.
// 설명(description)에 "2019년 봉준호 감독의 영화"처럼 연도와 감독이 들어 있는 일이 많아 그대로 보여 준다
async function searchWorks(q) {
  const s = await wd({ action: 'query', list: 'search', srnamespace: '0', srlimit: '8', srsearch: `${q} haswbstatement:${WORK_TYPES.map(t => `P31=${t}`).join('|')}` });
  const ids = (s.query?.search || []).map(r => String(r.title)).filter(id => /^Q\d+$/.test(id));
  if (!ids.length) return [];
  const d = await wd({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels|descriptions', languages: 'ko|en' });
  return ids.map(id => {
    const e = d.entities?.[id] || {};
    return { id, label: String(e.labels?.ko?.value || e.labels?.en?.value || id), about: String(e.descriptions?.ko?.value || e.descriptions?.en?.value || '') };
  });
}
// 고른 작품의 이름, 연도(개봉일, 방영 시작과 끝), 감독(두 명까지), 위키백과 링크
async function workDetails(id) {
  const d = await wd({ action: 'wbgetentities', ids: id, props: 'labels|claims|sitelinks', languages: 'ko|en', sitefilter: 'kowiki|enwiki' });
  const e = d.entities?.[id];
  if (!e) return null;
  const year = p => (e.claims?.[p] || []).map(c => c.mainsnak?.datavalue?.value?.time).filter(t => typeof t === 'string').sort()[0]?.slice(1, 5) || '';
  const from = year('P577') || year('P580');
  const to = year('P582');
  const ids = (e.claims?.P57 || []).map(c => c.mainsnak?.datavalue?.value?.id).filter(x => /^Q\d+$/.test(x || '')).slice(0, 2);
  let by = '';
  if (ids.length) {
    const l = await wd({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels', languages: 'ko|en' });
    by = ids.map(x => l.entities?.[x]?.labels?.ko?.value || l.entities?.[x]?.labels?.en?.value).filter(Boolean).join(', ');
  }
  const site = e.sitelinks?.kowiki ? ['ko', e.sitelinks.kowiki.title] : e.sitelinks?.enwiki ? ['en', e.sitelinks.enwiki.title] : null;
  return {
    title: e.labels?.ko?.value || e.labels?.en?.value || '',
    year: from && to && to !== from ? `${from}~${to}` : from,
    by,
    link: site ? `https://${site[0]}.wikipedia.org/wiki/${encodeURIComponent(site[1].replace(/ /g, '_'))}` : `https://www.wikidata.org/wiki/${id}`,
  };
}

// 포스터 하나. 주인이 넣은 그림이 있으면 제목 카드 위에 덮고, 그림을 못 받으면 제목 카드가 그대로 보인다
function poster(w) {
  const card = h('div', { className: 'tv-poster' }, h('div', { className: 'tv-poster-label' }, h('b', {}, w.title), w.year ? h('span', {}, w.year) : null));
  card.style.setProperty('--book', BOOK_COLORS[w.color]);
  if (w.poster) {
    const img = h('img', { alt: '', referrerPolicy: 'no-referrer' });
    img.addEventListener('error', () => img.remove());
    img.src = w.poster;
    card.append(img);
  }
  return card;
}

export function openTvApp(os, app) {
  const owner = isOwner(os);
  const works = () => os.home.likes.tv || [];
  if (!owner && !works().length) return os.say('넣어 둔 작품이 없네.');

  return openCloseup(os, {
    key: app.id,
    title: app.title,
    className: 'tv-closeup',
    build(panel, cu) {
      const screen = h('div', { className: 'tv-screen' });
      const tools = h('div', { className: 'tv-tools' });
      const dial = () => h('div', { className: 'tv-dial' }, h('i'));
      panel.append(
        h('div', { className: 'tv-antenna', 'aria-hidden': 'true' }, h('i'), h('i')),
        h('div', { className: 'tv-body' },
          h('div', { className: 'tv-bezel' }, screen),
          h('div', { className: 'tv-side', 'aria-hidden': 'true' }, dial(), dial(), h('div', { className: 'tv-grille' }))),
        h('div', { className: 'tv-legs', 'aria-hidden': 'true' }, h('i'), h('i')),
        tools);

      let at = 0;     // 고른 작품
      let row = null; // 포스터 줄(보는 화면일 때만)
      let alive = true;

      const go = i => {
        if (!works().length) return;
        at = clamp(i, 0, works().length - 1);
        show();
      };

      // 보는 화면: 포스터 줄과 고른 작품
      function show() {
        const list = works();
        at = clamp(at, 0, Math.max(0, list.length - 1));
        const w = list[at];
        row = h('div', { className: 'tv-row' }, ...list.map((x, i) => h('button', {
          type: 'button',
          className: i === at ? 'tv-pick on' : 'tv-pick',
          'aria-label': x.title,
          onclick: () => go(i),
        }, poster(x))));
        // 세로 휠도 가로로 넘긴다(요구 사항의 "스크롤로 넘겨 봅니다")
        row.addEventListener('wheel', e => {
          if (e.ctrlKey || !e.deltaY || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
          e.preventDefault();
          row.scrollLeft += e.deltaY;
        }, { passive: false });
        const detail = w ? h('div', { className: 'tv-detail' },
          h('p', { className: 'tv-title' }, w.title, w.year ? h('span', {}, ` (${w.year})`) : null),
          w.by ? h('p', { className: 'tv-by' }, `감독 ${w.by}`) : null,
          w.why ? h('p', { className: 'tv-why' }, w.why) : null,
          w.link ? h('p', { className: 'tv-link' },
            h('a', { className: 'btn', href: w.link, target: '_blank', rel: 'noopener noreferrer' }, '새 탭에서 보기'),
            h('span', {}, `열리는 곳: ${new URL(w.link).host}`)) : null) : null;
        screen.replaceChildren(
          h('div', { className: 'tv-head' }, h('b', {}, `${os.home.owner}의 추천 작품`), list.length > 1 ? h('span', {}, '휠이나 방향키로 넘겨 보세요.') : null),
          list.length ? row : h('p', { className: 'tv-none' }, '아직 넣은 작품이 없습니다.'),
          detail);
        // 고른 포스터가 보이게 줄만 옮긴다(scrollIntoView는 화면 바깥 상자까지 옮길 수 있어 쓰지 않는다)
        const c = row.children[at];
        if (c && c.offsetLeft + c.offsetWidth > row.clientWidth) row.scrollLeft = c.offsetLeft + c.offsetWidth - row.clientWidth + 12;
        tools.replaceChildren(...(owner ? [
          list.length < LIMIT.works ? h('button', { type: 'button', className: 'btn', onclick: () => search() }, '작품 넣기') : null,
          w ? h('button', { type: 'button', className: 'btn', onclick: () => details(w, at) }, '고치기') : null,
          w ? h('button', { type: 'button', className: 'btn', onclick: remove }, '이 작품 빼기') : null,
        ].filter(Boolean) : []));
      }

      const back = () => (works().length ? show() : cu.close());

      // 넣기 1단계: 이름으로 찾기
      function search(q = '') {
        row = null;
        tools.replaceChildren();
        const input = h('input', { type: 'text', value: q, maxLength: LIMIT.workTitle });
        const hits = h('div', { className: 'tv-hits' });
        const status = h('p', { className: 'like-error', hidden: true });
        const say = msg => { status.textContent = msg; status.hidden = !msg; };
        const find = async e => {
          e?.preventDefault();
          const text = input.value.trim();
          if (!text) return say('찾을 이름이 비어 있습니다. 작품 이름을 넣어 주세요.');
          say('');
          hits.replaceChildren(h('p', { className: 'tv-wait' }, '찾는 중'));
          let found;
          try { found = await searchWorks(text); } catch { found = null; }
          if (!alive || !hits.isConnected) return;
          hits.replaceChildren();
          if (!found) return say('작품을 찾지 못했습니다. 잠시 후 다시 찾아 주세요.');
          if (!found.length) return say('찾는 작품이 없습니다. 다른 이름으로 찾거나 직접 넣어 주세요.');
          hits.append(...found.map(f => h('button', { type: 'button', className: 'tv-hit', onclick: () => pick(f) },
            h('b', {}, f.label || f.id), f.about ? h('span', {}, f.about) : null)));
        };
        const pick = async f => {
          hits.replaceChildren(h('p', { className: 'tv-wait' }, '작품 정보를 받는 중'));
          let info;
          try { info = await workDetails(f.id); } catch { info = null; }
          if (!alive || !hits.isConnected) return;
          // 받지 못해도 고른 이름으로 넣는 칸을 연다
          details({ title: info?.title || f.label, year: info?.year || '', by: info?.by || '', link: info?.link || `https://www.wikidata.org/wiki/${f.id}` }, -1);
        };
        screen.replaceChildren(h('form', { className: 'like-form like-card tv-card', onsubmit: find },
          h('p', { className: 'like-card-head' }, '작품 넣기'),
          h('p', {}, '영화와 TV 시리즈를 이름으로 찾으면 연도와 감독이 같이 나옵니다.'),
          h('div', { className: 'tv-find' }, h('label', { className: 'like-field' }, h('span', {}, '작품 이름'), input), h('button', { className: 'btn', type: 'submit' }, '찾기')),
          status,
          hits,
          h('div', { className: 'link-row' },
            h('button', { className: 'btn like-edit', type: 'button', onclick: () => details({ title: input.value }, -1) }, '직접 넣기'),
            h('button', { className: 'btn', type: 'button', onclick: back }, '취소'))));
        setTimeout(() => input.focus(), 50);
        if (q) find();
      }

      // 넣기 2단계(고치기도 같다): 찾은 값을 채운 칸. i가 -1이면 새 작품
      function details(w, i) {
        row = null;
        tools.replaceChildren();
        const field = (value, max) => h('input', { type: 'text', value: value || '', maxLength: max || null });
        const title = field(w.title, LIMIT.workTitle);
        const year = field(w.year, LIMIT.workYear);
        const by = field(w.by, LIMIT.workBy);
        const link = field(w.link);
        const art = field(w.poster);
        const why = h('textarea', { rows: 2, maxLength: LIMIT.workWhy, value: w.why || '' });
        for (const el of [link, art]) { el.spellcheck = false; el.placeholder = 'https://'; }
        const error = h('p', { className: 'like-error', hidden: true });
        const fail = (msg, el) => { error.textContent = msg; error.hidden = false; el.focus(); };
        const submit = e => {
          e.preventDefault();
          if (!title.value.trim()) return fail('작품 이름이 비어 있습니다. 이름을 넣어 주세요.', title);
          const href = link.value.trim() && safeLink(link.value);
          if (link.value.trim() && !href) return fail('링크를 알아보지 못했습니다. https://로 시작하는 주소를 넣어 주세요.', link);
          const pic = art.value.trim() && safeImage(art.value);
          if (art.value.trim() && !pic) return fail('포스터 주소를 알아보지 못했습니다. https://로 시작하는 그림 주소를 넣어 주세요.', art);
          const list = [...works()];
          const prev = list[list.length - 1]?.color;
          let color = i >= 0 ? list[i].color : null;
          if (color == null) do { color = Math.floor(Math.random() * LIMIT.bookColors); } while (color === prev);
          const work = { title: title.value, year: year.value, by: by.value, link: href, poster: pic, why: why.value, color };
          if (i >= 0) list[i] = work;
          else list.push(work);
          setLike(os, 'tv', list);
          at = i >= 0 ? i : works().length - 1;
          show();
        };
        screen.replaceChildren(h('form', { className: 'like-form like-card tv-card', onsubmit: submit },
          h('p', { className: 'like-card-head' }, i >= 0 ? '작품 고치기' : '작품 넣기'),
          h('label', { className: 'like-field' }, h('span', {}, '이름'), title),
          h('label', { className: 'like-field' }, h('span', {}, '연도'), year),
          h('label', { className: 'like-field' }, h('span', {}, '감독'), by),
          h('label', { className: 'like-field' }, h('span', {}, '링크'), link),
          h('label', { className: 'like-field' }, h('span', {}, '포스터'), art),
          h('label', { className: 'like-field' }, h('span', {}, '추천 이유'), why),
          h('p', { className: 'tv-tip' }, '포스터에는 그림 주소를 넣습니다. 비워 두면 제목으로 만든 카드가 걸립니다.'),
          error,
          h('div', { className: 'link-row' },
            i < 0 ? h('button', { className: 'btn like-edit', type: 'button', onclick: () => search(title.value) }, '다시 찾기') : null,
            h('button', { className: 'btn', type: 'submit' }, i >= 0 ? '고치기' : '넣기'),
            h('button', { className: 'btn', type: 'button', onclick: back }, '취소'))));
        setTimeout(() => (i >= 0 || !w.title ? title : why).focus(), 50);
      }

      function remove() {
        const list = works().filter((_, i) => i !== at);
        setLike(os, 'tv', list.length ? list : null);
        at = Math.min(at, Math.max(0, list.length - 1));
        show();
      }

      cu.onKey = e => {
        if (!row) return; // 넣는 칸에서는 방향키를 쓰지 않는다
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1); }
      };

      if (works().length) show();
      else search(); // 작품이 없는 주인은 바로 찾는 칸
      return () => { alive = false; };
    },
  });
}
