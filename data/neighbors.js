// 이웃집 목록(docs/requirements.md의 F19). 로그인 화면의 이웃집과 놀이터 왼쪽 울타리의 문패가 이 목록으로 만들어진다.
// 처음 온 사람이 빈 방을 꾸미기 전에, 가구에 좋아하는 것이 담긴 방을 먼저 구경해 볼 수 있게 하려는 것이다.
//
// 한 줄에 한 집이다. link와 room 가운데 하나만 쓴다(둘 다 쓰면 tools/check.py가 오류로 알린다).
//   id    영소문자와 하이픈. 겹치면 안 된다
//   name  문패에 쓰는 닉네임(12글자까지). 레포가 공개라 실명은 쓰지 않는다
//   link  그 집 링크(https://agaragoyo.github.io/#s=여덟글자)에서 #s= 뒤의 여덟 글자. 방은 서버에 있어서 주인이 방을 고치면 이웃집도 따라 바뀐다
//   room  (예전 방식) 긴 링크에서 #r= 뒤의 글자 전부(2026-11-11 전에 만든 링크는 #room= 뒤). 링크를 보낸 때의 모습에 멈춰 있다
//
// 넣는 법: 주인이 배포 사이트(https://agaragoyo.github.io/)에서 자기 방을 꾸미고 가구에 좋아하는 것을 담은 뒤,
// 공유하기의 "링크 만들기"로 만든 링크를 보내 준다. 그 링크의 #s= 뒤 여덟 글자를 link에 넣는다.
// 링크는 주인이 자기 브라우저에서 만들어야 한다. 다른 사람이 주인의 방으로 만든 링크는 만든 사람의 것이라 주인이 방을 고쳐도 바뀌지 않는다.
// 링크를 만든 사용자의 닉네임도 name과 같아야 한다. 서버의 방은 누구나 읽을 수 있어서, 다르면 다른 이름(실명일 수 있다)이 서버에 남는다.
// 서버에 그 방이 없으면(주인이 링크를 지웠으면) 그 이웃집은 로그인 화면과 놀이터에서 빠진다.
// room 줄은 링크 속 주인 이름이 name과 같은지 tools/check.py가 본다(base64를 풀면 누구나 읽을 수 있다). 주인이 링크를 보내 주면 link로 바꾼다.
// 받은 방의 가구와 글, 주소는 열 때마다 src/share.js의 decodeHome(가구 배치 검사와 src/likes.js의 검사)을 거친다.
// 로그인 화면과 놀이터에는 앞의 여섯 집까지만 나온다(src/neighbors.js의 MAX_NEIGHBORS).
//
// 팀원 방은 받은 차례대로 관리인 앞에 더한다.
// 관리인: 팀원 방이 오기 전에 넣어 둔 시험용 방이다. 가구 다섯 개에 내용을 담아 두었다. 그대로 둘지는 팀이 정한다(docs/requirements.md).
export const NEIGHBORS = [
  { id: 'kirby-cute', name: '커비큐트', room: 'BAzsu6TruYTtgZDtirgAAhcAAAKYCoCFAwiLBDAGoAdQm3MZQ5kUGgMLABQhFhCMBQ1XDjQPERGBEAEIcAgIDSAAHwmguSIEJIAlsCEGI4MkiyS2JUAlWyMR' },
  { id: 'caretaker', name: '관리인', room: 'eyJ2IjozLCJvIjoi6rSA66as7J24IiwicyI6eyJyb29tIjpbWyJsYW1wIiwwLDBdLFsiZGVzayIsMywwXSxbImJvb2tzaGVsZiIsNywwXSxbIndhcmRyb2JlIiwxMCwwXSxbImJlZCIsMCwzXSxbImJpZy1wbGFudCIsMCw4XSxbImFybWNoYWlyIiw4LDddLFsid2luZG93IiwzLDQsIlIiXSxbIndpZGUtYmVhZHMtd2luZG93Iiw3LDQsIlIiXSxbInBvc3RlciIsNCwzLCJMIl0sWyJjb21wdXRlciIsMywwXSxbImRlc2stbGFtcC0yIiw1LDBdLFsicmFkaW8iLDQsMV0sWyJib29rcyIsMywxXSxbInR2Iiw4LDNdLFsiY29uc29sZSIsMTAsM11dLCJwbGF5Z3JvdW5kIjpbWyJzYW5kYm94Iiw2LDZdLFsiYmVuY2giLDksMTBdXX0sImwiOnsiY29tcHV0ZXIiOnsidXJsIjoiaHR0cHM6Ly9zb29taW4wMDcuZ2l0aHViLmlvL2JlLXRoZS1iZWUvIiwibmFtZSI6IkJlIHRoZSBCZWUifSwiY29uc29sZSI6ImZpbGUtdGVuIiwiYm9va3NoZWxmIjpbeyJ0aXRsZSI6IuyWtOumsCDsmZXsnpAiLCJhdXRob3IiOiLsg53thY3spZDtjpjrpqwiLCJub3RlIjoi7Ja066a0IOuVjCDsnb3sl4jsnYQg65WM7JmAIOyngOq4iCDsnb3snYQg65WMIOuLpOultOqyjCDsnb3tnojripQg7LGFLiIsImNvbG9yIjowfSx7InRpdGxlIjoi66qo66qoIiwiYXV0aG9yIjoi66-47ZWY7JeYIOyXlOuNsCIsIm5vdGUiOiLsi5zqsITsnYQg7JWE6ru0IOyTsOudvOuKlCDrp5DsnbQg64uk66W06rKMIOuTpOumrOq4sCDsi5zsnpHtlZwg7LGFLiIsImNvbG9yIjozfSx7InRpdGxlIjoi64KY66-47JW8IOyeoe2ZlOygkOydmCDquLDsoIEiLCJhdXRob3IiOiLtnojqsIDsi5zrhbgg6rKM7J206rOgIiwibm90ZSI6IuqzoOuvvOydhCDsoIHsnYAg7Y647KeA6rCAIOyLnOqwhOydhCDqsbTrhIgg64u17J6l7Jy866GcIOuPjOyVhOyYpOuKlCDsnbTslbzquLAuIiwiY29sb3IiOjV9XSwicmFkaW8iOlt7InVybCI6Imh0dHBzOi8vb3Blbi5zcG90aWZ5LmNvbS9hbGJ1bS81VjhuNmZxeUFQeHZGVGliUGhRVmNwIn1dLCJ0diI6W3sidGl0bGUiOiLsnbTsm4Psp5Eg7Yag7Yag66GcIiwieWVhciI6IjE5ODgiLCJieSI6IuuvuOyVvOyekO2CpCDtlZjslbzsmKQiLCJsaW5rIjoiaHR0cHM6Ly9rby53aWtpcGVkaWEub3JnL3dpa2kvJUVDJTlEJUI0JUVDJTlCJTgzJUVDJUE3JTkxXyVFRCU4NiVBMCVFRCU4NiVBMCVFQiVBMSU5QyIsIndoeSI6IuydtOybg-ynkeyXkCDrhoDrn6wg6rCA6rOgIOyLtuyWtOyngOuKlCDsmIHtmZQuIiwiY29sb3IiOjJ9LHsidGl0bGUiOiLsnZHri7XtlZjrnbwgMTk4OCIsInllYXIiOiIyMDE1fjIwMTYiLCJieSI6IuyLoOybkO2YuCIsImxpbmsiOiJodHRwczovL2tvLndpa2lwZWRpYS5vcmcvd2lraS8lRUMlOUQlOTElRUIlOEIlQjUlRUQlOTUlOTglRUIlOUQlQkNfMTk4OCIsIndoeSI6IuqzqOuqqSDsnbTsm4Prgbzrpqwg67CY7LCs7J2EIOuCmOuIoCDrqLnripQg65Oc652866eILiIsImNvbG9yIjo2fV19fQ' },
];
