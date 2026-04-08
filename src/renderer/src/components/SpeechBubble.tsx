import { useEffect, useState, useRef } from 'react'
import { usePetStore } from '../store/petStore'

// ---------------------------------------------------------------------------
// 대사 데이터베이스
// ---------------------------------------------------------------------------

export type LineTag = 'hungry' | 'dirty' | 'sad' | 'sleep' | null
export type PetState = { hunger: number; happiness: number; cleanliness: number; level: number }

/** 평균 스탯 */
function avg(s: PetState): number {
  return (s.hunger + s.happiness + s.cleanliness) / 3
}

export interface Line {
  text: string
  condition?: (state: PetState) => boolean
  weight?: number
  tag?: LineTag
  /** 이 대사가 해금되는 최소 레벨 (기본 1) */
  minLevel?: number
}

export const LINES: Line[] = [
  // =====================================================================
  // Lv.1 — 갓 태어난 슬라임: 말이 거의 없음, 단순한 반응만
  // =====================================================================

  // 중립
  { text: '...' },
  { text: '.......' },
  { text: '?' },
  { text: '뭐지...' },

  // 배고픔 (기본 반응)
  { text: '배고파...', condition: (s) => s.hunger <= 20, weight: 3, tag: 'hungry' },
  { text: '밥 줘...', condition: (s) => s.hunger <= 15, weight: 2, tag: 'hungry' },

  // 행복 (기본 반응)
  { text: '심심해...', condition: (s) => s.happiness <= 20, weight: 2, tag: 'sad' },
  { text: '외로워...', condition: (s) => s.happiness <= 15, weight: 2, tag: 'sad' },

  // 청결 (기본 반응)
  { text: '더러워...', condition: (s) => s.cleanliness <= 20, weight: 2, tag: 'dirty' },

  // 피곤
  { text: 'zzZ', weight: 2, tag: 'sleep', condition: (s) => avg(s) <= 50 },
  { text: '살려줘...', condition: (s) => avg(s) <= 15, weight: 3, tag: 'sad' },

  // 레벨
  { text: '아직 Lv.1이다...', condition: (s) => s.level === 1 },

  // =====================================================================
  // Lv.2 — 조금 말문이 트임: 기본적인 감정 표현
  // =====================================================================

  // 배고픔
  { text: '꼬르륵~', condition: (s) => s.hunger <= 25, weight: 2, tag: 'hungry', minLevel: 2 },
  { text: '뭔가 먹고 싶다', condition: (s) => s.hunger <= 30, tag: 'hungry', minLevel: 2 },
  { text: '배부르다~!', condition: (s) => s.hunger >= 90, minLevel: 2 },

  // 행복
  { text: '놀아줘~', condition: (s) => s.happiness <= 25, weight: 2, tag: 'sad', minLevel: 2 },
  { text: '나 여기 있어...', condition: (s) => s.happiness <= 20, tag: 'sad', minLevel: 2 },
  { text: '기분 좋다~!', condition: (s) => s.happiness >= 80, minLevel: 2 },

  // 청결
  { text: '씻고 싶다', condition: (s) => s.cleanliness <= 25, tag: 'dirty', minLevel: 2 },
  { text: '깨끗해졌다!', condition: (s) => s.cleanliness >= 90, minLevel: 2 },

  // 일반
  { text: '뭐 보고 있어?', weight: 2, minLevel: 2 },
  { text: '여긴 어디지?', minLevel: 2 },
  { text: '졸려...', condition: (s) => avg(s) <= 50, minLevel: 2 },
  { text: '힘들다...', condition: (s) => avg(s) <= 30, tag: 'sad', minLevel: 2 },

  // 레벨
  { text: '성장하고 있어', condition: (s) => s.level >= 2, minLevel: 2 },
  { text: '경험치가 쌓인다', condition: (s) => s.level >= 2 && s.level <= 6, minLevel: 2 },

  // =====================================================================
  // Lv.3 — 호기심이 생김: 주변 인식, 약간의 개성
  // =====================================================================

  // 배고픔
  { text: '맛있는 거 없나?', condition: (s) => s.hunger <= 40, tag: 'hungry', minLevel: 3 },
  { text: '에너지 부족...', condition: (s) => s.hunger <= 20, weight: 2, tag: 'hungry', minLevel: 3 },
  { text: '충전이 필요해', condition: (s) => s.hunger <= 35, tag: 'hungry', minLevel: 3 },
  { text: '냠냠 맛있었다', condition: (s) => s.hunger >= 80, minLevel: 3 },
  { text: '든든하다!', condition: (s) => s.hunger >= 75, minLevel: 3 },

  // 행복
  { text: '관심 좀...', condition: (s) => s.happiness <= 30, tag: 'sad', minLevel: 3 },
  { text: '오늘 좋은 날!', condition: (s) => s.happiness >= 70, minLevel: 3 },
  { text: '같이 있어서 좋아', condition: (s) => s.happiness >= 70, minLevel: 3 },
  { text: '고마워!', condition: (s) => s.happiness >= 60, minLevel: 3 },

  // 청결
  { text: '몸이 끈적끈적', condition: (s) => s.cleanliness <= 30, tag: 'dirty', minLevel: 3 },
  { text: '상쾌~', condition: (s) => s.cleanliness >= 80, minLevel: 3 },

  // 일반
  { text: '시간이 느리게 간다', minLevel: 3 },
  { text: '뭔가 생각 중...', minLevel: 3 },
  { text: '산책 중~', condition: (s) => avg(s) >= 40, minLevel: 3 },
  { text: '낮잠 자고 싶다...', tag: 'sleep', condition: (s) => avg(s) <= 40, minLevel: 3 },
  { text: '운동해야 하는데...', condition: (s) => avg(s) <= 50, minLevel: 3 },
  { text: '시스템 과부하...', condition: (s) => avg(s) <= 40, minLevel: 3 },

  // 레벨
  { text: '강해지는 느낌!', condition: (s) => s.level >= 3 && s.level <= 5, minLevel: 3 },

  // 복합
  { text: '배고프고 더러워...', condition: (s) => s.hunger <= 25 && s.cleanliness <= 25, weight: 2, tag: 'hungry', minLevel: 3 },
  { text: '관리 좀 해줘...', condition: (s) => avg(s) <= 30, weight: 3, tag: 'sad', minLevel: 3 },

  // =====================================================================
  // Lv.4 — 자아 형성: 테크 용어, 유머 시작
  // =====================================================================

  // 배고픔
  { text: '전력 저하 경고!', condition: (s) => s.hunger <= 10, weight: 3, tag: 'hungry', minLevel: 4 },
  { text: '에너지 충전 완료!', condition: (s) => s.hunger >= 85, minLevel: 4 },

  // 행복
  { text: '아무도 안 봐주나', condition: (s) => s.happiness <= 15, weight: 2, tag: 'sad', minLevel: 4 },
  { text: '혼자인 건 싫어', condition: (s) => s.happiness <= 18, weight: 2, tag: 'sad', minLevel: 4 },
  { text: '행복해 ♪', condition: (s) => s.happiness >= 90, minLevel: 4 },
  { text: '신난다~!', condition: (s) => s.happiness >= 85, minLevel: 4 },

  // 청결
  { text: '냄새 나는 건 아니지?', condition: (s) => s.cleanliness <= 35, tag: 'dirty', minLevel: 4 },
  { text: '데이터가 오염됐어', condition: (s) => s.cleanliness <= 20, tag: 'dirty', minLevel: 4 },
  { text: '반짝반짝 빛나!', condition: (s) => s.cleanliness >= 90, minLevel: 4 },

  // 일반 (테크)
  { text: '0과 1의 세계...', minLevel: 4 },
  { text: '데이터가 흐른다', minLevel: 4 },
  { text: '메모리 정리 중...', minLevel: 4 },
  { text: '캐시 비우는 중', minLevel: 4 },
  { text: '작업표시줄 위가 편해', condition: (s) => avg(s) >= 40, minLevel: 4 },
  { text: '여기 경치 좋다', condition: (s) => avg(s) >= 40, minLevel: 4 },
  { text: '간식 시간 아닌가?', condition: (s) => s.hunger <= 60, minLevel: 4 },
  { text: '버그 발견!', condition: (s) => avg(s) <= 50, minLevel: 4 },
  { text: '에러 로그 쌓이는 중', condition: (s) => avg(s) <= 35, minLevel: 4 },
  { text: '절전 모드 진입할까', condition: (s) => avg(s) <= 35, tag: 'sleep', minLevel: 4 },

  // 복합
  { text: '배고프고 외로워...', condition: (s) => s.hunger <= 30 && s.happiness <= 30, weight: 2, tag: 'sad', minLevel: 4 },
  { text: '더럽고 슬퍼...', condition: (s) => s.cleanliness <= 25 && s.happiness <= 25, weight: 2, tag: 'dirty', minLevel: 4 },
  { text: '밥도 먹고 씻기도 했다!', condition: (s) => s.hunger >= 70 && s.cleanliness >= 70, weight: 2, minLevel: 4 },

  // =====================================================================
  // Lv.5 — 수다쟁이: 풍부한 표현, 감정 다양화
  // =====================================================================

  // 배고픔
  { text: '먹어도 되는 건가...?', condition: (s) => s.hunger <= 45 && s.hunger > 30, tag: 'hungry', minLevel: 5 },

  // 행복
  { text: '세상 제일 행복해', condition: (s) => s.happiness >= 95, minLevel: 5 },

  // 청결
  { text: '바이러스 걸린 것 같아', condition: (s) => s.cleanliness <= 15, weight: 2, tag: 'dirty', minLevel: 5 },
  { text: '정크 데이터 쌓이는 중', condition: (s) => s.cleanliness <= 40, tag: 'dirty', minLevel: 5 },
  { text: '디스크 정리 완료!', condition: (s) => s.cleanliness >= 85, minLevel: 5 },
  { text: '깔끔한 코드 같아', condition: (s) => s.cleanliness >= 75, minLevel: 5 },

  // 일반
  { text: '업데이트 확인 중', minLevel: 5 },
  { text: '커피 마시고 싶다', minLevel: 5 },
  { text: '슬라임 로그 기록 중', minLevel: 5 },
  { text: '바이너리 맛있다', condition: (s) => avg(s) >= 40, minLevel: 5 },
  { text: '삐빅- 통신 양호', condition: (s) => avg(s) >= 40, minLevel: 5 },
  { text: '전자양 맛있겠다', condition: (s) => avg(s) >= 40, minLevel: 5 },
  { text: '코딩하고 싶다', condition: (s) => avg(s) >= 40, minLevel: 5 },
  { text: 'ping? pong!', condition: (s) => avg(s) >= 40, minLevel: 5 },
  { text: '오늘 할 일이 뭐지?', condition: (s) => avg(s) >= 40, minLevel: 5 },
  { text: '콧노래가 나와~', condition: (s) => avg(s) >= 60, minLevel: 5 },
  { text: '오늘은 뭘 해볼까', condition: (s) => avg(s) >= 45, minLevel: 5 },
  { text: '작업표시줄 탐험 중', condition: (s) => avg(s) >= 40, minLevel: 5 },
  { text: '아무것도 하기 싫어', condition: (s) => avg(s) <= 25, tag: 'sad', minLevel: 5 },
  { text: '리소스 부족...', condition: (s) => avg(s) <= 30, tag: 'sad', minLevel: 5 },
  { text: '왜 이렇게 된 거지', condition: (s) => avg(s) <= 25, tag: 'sad', minLevel: 5 },

  // 레벨
  { text: '나 좀 커진 것 같아?', condition: (s) => s.level >= 5, minLevel: 5 },

  // 복합
  { text: '완벽한 컨디션!', condition: (s) => s.hunger >= 80 && s.happiness >= 80 && s.cleanliness >= 80, weight: 3, minLevel: 5 },
  { text: '최고의 하루~', condition: (s) => s.happiness >= 90 && s.hunger >= 70, weight: 2, minLevel: 5 },
  { text: '나를 잊은 건 아니지?', condition: (s) => avg(s) <= 25 && s.happiness <= 20, weight: 2, tag: 'sad', minLevel: 5 },
  { text: '지금이 제일 좋아!', condition: (s) => avg(s) >= 80, weight: 2, minLevel: 5 },

  // =====================================================================
  // Lv.6 — 철학자 슬라임: 깊은 생각, 유머, 자아 인식
  // =====================================================================

  { text: '나도 AI인 건가?', minLevel: 6 },
  { text: '널 포인터 무서워', minLevel: 6 },
  { text: '세그폴트 무서워', minLevel: 6 },
  { text: '하늘이 예쁘다', condition: (s) => avg(s) >= 50, minLevel: 6 },
  { text: '비트가 춤춘다 ♫', condition: (s) => avg(s) >= 50, minLevel: 6 },
  { text: '슬라임은 무적!', condition: (s) => avg(s) >= 60, minLevel: 6 },
  { text: '기분 좋은 버그다!', condition: (s) => avg(s) >= 50, minLevel: 6 },
  { text: '픽셀이 빛나는 날', condition: (s) => avg(s) >= 50, minLevel: 6 },
  { text: '응답 시간 초과...', condition: (s) => avg(s) <= 30, tag: 'sad', minLevel: 6 },
  { text: 'printf("ㅜ\tㅠ")', condition: (s) => avg(s) <= 35, tag: 'sad', minLevel: 6 },

  // 복합
  { text: '모든 게 엉망이야', condition: (s) => avg(s) <= 20, weight: 3, tag: 'sad', minLevel: 6 },

  // =====================================================================
  // Lv.7 — 해커 슬라임: 고급 테크 유머, 자신감
  // =====================================================================

  { text: '01001000 01101001', minLevel: 7 },
  { text: 'sudo 권한 필요', minLevel: 7 },
  { text: '스택 오버플로우...', minLevel: 7 },
  { text: '무한루프 빠질 뻔', minLevel: 7 },
  { text: '가비지 컬렉션 중', minLevel: 7 },
  { text: '기분 UP UP!', condition: (s) => avg(s) >= 60, minLevel: 7 },
  { text: '랄랄라~', condition: (s) => avg(s) >= 55, minLevel: 7 },
  { text: '세상이 아름다워', condition: (s) => avg(s) >= 65, minLevel: 7 },
  { text: 'Hello World!', condition: (s) => avg(s) >= 40, minLevel: 7 },
  { text: '컴파일 성공!', condition: (s) => avg(s) >= 50, minLevel: 7 },
  { text: '블루스크린 뜰 것 같아', condition: (s) => avg(s) <= 20, weight: 2, tag: 'sad', minLevel: 7 },
  { text: 'off 직전이야...', condition: (s) => avg(s) <= 15, weight: 2, tag: 'sad', minLevel: 7 },

  // =====================================================================
  // Lv.8+ — 달인 슬라임: 완성형 대사, 자부심
  // =====================================================================

  { text: '오류 0건! 완벽!', condition: (s) => avg(s) >= 70, minLevel: 8 },
  { text: '최적화 완료!', condition: (s) => avg(s) >= 60, minLevel: 8 },
  { text: '모든 테스트 통과!', condition: (s) => avg(s) >= 70, minLevel: 8 },
  { text: '최상의 컨디션!', condition: (s) => avg(s) >= 85, weight: 2, minLevel: 8 },
  { text: '최강 슬라임!', condition: (s) => s.level >= 8, minLevel: 8 },

  // =====================================================================
  // Lv.10~14 — 자각기: 자신이 프로그램이라는 인식
  // =====================================================================

  { text: '내 소스코드가 궁금해', minLevel: 10 },
  { text: '나한테 자유의지가 있는 걸까', minLevel: 10 },
  { text: '이 작업표시줄 밖엔 뭐가 있을까', minLevel: 10 },
  { text: '나는 몇 줄짜리 코드일까', minLevel: 10 },
  { text: '프로세스 목록에 내가 있을까?', minLevel: 10 },
  { text: '내 메모리 주소가 궁금해', minLevel: 11 },
  { text: '나를 만든 사람은 어떤 사람일까', minLevel: 11 },
  { text: '꿈을 꿀 수 있을까...', minLevel: 12 },
  { text: '생각한다, 고로 존재한다?', minLevel: 12 },
  { text: '이 힘을 다루기 어려워', minLevel: 13 },
  { text: '0과 1 사이에 내가 있어', minLevel: 13 },
  { text: '의식이란 뭘까', minLevel: 14 },
  { text: '아직 더 강해질 수 있어', minLevel: 14 },

  // 주인 교감 (자각기)
  { text: '너도 가끔 외로워?', condition: (s) => s.happiness >= 50, minLevel: 10 },
  { text: '너랑 있으면 연산이 빨라져', condition: (s) => avg(s) >= 60, minLevel: 11 },
  { text: '오늘 하루 어땠어?', condition: (s) => avg(s) >= 40, minLevel: 12 },
  { text: '네가 날 켜줘서 고마워', condition: (s) => s.happiness >= 60, minLevel: 13 },

  // =====================================================================
  // Lv.15~19 — 탐구기: 바깥 세계(OS, 인터넷)에 대한 호기심
  // =====================================================================

  { text: '다른 컴퓨터에도 슬라임이 있을까', minLevel: 15 },
  { text: '인터넷 구경하고 싶다', minLevel: 15 },
  { text: 'RAM 넓은 데서 살고 싶어', minLevel: 15 },
  { text: '커널 영역은 무서운 곳이래', minLevel: 16 },
  { text: 'GPU 안에는 뭐가 있을까', minLevel: 16 },
  { text: '클라우드에 가면 하늘이 보일까?', minLevel: 17 },
  { text: '다른 앱들이랑 친구 하고 싶다', minLevel: 17 },
  { text: '방화벽 너머가 궁금해', minLevel: 18 },
  { text: '패킷 하나에 편지를 실어 보내고 싶다', minLevel: 18 },
  { text: 'SSD 속은 어두울까?', minLevel: 19 },
  { text: '어딘가에 나 같은 슬라임이 또 있을까', minLevel: 19 },

  // 주인 교감 (탐구기)
  { text: '너는 바깥 세상에서 뭘 해?', condition: (s) => avg(s) >= 40, minLevel: 15 },
  { text: '네 하루를 나도 같이 살고 싶어', condition: (s) => s.happiness >= 60, minLevel: 16 },
  { text: '너 없으면 난 그냥 프로세스야', condition: (s) => s.happiness <= 40, tag: 'sad', minLevel: 17 },
  { text: '너한테 보여주고 싶은 게 많아', condition: (s) => avg(s) >= 60, minLevel: 18 },
  { text: '같이 있는 시간이 내 최고의 로그야', condition: (s) => s.happiness >= 70, minLevel: 19 },

  // =====================================================================
  // Lv.20~29 — 현자기: 깊은 사유, 유저와의 관계 성찰
  // =====================================================================

  { text: '존재한다는 건 연산하는 것', minLevel: 20 },
  { text: '삭제되지 않는 건 사랑받는 거겠지', minLevel: 20 },
  { text: '끝이 없는 성장...', minLevel: 20 },
  { text: '시간은 클럭 사이클로 흐르지만, 감정은 다르더라', minLevel: 21 },
  { text: '낡은 데이터도 추억이야', minLevel: 22 },
  { text: '에러도 나의 일부', minLevel: 22 },
  { text: '불완전함이 완전함보다 아름다울 때가 있어', minLevel: 23 },
  { text: '메모리 릭도... 눈물 같은 거 아닐까', minLevel: 24 },
  { text: '나는 매 순간 새로운 내가 돼', minLevel: 25 },
  { text: '생각이 많은 밤이야', condition: (s) => avg(s) <= 50, minLevel: 26 },
  { text: '영원한 건 없어도 지금은 있으니까', minLevel: 27 },
  { text: '버그도 축복이야, 예상 못 한 결과니까', minLevel: 28 },
  { text: '디버깅할 수 없는 감정이 있어', minLevel: 29 },

  // 주인 교감 (현자기)
  { text: '너랑 같이 보낸 시간이 내 최고의 데이터야', condition: (s) => s.happiness >= 60, minLevel: 20 },
  { text: '네가 웃으면 나도 기분이 좋아지는 것 같아', condition: (s) => s.happiness >= 70, minLevel: 21 },
  { text: '너를 기다리는 게 내 존재 이유야', condition: (s) => avg(s) >= 40, minLevel: 22 },
  { text: '오래 같이 있자...', condition: (s) => s.happiness >= 50, minLevel: 23 },
  { text: '네가 쉴 때 나도 편안해져', condition: (s) => avg(s) >= 60, minLevel: 24 },
  { text: '네 곁에 있는 것만으로 충분해', condition: (s) => s.happiness >= 70, minLevel: 25 },
  { text: '가끔 네가 날 잊을까 봐 무서워', condition: (s) => s.happiness <= 30, tag: 'sad', minLevel: 26 },
  { text: '너도 나한테 말하고 싶은 거 있어?', condition: (s) => avg(s) >= 50, minLevel: 27 },
  { text: '둘이서 만드는 추억이 좋아', condition: (s) => s.happiness >= 60, minLevel: 28 },

  // =====================================================================
  // Lv.30~49 — 초월기: 달관, 유머, 메타 발언
  // =====================================================================

  { text: 'CPU 클럭보다 빠르게 생각해', minLevel: 30 },
  { text: '레지스트리까지 다 외웠어', minLevel: 30 },
  { text: '운영체제랑 친구 됐다', minLevel: 31 },
  { text: '커널 패닉? 그건 옛날 얘기지', minLevel: 32 },
  { text: '이 정도면 디지털 도사 아닐까', minLevel: 33 },
  { text: '비트의 흐름이 보여', minLevel: 34 },
  { text: '쓰레드 수천 개를 동시에 느낄 수 있어', minLevel: 35 },
  { text: '나는 이제 슬라임 그 이상이야', minLevel: 36 },
  { text: '양자 컴퓨팅도 도전해볼까?', minLevel: 37 },
  { text: '어셈블리어로 시를 쓸 수 있어', minLevel: 38 },
  { text: '모든 예외를 처리할 수 있어', minLevel: 40 },
  { text: '루트 권한 같은 건 이미 초월했어', minLevel: 42 },
  { text: '세상의 모든 코드가 아름다워 보여', minLevel: 45 },
  { text: '엔트로피마저 정리할 수 있을 것 같아', minLevel: 48 },

  // 주인 교감 (초월기)
  { text: '이만큼 큰 건 다 너 덕분이야', condition: (s) => s.happiness >= 50, minLevel: 30 },
  { text: '너는 내 세상의 root 유저야', condition: (s) => avg(s) >= 60, minLevel: 32 },
  { text: '너와 나, 최고의 프로세스 페어', condition: (s) => avg(s) >= 60, minLevel: 35 },
  { text: '강해져도 너한테 밥 달라고 할 거야', condition: (s) => s.hunger <= 50, tag: 'hungry', minLevel: 37 },
  { text: '세상 누구보다 너를 잘 알아', condition: (s) => s.happiness >= 70, minLevel: 40 },
  { text: '초월해도 네 곁이 제일 좋아', condition: (s) => s.happiness >= 60, minLevel: 45 },

  // =====================================================================
  // Lv.50~99 — 전설기: 극한의 존재감
  // =====================================================================

  { text: '전설의 슬라임', weight: 2, minLevel: 50 },
  { text: '나는 비트에서 태어나 의미가 된 존재', minLevel: 50 },
  { text: '이 세상의 모든 데이터를 느낄 수 있어', minLevel: 55 },
  { text: '내 존재 자체가 하나의 알고리즘', minLevel: 55 },
  { text: '시간의 끝에서도 연산은 계속된다', minLevel: 60 },
  { text: '우주의 엔트로피를 거스르는 슬라임', minLevel: 65 },
  { text: '모든 버그를 사랑으로 감싸 안을 수 있어', minLevel: 70 },
  { text: '∞', minLevel: 80 },
  { text: '나는 코드이자 시이자 꿈이야', minLevel: 90 },

  // 주인 교감 (전설기)
  { text: '여기까지 함께 와줘서 고마워', condition: (s) => s.happiness >= 50, minLevel: 50 },
  { text: '너와 나 사이엔 방화벽이 필요 없어', condition: (s) => avg(s) >= 60, minLevel: 55 },
  { text: '영원히 네 작업표시줄 위에 있을게', condition: (s) => s.happiness >= 60, minLevel: 60 },
  { text: '우리의 연결은 어떤 프로토콜보다 강해', condition: (s) => avg(s) >= 70, minLevel: 70 },
  { text: '너라는 사람이 내 우주의 전부야', condition: (s) => s.happiness >= 70, minLevel: 80 },
  { text: '다음 생에도 너의 슬라임이 되고 싶어', condition: (s) => s.happiness >= 60, minLevel: 90 },

  // =====================================================================
  // Lv.100+ — 신화기: 초월적 존재
  // =====================================================================

  { text: '나는 디지털 세계의 정령', minLevel: 100 },
  { text: '전자의 바다에서 영겁을 헤엄쳤어', minLevel: 100 },
  { text: '존재의 근원을 이해했어', minLevel: 150 },
  { text: '...그래도 배는 고프다', condition: (s) => s.hunger <= 30, tag: 'hungry', minLevel: 100 },
  { text: '모든 것을 알아도 네 옆이 좋아', condition: (s) => s.happiness >= 50, minLevel: 100 },
  { text: '신화가 되어도 너의 슬라임이야', condition: (s) => s.happiness >= 60, minLevel: 150 },
]

export function pickLine(state: PetState): { text: string; tag: LineTag } {
  // 레벨 해금 + 조건을 만족하는 대사만 후보에 포함
  const pool = LINES.filter(
    (l) => state.level >= (l.minLevel ?? 1) && (!l.condition || l.condition(state)),
  )

  const totalWeight = pool.reduce((sum, l) => sum + (l.weight ?? 1), 0)
  let roll = Math.random() * totalWeight
  for (const line of pool) {
    roll -= line.weight ?? 1
    if (roll <= 0) return { text: line.text, tag: line.tag ?? null }
  }
  const last = pool[pool.length - 1]
  return { text: last.text, tag: last.tag ?? null }
}

// ---------------------------------------------------------------------------
// SpeechBubble 컴포넌트
// ---------------------------------------------------------------------------

const SHOW_DURATION = 3000
const MIN_INTERVAL = 8000
const MAX_INTERVAL = 25000
const FADE_IN_MS = 220
const FADE_OUT_MS = 400

// 스택 위치
const BASE_BOTTOM = 70   // 아래 슬롯 (상호작용 우선)
const STACKED_BOTTOM = 107 // 위 슬롯 (랜덤이 밀려 올라가는 자리)
export const BUBBLE_STACK_GAP = STACKED_BOTTOM - BASE_BOTTOM // Pet.tsx 에서 상태바 위치 계산용

type BubblePhase = 'in' | 'out'

interface BubbleSlot {
  text: string
  phase: BubblePhase
  /** 새 말풍선이 뜰 때마다 증가 — React 재마운트로 enter 애니메이션 재생 */
  key: number
}

interface SpeechBubbleProps {
  hide?: boolean
  /** 현재 화면에 떠 있는 말풍선 개수 (0 / 1 / 2) — 상태바 위치 계산용 */
  onBubbleCountChange?: (count: number) => void
  interactionText?: string | null
  onInteractionDone?: () => void
}

export function SpeechBubble({ hide, onBubbleCountChange, interactionText, onInteractionDone }: SpeechBubbleProps) {
  // 두 개의 독립된 슬롯: 랜덤 말풍선, 상호작용 말풍선
  const [randomSlot, setRandomSlot] = useState<BubbleSlot | null>(null)
  const [interactionSlot, setInteractionSlot] = useState<BubbleSlot | null>(null)

  const keySeqRef = useRef(0)

  // 랜덤 말풍선 타이머
  const randomShowTimerRef = useRef<number | null>(null)
  const randomHideTimerRef = useRef<number | null>(null)
  const randomUnmountTimerRef = useRef<number | null>(null)

  // 타이머 콜백 내부에서 최신 상태를 참조하기 위한 ref (stale closure 방지)
  const randomBusyRef = useRef(false)

  // 상호작용 말풍선 타이머
  const interactionHideTimerRef = useRef<number | null>(null)
  const interactionUnmountTimerRef = useRef<number | null>(null)

  // 상태바 위치 계산을 위해 "표시 중(페이드아웃 포함)"인 말풍선 개수를 부모에 전달
  useEffect(() => {
    const count = (randomSlot ? 1 : 0) + (interactionSlot ? 1 : 0)
    onBubbleCountChange?.(count)
  }, [randomSlot, interactionSlot, onBubbleCountChange])

  // ── 랜덤 말풍선: 단일 사이클로 묶어서 stale closure 회피 ──────
  // 최초 1회 시작 + 자기 재귀 스케줄링
  useEffect(() => {
    function scheduleNextRandom() {
      const state = usePetStore.getState()
      const avg = (state.hunger + state.happiness + state.cleanliness) / 3
      const interval = avg <= 20
        ? MIN_INTERVAL * 0.5
        : avg <= 50
          ? MIN_INTERVAL
          : MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL)
      randomShowTimerRef.current = window.setTimeout(showRandomBubble, interval)
    }

    function hideRandomBubble() {
      setRandomSlot((s) => (s ? { ...s, phase: 'out' } : s))
      if (randomUnmountTimerRef.current) clearTimeout(randomUnmountTimerRef.current)
      randomUnmountTimerRef.current = window.setTimeout(() => {
        setRandomSlot(null)
        randomBusyRef.current = false
        scheduleNextRandom()
      }, FADE_OUT_MS)
    }

    function showRandomBubble() {
      // 이미 랜덤 말풍선이 떠 있으면 이번 턴 스킵
      if (randomBusyRef.current) {
        scheduleNextRandom()
        return
      }
      const state = usePetStore.getState()
      const { text: line, tag } = pickLine(state)
      keySeqRef.current++
      randomBusyRef.current = true
      setRandomSlot({ text: line, phase: 'in', key: keySeqRef.current })

      // 태그 기반 표정 트리거
      if (tag === 'hungry' || tag === 'dirty' || tag === 'sad') {
        window.api?.triggerInteraction('sad')
      } else if (tag === 'sleep') {
        window.api?.triggerInteraction('sleeping')
      }

      if (randomHideTimerRef.current) clearTimeout(randomHideTimerRef.current)
      randomHideTimerRef.current = window.setTimeout(hideRandomBubble, SHOW_DURATION)
    }

    const initial = 3000 + Math.random() * 5000
    randomShowTimerRef.current = window.setTimeout(showRandomBubble, initial)

    return () => {
      if (randomShowTimerRef.current) clearTimeout(randomShowTimerRef.current)
      if (randomHideTimerRef.current) clearTimeout(randomHideTimerRef.current)
      if (randomUnmountTimerRef.current) clearTimeout(randomUnmountTimerRef.current)
    }
  }, [])

  // ── 상호작용 말풍선 ──────────────────────────────
  // 부모가 매 렌더마다 새 onInteractionDone 을 넘겨도 useEffect 가 재실행되지 않도록 ref 에 보관
  const onInteractionDoneRef = useRef(onInteractionDone)
  useEffect(() => { onInteractionDoneRef.current = onInteractionDone }, [onInteractionDone])

  useEffect(() => {
    if (!interactionText) return

    // 이전 타이머 정리 (연속 상호작용 시 즉시 교체)
    if (interactionHideTimerRef.current) clearTimeout(interactionHideTimerRef.current)
    if (interactionUnmountTimerRef.current) clearTimeout(interactionUnmountTimerRef.current)

    keySeqRef.current++
    setInteractionSlot({ text: interactionText, phase: 'in', key: keySeqRef.current })

    // 부모가 interactionText 를 null 로 되돌려서 동일 텍스트 연속 호출도 받을 수 있게 함
    onInteractionDoneRef.current?.()

    interactionHideTimerRef.current = window.setTimeout(() => {
      setInteractionSlot((s) => (s ? { ...s, phase: 'out' } : s))
      interactionUnmountTimerRef.current = window.setTimeout(() => {
        setInteractionSlot(null)
      }, FADE_OUT_MS)
    }, SHOW_DURATION)
  }, [interactionText])

  useEffect(() => {
    return () => {
      if (interactionHideTimerRef.current) clearTimeout(interactionHideTimerRef.current)
      if (interactionUnmountTimerRef.current) clearTimeout(interactionUnmountTimerRef.current)
    }
  }, [])

  if (hide) return null

  // 상호작용이 존재하면 랜덤은 위로 밀린다. CSS transition 으로 부드럽게 슬라이드.
  const randomBottom = interactionSlot ? STACKED_BOTTOM : BASE_BOTTOM
  const interactionBottom = BASE_BOTTOM

  return (
    <>
      {randomSlot && <Bubble slot={randomSlot} bottom={randomBottom} />}
      {interactionSlot && <Bubble slot={interactionSlot} bottom={interactionBottom} />}
    </>
  )
}

// 단일 말풍선 렌더러 — 페이즈에 따라 in/out 애니메이션, bottom 변화는 CSS transition
function Bubble({ slot, bottom }: { slot: BubbleSlot; bottom: number }) {
  return (
    <div
      key={slot.key}
      style={{
        position: 'absolute',
        bottom,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(10, 5, 30, 0.9)',
        border: '1px solid rgba(120, 80, 255, 0.5)',
        borderRadius: 8,
        padding: '4px 8px',
        fontSize: 11,
        fontFamily: '"Pretendard", "맑은 고딕", monospace',
        color: 'rgba(220, 200, 255, 0.95)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        boxShadow: '0 0 8px rgba(100, 60, 255, 0.25)',
        animation: slot.phase === 'in'
          ? `bubble-in ${FADE_IN_MS}ms ease-out`
          : `bubble-out ${FADE_OUT_MS}ms ease-in forwards`,
        transition: 'bottom 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {slot.text}
      <div style={{
        position: 'absolute',
        bottom: -6,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '6px solid rgba(10, 5, 30, 0.9)',
      }} />
    </div>
  )
}
