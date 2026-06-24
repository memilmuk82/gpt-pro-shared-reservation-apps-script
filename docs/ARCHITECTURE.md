# ARCHITECTURE.md

## 전체 구조

```text
Google Apps Script Web App
├─ HTMLService Frontend
├─ Apps Script Backend
└─ Google Sheets Database
```

## Frontend 구조

현재 클라이언트는 여러 HTML 파일로 분리되어 있으며, 각 파일 내부에 `<script>` 태그가 포함되어 있다.

```text
Client_State.html       전역 상태와 라우트 정의
Client_Utils.html       서버 호출, 공통 유틸, escape, 날짜/시간, Modal, 화면 잠금 유틸
Client_Icons.html       SVG 아이콘 반환
Client_Components.html  반복 UI 컴포넌트
Client_Views.html       화면 단위 렌더링
Client_Handlers.html    이벤트 핸들러와 서버 호출 처리
Client_App.html         앱 초기화, 라우팅, 초기 데이터 로딩
```

## Index include 순서

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
Index.html에서 Client include 전체를 다시 <script> 태그로 감싸지 않는다.
Client_Utils.html가 Client_State.html보다 먼저 와야 한다.
```

## Backend 구조

```text
Code.gs                         doGet(), include()
Phase1_Setup.gs                 DB 초기화, 시트/헤더/seed 생성
Phase2_UserAuth.gs              사용자 인증, 권한, 사용자 관리, CSV 일괄 등록
Phase3_Reservations.gs          예약 핵심 로직
Phase4_AppData.gs               초기 데이터 통합
Phase5_StatsAndTests.gs         통계, 전체 테스트 집계
Phase7_RegistrationRequests.gs  등록 요청/승인/반려
Phase9_SettingsManagement.gs    Settings 관리
Phase9_GuideItemsManagement.gs  GuideItems 관리
```

## 데이터 저장 구조

```text
Users
Reservations
UsageLog
GuideItems
Settings
RegistrationRequests
SettingsLog
```

## 설계 원칙

- 기존 Phase 구조 유지
- Client 파일 역할 분리 유지
- 서버 함수는 권한 검증 포함
- 관리자 함수는 관리자 권한 검증 우회 금지
- 사용자 입력은 서버에서 최종 검증
- 프론트 검증은 UX 보조
- Settings와 GuideItems 일괄 저장은 all-or-nothing
- CSV 일괄 등록도 all-or-nothing
