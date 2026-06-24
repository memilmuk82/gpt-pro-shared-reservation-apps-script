# DEVELOPMENT_LOG.md

## 목적

이 문서는 GPT Pro 공동 사용 지원 시스템의 개발 과정, 의사결정, 문제 해결 기록을 보존하기 위한 개발 로그이다.

`PROJECT_STATUS.md`는 현재 상태 중심 문서이고, 이 문서는 왜 그렇게 구현했는지를 남기는 기록 문서이다.

---

## 2026-06-23 기준 개발 기록

### 운영 버전 방향 확정

운영 버전은 Google Apps Script + Google Sheets + Vanilla JavaScript 구조로 유지한다.

결정 이유:

- 학교 내부 업무용 도구로 Google Workspace 환경과 맞음
- Google Sheets 기반 데이터 저장이 운영자에게 익숙함
- 별도 서버 운영 없이 Web App으로 배포 가능
- 공용 GPT Pro 계정 예약이라는 목적에는 과한 기술 스택이 필요하지 않음

추가 결정:

- GPT 계정 ID/PW는 시스템에 저장하지 않음
- GPT 접속 정보는 학교 업무게시판에서 별도 관리
- 예약 시스템은 업무게시판 참고 안내만 표시

---

## Phase별 개발 기록

### Phase 1: DB 초기화/스키마

필수 시트와 기본 데이터를 구성했다.

주요 시트:

```text
Users
Reservations
UsageLog
GuideItems
Settings
RegistrationRequests
SettingsLog
```

핵심 결정:

- Google Sheets 헤더는 테스트와 함수가 의존하므로 임의 변경하지 않음
- 테스트 데이터는 `TEST_` prefix를 사용

### Phase 2: 사용자/권한 관리

사용자 인증, 활성 사용자 확인, 관리자/보조관리자 판정, 사용자 추가/수정/비활성화 기능을 구현했다.

핵심 결정:

- 이메일은 사용자 식별자에 가깝게 취급하고 수정하지 않음
- `senedu.kr` 도메인만 사용자 등록 허용
- 활성 admin은 최소 1명 이상 유지

### Phase 3: 예약 시스템

예약 생성, 즉시 사용 시작, 충돌 확인, 상태 전환, 취소, 완료, 관리자 삭제를 구현했다.

핵심 결정:

- 충돌 예약은 무조건 금지하지 않고 조율 확인 후 저장 가능
- 충돌 확인 없이 중복 예약 저장은 허용하지 않음
- 완료 예약은 재시작할 수 없음

### Phase 4: 초기 데이터 통합

초기 화면에 필요한 사용자 정보, Settings, GuideItems, 인증번호 담당자, 예약 정보를 통합 조회하는 흐름을 구성했다.

핵심 결정:

- 앱 로딩 시 필요한 데이터를 한 번에 가져와 초기 화면 반응성을 높임
- 미등록 사용자도 등록 요청 상태를 확인할 수 있게 함

### Phase 5: 통계/테스트 통합

관리자 통계와 전체 테스트 집계 구조를 구성했다.

핵심 결정:

- 각 Phase 테스트 결과를 하나의 `TEST_runAll`로 통합
- 이후 기능 추가 시 전체 테스트에 포함해 회귀를 확인

### Phase 7: 등록 요청 시스템

미등록 사용자가 이름, 부서, 내선번호로 등록 요청을 할 수 있게 했다.

핵심 결정:

- 휴대폰 번호는 수집하지 않음
- 동일 이메일의 중복 대기 요청 방지
- 승인 시 Users에 자동 등록
- 반려 시 사유 기록 가능

### Phase 9-A/B: Settings 관리

Settings 조회, 수정, 일괄 저장, SettingsLog 기록을 구현했다.

핵심 결정:

- 허용된 setting_key만 수정 가능
- 숫자 설정은 범위 검증
- 일괄 저장은 all-or-nothing 적용
- GPT 계정 ID/PW는 Settings에 저장하지 않음

### Phase 9-C: GuideItems 안내 문구 관리

GuideItems 관리자 조회, 수정, 일괄 저장을 구현했다.

핵심 결정:

- 사용자 안내 화면에는 active=true 항목만 표시
- 관리자 화면에서는 active=false 항목도 조회
- HTML 문자열은 실행하지 않고 텍스트로 표시
- 생성/삭제는 보류하고 수정 중심으로 운영

### Phase 10: 커스텀 Modal

브라우저 기본 confirm/prompt를 커스텀 Confirm Modal과 Input Modal로 교체했다.

결정 이유:

- Apps Script iframe 환경에서 기본 브라우저 팝업 문구가 사용자 경험을 해침
- Modal 문구를 표준화하여 관리자 행동을 명확히 안내

### Phase 11: 공용 PC 안전장치

사용 종료 버튼, 수동 화면 잠금, 30분 자동 잠금, 다시 접속 기능을 구현했다.

핵심 결정:

- 화면 잠금은 Google/GPT 계정 로그아웃이 아님
- 앱은 로그아웃 확인 안내를 제공하고, 실제 로그아웃은 사용자가 직접 수행

### Phase 12-A: 관리자 페이지 레이아웃 개선

관리자 기능 카드의 버튼 넘침 문제를 개선했다.

핵심 결정:

- 기능 동작에 영향을 주지 않는 범위에서 UI 안정성만 개선
- 카드 높이 정렬 등 미세 정렬은 후순위로 보류

### Phase 13-A: 사용자 CSV 일괄 등록 백엔드

관리자용 `adminBulkCreateUsers()`를 추가하고 서버 최종 검증 및 all-or-nothing 저장을 구현했다.

검증 항목:

```text
email 필수
name 필수
department 필수
senedu.kr 도메인
CSV 내부 이메일 중복
기존 사용자 이메일 중복
role 허용값
active 허용값
is_auth_manager 허용값
sort_order 0 이상 정수
```

테스트 결과:

```text
TEST_runPhase13UserBulkCreate
PASS 8
FAIL 0
```

전체 테스트 결과:

```text
TEST_runAll
전체 73
PASS 73
FAIL 0
```

### Phase 13-B: 사용자 CSV 업로드/미리보기 프론트

관리자 화면에 CSV 파일 선택, 클라이언트 파싱, 미리보기, 서버 검증 결과 표시, 실패 행 상세 메시지를 추가했다.

핵심 결정:

- 프론트 검증은 UX 보조
- 최종 검증은 서버 `adminBulkCreateUsers()`에서 수행
- 하나라도 실패하면 아무 사용자도 저장하지 않음

---

## 주요 의사결정 기록

### CSV 예시 자동 다운로드 기능 제외

검토한 기능:

```text
예시 CSV 자동 생성
예시 CSV 다운로드 버튼
Drive 파일 URL 자동 연결
상대 경로 CSV 다운로드
```

결론:

```text
Apps Script 운영 버전에서는 구현하지 않음
```

이유:

- Apps Script HTMLService는 일반적인 정적 파일 상대 경로 다운로드 구조가 아님
- DriveApp 권한 추가가 필요함
- Drive 파일 이동/복사/소유권 변경 시 URL 관리 부담 발생
- 기능 대비 운영 복잡도가 큼

대신 운영 방식:

```text
스프레드시트와 같은 Google Drive 폴더에 `일괄등록.csv`를 수동으로 둔다.
관리자는 해당 파일을 복사 또는 다운로드하여 편집한 뒤 업로드한다.
```

차기 버전 이관:

```text
Flask + PostgreSQL + OCI 버전에서 CSV 템플릿 다운로드, 업로드 이력, 검증 로그 기능으로 구현 예정
```

### Client_Backup.html 삭제 결정

`Client_Backup.html`은 리팩토링 전 백업 파일이며 현재 include하지 않는다.

결론:

```text
Phase 13-A/B 안정화 및 TEST_runAll 73 PASS 확인 후 삭제 확정
```

이유:

- 런타임에서 사용하지 않음
- GitHub 저장소에 남기면 실제 운영 파일과 혼동됨
- 필요한 기록은 Git 커밋 히스토리와 문서로 보존하는 편이 맞음

### 선택/보류 항목 판단

선택 반영:

```text
GuideItems 변경 로그
관리자 UI 미세 정렬
사용 종료 Modal 체크리스트
```

보류:

```text
GuideItems 생성
GuideItems 삭제
자동 잠금 시간 Settings 연동
네임스페이스 리팩토링
```

보류 이유:

- 운영 차단 이슈가 아님
- 시트 구조 변경 또는 정책 변경이 필요할 수 있음
- 현재 안정화된 구조를 불필요하게 흔들 위험이 있음

---

## 개발 상태 요약

```text
핵심 기능: 완료
운영 안정화: 완료에 가까움
문서 갱신: 필요
GitHub 보존: 필요
차기 포트폴리오 버전: 별도 프로젝트로 진행
```
