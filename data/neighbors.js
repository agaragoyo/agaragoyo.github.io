// 이웃집 목록(docs/requirements.md의 F19). 로그인 화면의 이웃집과 놀이터 왼쪽 울타리의 문패가 이 목록으로 만들어진다.
// 처음 온 사람이 빈 방을 꾸미기 전에, 가구에 좋아하는 것이 담긴 방을 먼저 구경해 볼 수 있게 하려는 것이다.
//
// 한 줄에 한 집이다.
//   id    영소문자와 하이픈. 겹치면 안 된다
//   name  문패에 쓰는 닉네임(12글자까지). 레포가 공개라 실명은 쓰지 않는다
//   room  그 집 공유 링크에서 #r= 뒤의 글자 전부(2026-11-11 전에 만든 링크는 #room= 뒤)
//
// 넣는 법: 배포 사이트(https://agaragoyo.github.io/)에서 자기 방을 꾸미고 가구에 좋아하는 것을 담은 뒤,
// 공유하기의 "링크 복사"로 받은 주소에서 #r= 뒤를 room에 붙인다. 링크 속 주인 이름도 name과 같은 닉네임이어야 한다
// (base64를 풀면 누구나 읽을 수 있어서, 다르면 tools/check.py가 오류로 알린다). 방을 고친 뒤에는 링크를 다시 복사해 바꾼다.
// 링크 속 가구와 글, 주소는 열 때마다 src/share.js의 decodeHome(가구 배치 검사와 src/likes.js의 검사)을 거친다.
// 로그인 화면과 놀이터에는 앞의 여섯 집까지만 나온다(src/neighbors.js의 MAX_NEIGHBORS).
//
// 관리인: 팀원 방이 오기 전에 넣어 둔 시험용 방이다. 팀원 방이 오면 바꾸거나 그 앞에 더한다.
export const NEIGHBORS = [
  { id: 'caretaker', name: '관리인', room: 'eyJ2IjozLCJvIjoi6rSA66as7J24IiwicyI6eyJyb29tIjpbWyJsYW1wIiwwLDBdLFsiZGVzayIsMywwXSxbImJvb2tzaGVsZiIsNywwXSxbIndhcmRyb2JlIiwxMCwwXSxbImJlZCIsMCwzXSxbImJpZy1wbGFudCIsMCw4XSxbImFybWNoYWlyIiw4LDddLFsid2luZG93IiwzLDQsIlIiXSxbIndpZGUtYmVhZHMtd2luZG93Iiw3LDQsIlIiXSxbInBvc3RlciIsNCwzLCJMIl0sWyJjb21wdXRlciIsMywwXSxbImRlc2stbGFtcC0yIiw1LDBdLFsicmFkaW8iLDQsMV0sWyJib29rcyIsMywxXSxbInR2Iiw4LDNdLFsiY29uc29sZSIsMTAsM11dLCJwbGF5Z3JvdW5kIjpbWyJzYW5kYm94Iiw2LDZdLFsiYmVuY2giLDksMTBdXX0sImwiOnsiY29tcHV0ZXIiOnsidXJsIjoiaHR0cHM6Ly9zb29taW4wMDcuZ2l0aHViLmlvL2JlLXRoZS1iZWUvIiwibmFtZSI6IkJlIHRoZSBCZWUifSwiY29uc29sZSI6ImZpbGUtdGVuIiwiYm9va3NoZWxmIjpbeyJ0aXRsZSI6IuyWtOumsCDsmZXsnpAiLCJhdXRob3IiOiLsg53thY3spZDtjpjrpqwiLCJub3RlIjoi7Ja066a0IOuVjCDsnb3sl4jsnYQg65WM7JmAIOyngOq4iCDsnb3snYQg65WMIOuLpOultOqyjCDsnb3tnojripQg7LGFLiIsImNvbG9yIjowfSx7InRpdGxlIjoi66qo66qoIiwiYXV0aG9yIjoi66-47ZWY7JeYIOyXlOuNsCIsIm5vdGUiOiLsi5zqsITsnYQg7JWE6ru0IOyTsOudvOuKlCDrp5DsnbQg64uk66W06rKMIOuTpOumrOq4sCDsi5zsnpHtlZwg7LGFLiIsImNvbG9yIjozfSx7InRpdGxlIjoi64KY66-47JW8IOyeoe2ZlOygkOydmCDquLDsoIEiLCJhdXRob3IiOiLtnojqsIDsi5zrhbgg6rKM7J206rOgIiwibm90ZSI6IuqzoOuvvOydhCDsoIHsnYAg7Y647KeA6rCAIOyLnOqwhOydhCDqsbTrhIgg64u17J6l7Jy866GcIOuPjOyVhOyYpOuKlCDsnbTslbzquLAuIiwiY29sb3IiOjV9XSwicmFkaW8iOlt7InVybCI6Imh0dHBzOi8vb3Blbi5zcG90aWZ5LmNvbS9hbGJ1bS81VjhuNmZxeUFQeHZGVGliUGhRVmNwIn1dLCJ0diI6W3sidGl0bGUiOiLsnbTsm4Psp5Eg7Yag7Yag66GcIiwieWVhciI6IjE5ODgiLCJieSI6IuuvuOyVvOyekO2CpCDtlZjslbzsmKQiLCJsaW5rIjoiaHR0cHM6Ly9rby53aWtpcGVkaWEub3JnL3dpa2kvJUVDJTlEJUI0JUVDJTlCJTgzJUVDJUE3JTkxXyVFRCU4NiVBMCVFRCU4NiVBMCVFQiVBMSU5QyIsIndoeSI6IuydtOybg-ynkeyXkCDrhoDrn6wg6rCA6rOgIOyLtuyWtOyngOuKlCDsmIHtmZQuIiwiY29sb3IiOjJ9LHsidGl0bGUiOiLsnZHri7XtlZjrnbwgMTk4OCIsInllYXIiOiIyMDE1fjIwMTYiLCJieSI6IuyLoOybkO2YuCIsImxpbmsiOiJodHRwczovL2tvLndpa2lwZWRpYS5vcmcvd2lraS8lRUMlOUQlOTElRUIlOEIlQjUlRUQlOTUlOTglRUIlOUQlQkNfMTk4OCIsIndoeSI6IuqzqOuqqSDsnbTsm4Prgbzrpqwg67CY7LCs7J2EIOuCmOuIoCDrqLnripQg65Oc652866eILiIsImNvbG9yIjo2fV19fQ' },
];
