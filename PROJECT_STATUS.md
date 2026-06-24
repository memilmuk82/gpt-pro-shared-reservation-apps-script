# PROJECT_STATUS.md

## 프로젝트 개요

### 프로젝트명

GPT Pro 공동 사용 지원 시스템

### 목적

학교 부서에서 공동으로 사용하는 GPT Pro 계정을 예약·관리하기 위한 내부 업무용 웹앱이다.

주요 목적은 다음과 같다.

- 부서 공용 GPT Pro 사용 시간 예약
- 현재 사용 중인 사용자 확인
- 예약 충돌 확인
- 사용 완료/취소 처리
- 미등록 사용자 등록 요청
- 관리자 승인/반려
- 사용자 관리
- 설정 관리
- 사용 안내 및 보안 안내 제공
- 공용 PC 환경에서 이전 사용자 화면 노출 최소화

### 기술 스택

```text
Frontend: Vanilla JavaScript, Tailwind CSS, Google Apps Script HTMLService
Backend: Google Apps Script
DB: Google Sheets
Authentication: Google Workspace 계정, senedu.kr 도메인 기준
운영 환경: Google Apps Script Web App + Google Sheets
```

---

## 현재 상태

### 현재 진행률

현재 기준:

```text
Phase 1 완료
Phase 2 완료
Phase 3 완료
Phase 4 완료
Phase 5 완료
Phase 6 완료
Phase 7 완료
Phase 8 완료
Phase 9-A 완료
Phase 9-B 완료
Phase 9-C 완료
Phase 10 완료
Phase 11 완료
Phase 12-A 완료
Phase 13-A 완료
Phase 13-B 완료
```

현재 전체 테스트:

```text
TEST_runAll
전체 73
PASS 73
FAIL 0
```

Phase 13-A 사용자 CSV 일괄 등록 테스트:

```text
TEST_runPhase13UserBulkCreate
PASS 8
FAIL 0
```

주의:

```text
이 문서는 사용자가 Apps Script 프로젝트에 수동 반영하고 수동/서버 테스트 완료를 보고한 상태를 기준으로 한다.
새 채팅창에서 코드 작업을 이어갈 때는 실제 Apps Script의 최신 파일을 다시 업로드한 뒤 코드와 문서를 대조한다.
```

### 최근 완료 작업

- Phase 9-A 설정 관리 백엔드 완료
- Phase 9-B 설정 관리 프론트 완료
- Settings 일괄 저장 all-or-nothing 적용
- Phase 9-C GuideItems 안내 문구 관리 백엔드/프론트 완료
- GuideItems 일괄 저장 all-or-nothing 적용
- 커스텀 Confirm Modal 적용
- 커스텀 Input Modal 적용
- 브라우저 기본 confirm/prompt 제거
- 공용 PC 안전장치 적용
- 사용 종료 버튼 추가
- 수동 화면 잠금 추가
- 30분 미사용 자동 화면 잠금 추가
- 다시 접속 기능 보완
- 관리자 페이지 레이아웃 개선
- 관리자 카드 버튼 넘침 문제 개선
- Phase 13-A 사용자 CSV 일괄 등록 백엔드 완료
- `adminBulkCreateUsers()` 추가
- CSV 컬럼 검증 적용
- 사용자 CSV 일괄 등록 all-or-nothing 저장 적용
- CSV 내부 중복 이메일 검증 적용
- 기존 사용자 이메일 중복 검증 적용
- `senedu.kr` 외부 도메인 등록 방지 적용
- role / active / is_auth_manager / sort_order 검증 적용
- Phase 13-A 테스트 8개 추가 및 통과
- Phase 13-B 관리자 CSV 업로드 UI 완료
- CSV 파일 선택 및 클라이언트 파싱 적용
- 등록 전 미리보기 적용
- 서버 검증 결과 실패 행 상세 표시 적용
- 정상 CSV / 오류 CSV 수동 테스트 확인
- 전체 테스트 73 PASS 확인

### 현재 작업 기준점

```text
Phase 9-C GuideItems 안내 문구 관리 완료
Phase 10 커스텀 Modal 완료
Phase 11 공용 PC 안전장치 완료
Phase 12-A 관리자 페이지 레이아웃 개선 완료
Phase 13-A 사용자 CSV 일괄 등록 백엔드 완료
Phase 13-B 관리자 CSV 업로드/미리보기 UI 완료
TEST_runAll PASS 73 / FAIL 0
Phase 13 사용자 CSV 일괄 등록 완료
Client_Backup.html 삭제 확정
```

---

## 구현 완료 기능

### 사용자 인증 및 기본 환경 확인

- 접속자 이메일 확인
- 실행 계정 확인
- Google Sheet 접근 확인
- 타임존 확인

### DB 초기화

사용 중인 시트:

```text
Users
Reservations
UsageLog
GuideItems
Settings
RegistrationRequests
SettingsLog
```

### 사용자/권한 관리

- 사용자 추가
- 사용자 수정
- 사용자 비활성화
- 사용자 활성화
- 활성 사용자 조회
- 관리자 권한 판정
- 보조관리자 권한 판정
- 이메일 수정 방지
- `senedu.kr` 외부 도메인 등록 방지
- 최소 활성 관리자 1명 유지

관리자 정책:

```text
admin: 시스템 소유자급 관리자
subadmin: 업무 보조 관리자
user: 일반 사용자
```

중요 불변조건:

```text
활성 admin은 최소 1명 이상 유지되어야 함
```

### 예약 시스템

- 예약 생성
- 즉시 사용 시작
- 충돌 감지
- 충돌 확인 후 저장
- 충돌 미확인 저장 거부
- 예약 상태 전환: 예약, 사용중, 완료
- 예약 취소
- 완료 예약 재시작 방지
- 관리자 삭제 처리
- 현재 사용자 조회
- 오늘 예약 조회
- 내 예약 조회
- 날짜별 예약 조회
- 다음 예약 조회

### 초기 데이터 통합

- `getInitialData()`
- `getInitialDataV2()`
- 현재 사용자 정보 조회
- Settings 조회
- GuideItems 조회
- 인증번호 담당자 조회
- 오늘 예약 조회
- 내 예약 조회
- 다음 예약 조회
- 미등록 사용자 등록 요청 상태 조회

### 통계

- 사용자별 통계
- 작업 유형별 통계
- 월별 통계
- 예약 기준 사용 시간
- 실제 사용 시간
- 전체 테스트 집계

### 사용자 관리 화면

- 사용자 목록 조회
- 사용자 추가
- 사용자 수정
- 사용자 활성화
- 사용자 비활성화
- 인증번호 담당자 지정
- 권한 변경
- 최소 활성 관리자 유지 UI 처리
- 사용자 CSV 일괄 등록
- CSV 파일 업로드
- CSV 클라이언트 파싱
- 등록 전 미리보기
- 서버 검증 결과 표시
- 실패 행 상세 메시지 표시
- CSV 일괄 등록 후 사용자 목록 갱신

CSV 운영 방식:

```text
예시 CSV 파일은 앱에서 자동 생성하거나 다운로드하지 않는다.
스프레드시트와 같은 Google Drive 폴더에 `일괄등록.csv` 파일을 수동으로 둔다.
관리자는 해당 파일을 복사 또는 다운로드하여 편집한 뒤 관리자 화면에서 업로드한다.
```

### 등록 요청 시스템

- 미등록 사용자 등록 요청
- 이름/부서/내선번호 입력
- 휴대폰 번호 수집 안 함
- 중복 대기 요청 방지
- 외부 도메인 요청 방지
- 기존 사용자 요청 방지
- 관리자 등록 요청 목록 조회
- 관리자 승인
- 관리자 반려
- 승인 시 Users 자동 등록
- 반려 사유 기록

상태값:

```text
대기
승인
반려
```

### Settings 관리

- 관리자 설정 조회
- 허용된 설정만 수정
- 허용되지 않은 setting_key 거부
- 필수 설정 빈 값 거부
- 숫자 설정값 검증
- 설정 변경 로그 기록
- 설정 일괄 저장
- 변경된 항목만 서버 전송
- 일괄 저장 all-or-nothing 적용
- 실패 시 상세 오류 메시지 출력
- 저장 성공 시 state 반영

### GuideItems 안내 문구 관리

- 관리자 GuideItems 전체 조회
- active=false 항목도 관리자 목록에 포함
- GuideItems 수정
- GuideItems 일괄 저장
- GuideItems 일괄 저장 all-or-nothing 적용
- category/title/content/sort_order/active 수정
- active=false 항목은 사용자 안내 화면에서 제외
- sort_order 정렬 확인
- HTML 문자열 데이터 보존
- 없는 guide_id 수정 거부

### 공용 PC 안전장치

- 헤더 사용 종료 버튼
- 사용 종료 확인 Modal
- 수동 화면 잠금
- 30분 미사용 자동 화면 잠금
- 잠금 화면 GPT/Google 로그아웃 안내
- 다시 접속 버튼

주의:

```text
화면 잠금은 Google 계정 또는 GPT 계정 자체 로그아웃이 아니다.
공용 PC에서는 사용자가 GPT와 Google 계정 로그아웃을 직접 확인해야 한다.
```

---

## 정책 및 설계 결정사항

### 보안 정책

- GPT 계정 ID/PW는 예약 시스템에 저장하지 않음
- GPT 접속 정보는 업무게시판에서 관리
- 예약 시스템은 업무게시판 참고 안내만 표시
- 개인정보/민감정보/평가 자료/학생부 자료 입력 금지 원칙 유지
- GuideItems HTML은 실행하지 않고 문자열로 표시
- 사용자 입력 안내 문구도 escape 처리
- 공용 PC에서는 화면 잠금만 믿지 않고 GPT/Google 로그아웃을 직접 확인해야 함

### 기타 설계 결정

- Vanilla JS 유지
- Tailwind CSS 유지
- React/Vue/Svelte 미사용
- 현재 구조에서는 네임스페이스 리팩토링 미적용
- 현재는 파일 분리 구조로 충분한 유지보수성 확보
- `Client_Backup.html`은 삭제 확정
- CSV 예시 파일 자동 생성/다운로드 기능은 Apps Script 운영 버전에서 구현하지 않음
- CSV 예시 파일은 스프레드시트와 같은 Google Drive 폴더에 `일괄등록.csv`로 수동 배치하여 운영
- 예시 CSV 자동 생성, 다운로드 버튼, Drive URL 연결, 상대 경로 다운로드는 Flask + PostgreSQL + OCI 버전 백로그로 이관
- 학교 운영 버전은 Apps Script + Google Sheets 유지

---

## 파일 구조

### GS 파일

```text
Code.gs
Phase1_Setup.gs
Phase2_UserAuth.gs
Phase3_Reservations.gs
Phase4_AppData.gs
Phase5_StatsAndTests.gs
Phase7_RegistrationRequests.gs
Phase9_SettingsManagement.gs
Phase9_GuideItemsManagement.gs
```

### HTML 파일

```text
Index.html
Styles.html
Client_State.html
Client_Utils.html
Client_Icons.html
Client_Components.html
Client_Views.html
Client_Handlers.html
Client_App.html
```

삭제 확정:

```text
Client_Backup.html
```

### Client include 순서

```html
<?!= include('Client_Utils'); ?>
<?!= include('Client_State'); ?>
<?!= include('Client_Icons'); ?>
<?!= include('Client_Components'); ?>
<?!= include('Client_Views'); ?>
<?!= include('Client_Handlers'); ?>
<?!= include('Client_App'); ?>
```

주의:

```text
각 Client_*.html 파일 내부에는 <script> 태그가 포함되어 있으므로 Index.html에서 다시 <script>로 감싸지 않는다.
Client_Utils.html가 Client_State.html보다 먼저 include되어야 한다.
```

### Phase2_UserAuth.gs 주요 함수

```text
getCurrentUser()
getActiveUsers()
adminCreateUser()
adminBulkCreateUsers()
adminUpdateUser()
adminDeactivateUser()
adminGetUsers()
requirePhase2ActiveUser_()
requirePhase2Admin_()
TEST_runPhase13UserBulkCreate()
```

### Phase5_StatsAndTests.gs 테스트 포함 Phase

```text
Phase 1
Phase 2
Phase 13-A
Phase 3
Phase 4
Phase 5
Phase 7
Phase 9
Phase 9-C
```

---

## 데이터 구조

### Users

주요 컬럼:

```text
user_id
department
name
extension
email
role
active
is_auth_manager
sort_order
created_at
updated_at
```

Phase 13 CSV 일괄 등록 컬럼:

```text
email,name,department,extension,role,active,is_auth_manager,sort_order
```

CSV 운영 메모:

```text
- email, name, department는 필수
- extension은 선택
- role은 빈 값이면 user
- active는 빈 값이면 true
- is_auth_manager는 빈 값이면 false
- sort_order는 빈 값 또는 0 이상의 정수
- 최종 검증은 서버에서 수행
- 하나라도 실패하면 아무 사용자도 저장하지 않음
```

---

## 테스트 결과

현재 전체 테스트:

```text
TEST_runAll
전체 73
PASS 73
FAIL 0
```

Phase별 테스트:

```text
Phase 1 - DB 초기화/스키마        PASS 9
Phase 2 - 사용자/권한             PASS 10
Phase 13-A - 사용자 CSV 일괄 등록 PASS 8
Phase 3 - 예약 핵심 로직          PASS 13
Phase 4 - 초기 데이터 통합        PASS 7
Phase 5 - 통계/테스트 통합        PASS 3
Phase 7 - 등록 요청/승인          PASS 9
Phase 9 - 설정 관리               PASS 7
Phase 9-C - 안내 문구 관리        PASS 7
```

확인 완료 항목:

- DB 시트 구조 정상
- 사용자 추가/수정/비활성화 정상
- 최소 활성 관리자 유지 정상
- 예약 생성/충돌/취소/완료 정상
- 등록 요청 승인/반려 정상
- Settings 조회/수정/로그 기록 정상
- Settings 일괄 저장 all-or-nothing 정상
- GuideItems 백엔드 수정 정상
- GuideItems 일괄 저장 all-or-nothing 정상
- GuideItems 관리자 프론트 정상
- 커스텀 Confirm/Input Modal 정상
- 사용 종료 버튼 정상
- 수동 화면 잠금 정상
- 자동 화면 잠금 정상
- 다시 접속 정상
- 관리자 페이지 카드 버튼 넘침 문제 해결
- 사용자 CSV 일괄 등록 백엔드 검증 정상
- 사용자 CSV 일괄 등록 all-or-nothing 정상
- CSV 내부 중복 이메일 방지 정상
- 기존 사용자 이메일 중복 방지 정상
- 외부 도메인 등록 방지 정상
- role / active / sort_order 검증 정상
- CSV 업로드 및 미리보기 정상
- 서버 검증 실패 행 상세 표시 정상
- 전체 테스트 73 PASS 확인

---

## 남은 작업

### 즉시 반영

```text
1. PROJECT_STATUS.md 최신화
2. DEVELOPMENT_LOG.md 최신화
3. Client_Backup.html 삭제
4. 일괄등록.csv 운영 파일을 Drive 폴더에 수동 배치
5. GitHub 저장소 생성 및 코드/문서 보존
```

### 선택 반영

```text
1. GuideItems 변경 로그
2. 관리자 UI 미세 정렬
3. 사용 종료 Modal 체크리스트
```

### 보류

```text
1. GuideItems 생성
2. GuideItems 삭제
3. 자동 잠금 시간 Settings 연동
4. 네임스페이스 리팩토링
```

### Flask + PostgreSQL + OCI 버전 백로그

```text
1. CSV 예시 파일 다운로드
2. CSV 템플릿 버전 관리
3. CSV 업로드 이력 관리
4. 검증 실패 로그 저장
5. 관리자 다운로드 라우트
```

---

## 새 채팅창 작업 지침

현재 기준점:

```text
Phase 9-C 완료
Phase 10 완료
Phase 11 완료
Phase 12-A 완료
Phase 13-A 완료
Phase 13-B 완료
TEST_runAll PASS 73 / FAIL 0
Phase 13 사용자 CSV 일괄 등록 완료
Client_Backup.html 삭제 확정
```

다음에 바로 할 작업:

```text
1. 문서 갱신 반영
2. Client_Backup.html 삭제
3. GitHub 저장소 구성
4. 운영용 일괄등록.csv 수동 배치
5. 실사용자 대상 운영 테스트
```
