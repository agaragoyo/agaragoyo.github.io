// 펫(F30)을 방 글자에 담기. 고른 펫의 종류와 색, 쓰다듬은 횟수를 서버의 방과 링크에 실어서, 다른 브라우저에서 같은 방을 열어도 펫이 따라오게 한다(F36).
// 펫은 집과 따로 이 브라우저의 설정(src/settings.js의 pet과 petPats)에 있다. 방 글자를 만들 때 withPet으로 붙이므로
// (주인 사진의 withPicture, 게임 기록의 withRecords와 같다) 집 상태의 pet은 링크나 서버에서 연 집에만 있다. 친구 집에는 펫을 보이지 않는다.
// 고르지 않은 집(설정이 비어 있다)은 글자에 담지 않는다. 그래서 펫을 넣기 전과 글자가 같다.
// 이 파일은 다른 파일을 불러오지 않는다. src/share.js가 이 파일을 부르므로, 브라우저에서만 도는 파일을 부르면
// Node로 도는 링크 점검(tools/link-fuzz.mjs)이 멈춘다(known-issues 110).

// 방 글자에서 펫을 가리키는 번호(배열 순서). 맨 앞은 펫 창의 "없음"을 고른 것이고, 나머지는 '<종류>/<색>'(data/pets.js의 id)이다.
// 순서를 바꾸거나 중간에 끼우면 이미 올린 방의 펫이 다른 펫으로 열리므로 새 종류와 색은 끝에만 더한다(tools/check.py의 check_pet_codes가 본다).
// data/pets.js에서 뺀 펫도 자리를 지킨다.
export const PET_CODES = [
  'none',
  'dog/brown', 'dog/cream', 'dog/gray', 'dog/sky',
  'cat/gray', 'cat/cheese', 'cat/lavender', 'cat/white',
  'hamster/golden', 'hamster/white', 'hamster/gray', 'hamster/peach',
  'chick/yellow', 'chick/brown', 'chick/pink', 'chick/mint',
  'chicken/yellow', 'chicken/brown', 'chicken/pink', 'chicken/mint',
  'pigeon/gray', 'pigeon/white', 'pigeon/brown', 'pigeon/lavender',
  'elephant/gray', 'elephant/pink', 'elephant/mint', 'elephant/lavender',
  'koala/gray', 'koala/brown', 'koala/sky', 'koala/pink',
  'dino/green', 'dino/mint', 'dino/purple', 'dino/yellow',
];
export const MAX_PATS = 65535; // 쓰다듬은 횟수는 2바이트로 담는다. 넘으면 이 값으로 줄인다

const NONE = PET_CODES[0];

// 집 상태의 pet 검사. { id: '<종류>/<색>'이나 'none', pats: 쓰다듬은 횟수 }로 다듬고, 목록에 없으면 null이라 집 상태에 pet을 두지 않는다.
// "없음"은 쓰다듬은 횟수가 없다(펫 창이 0으로 돌린다)
export function sanitizePet(raw) {
  if (!raw || typeof raw !== 'object' || !PET_CODES.includes(raw.id)) return null;
  const n = Number.isInteger(raw.pats) && raw.pats > 0 ? Math.min(raw.pats, MAX_PATS) : 0;
  return { id: raw.id, pats: raw.id === NONE ? 0 : n };
}

// 방 글자를 만들 집에 이 컴퓨터의 펫을 붙인다. pet은 고른 펫({ id, pats })이고, 고르지 않았으면 id가 빈 글자라 붙이지 않는다.
// 친구 집을 복사해 만든 집에 펫이 남아 있어도 이 컴퓨터의 펫으로 바꾼다
export const withPet = (home, pet) => ({ ...home, pet: sanitizePet(pet) });
