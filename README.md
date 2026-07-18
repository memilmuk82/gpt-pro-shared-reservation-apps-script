# GPT Pro 공동 사용 예약·관리 시스템

## 프로젝트 개요

조직에서 공동으로 사용하는 GPT Pro 계정의 사용 시간을 예약하고 사용자·안내·운영 설정을 관리하는 Google Apps Script 웹앱입니다. HTMLService 프론트엔드와 Apps Script 서버 함수로 구성되며 데이터는 Google Sheets에 저장합니다.

GPT 계정의 ID, 비밀번호나 접속 URL을 저장하는 비밀 관리 도구는 아닙니다. 코드의 기본 안내는 별도 내부 게시판에서 접속 정보를 확인하도록 설계되어 있습니다.

## 주요 기능

- 예약 생성과 즉시 사용 시작
- 예약 충돌 확인과 조율 확인 후 저장
- 사용 시작·완료·취소와 관리자 삭제
- 현재·다음·당일·내 예약 조회
- Google Workspace 접속 계정 기반 사용자 확인
- 미등록 사용자의 등록 요청과 관리자 승인·반려
- 사용자 생성·수정·비활성화와 관리자 권한 보호
- 사용자 CSV 일괄 검증·등록
- 사용 통계와 사용 기록
- 운영 설정과 안내 항목 관리
- 공용 PC 화면 잠금과 사용 종료 안내

## 기술 스택과 Google 서비스

- Google Apps Script V8
- HTMLService
- Vanilla JavaScript
- Tailwind CSS CDN
- Google Sheets
- Google Workspace `Session`
- `SpreadsheetApp`, `PropertiesService`, `LockService`와 `Utilities`

별도의 Node.js 빌드, 패키지 설치, 서버, 관계형 데이터베이스와 외부 GPT API 호출은 없습니다. Tailwind CSS는 외부 CDN을 사용하므로 네트워크 정책에 따라 화면 스타일이 영향을 받을 수 있습니다.

## 프로젝트 구조

```text
.
├── Code.js                         # doGet, HTML include와 Phase 0 점검
├── Phase1_Setup.js                 # 시트·헤더·기본값 초기화
├── Phase2_UserAuth.js              # 사용자·권한·CSV 일괄 등록
├── Phase3_Reservations.js          # 예약과 상태 변경
├── Phase4_AppData.js               # 초기 화면 데이터
├── Phase5_StatsAndTests.js         # 통계와 전체 테스트 집계
├── Phase7_RegistrationRequests.js  # 등록 요청·승인·반려
├── Phase9_SettingsManagement.js    # 운영 설정과 변경 로그
├── Phase9_GuideItemsManagement.js  # 안내 항목 관리
├── Index.html
├── Styles.html
├── Client_*.html                   # 상태·유틸·UI·이벤트·초기화
├── appsscript.json
├── docs/
└── templates/
```

Apps Script 편집기에서는 서버 `.js` 파일을 대응하는 `.gs` 파일로 등록합니다. 정확한 파일 목록과 HTML include 순서는 [Apps Script 파일 목록](docs/APPS_SCRIPT_FILE_INVENTORY.md)과 [구조 문서](docs/ARCHITECTURE.md)를 참고합니다.

## 데이터 저장 구조

애플리케이션은 다음 시트를 생성하거나 사용합니다.

| 시트 | 저장 내용 |
|---|---|
| `Users` | 사용자 식별정보, 부서, 연락 정보, 역할과 활성 상태 |
| `Reservations` | 예약 시간, 업무 설명, 상태와 사용자 정보 |
| `UsageLog` | 예약 상태 변경과 실제 사용 시간 기록 |
| `GuideItems` | 사용자 안내 항목 |
| `Settings` | 앱 제목, 조직명, 안내와 시간 설정 |
| `RegistrationRequests` | 미등록 사용자의 등록 요청과 처리 정보 |
| `SettingsLog` | 설정의 이전·변경 값, 변경자와 시각 |

사용자 비활성화는 기존 예약·사용 기록을 자동 삭제하지 않습니다. 예약 삭제도 상태와 삭제 정보를 남기는 흐름이 있으며, 설정 변경 로그는 이전 값과 새 값을 저장합니다. 자동 보존 기간, 만료·파기 작업, 익명화, 백업·복원 정책은 코드에 구현되어 있지 않습니다. 운영 조직이 Google Sheet 공유 권한과 함께 별도 정책을 정해야 합니다.

## 스프레드시트 연결 설정

기본 방식은 대상 Google Sheet에 바인딩된 Apps Script 프로젝트입니다. `getPhase1Database_()`는 다음 순서로 저장소를 선택합니다.

1. Script Properties의 `SPREADSHEET_ID`가 있으면 해당 스프레드시트를 엽니다.
2. 속성이 없으면 바인딩된 활성 스프레드시트를 사용합니다.
3. 두 방식 모두 사용할 수 없으면 오류를 반환합니다.

실제 스프레드시트 ID를 소스 코드, README, 이슈나 커밋에 기록하지 마세요. 독립형 스크립트에서만 Script Properties에 안전하게 설정하고, 바인딩 방식에서는 속성을 생략할 수 있습니다.

코드에는 허용 조직 도메인이 설정되어 있습니다. 현재 기본값은 `senedu.kr`이며 다른 조직에서 사용하려면 정책과 코드의 도메인 검증을 함께 검토해야 합니다. `.env` 파일이나 로컬 환경 변수는 사용하지 않습니다.

## 초기화와 배포

> 초기화 및 테스트 함수는 Google Sheet를 생성·수정할 수 있습니다. 운영 데이터가 없는 새 시트나 승인된 복사본에서 먼저 검증하세요.

1. 대상 Google Sheet와 Apps Script 프로젝트를 준비합니다.
2. [파일 목록](docs/APPS_SCRIPT_FILE_INVENTORY.md)에 따라 `.gs`, HTML과 `appsscript.json`을 등록합니다.
3. 독립형 프로젝트이면 Script Properties에 `SPREADSHEET_ID`를 설정합니다.
4. 학교 관리자 계정으로 권한 승인 후 `initializeAndTestPhase1`을 실행해 기본 시트와 seed를 준비합니다.
5. 등록 요청과 설정 로그가 필요하면 Phase 7·9 초기화 함수의 권한과 변경 범위를 검토한 뒤 빈 복사본에서 실행합니다.
6. 테스트 후 웹앱으로 새 배포하고 도메인 사용자·미등록 사용자·관리자 시나리오를 각각 확인합니다.

`appsscript.json`은 웹앱을 배포자 권한으로 실행하고 배포자 Workspace 도메인에 공개하도록 선언합니다.

```text
executeAs: USER_DEPLOYING
access: DOMAIN
```

이는 도메인 사용자의 요청이 배포자 권한으로 Google Sheet에 접근할 수 있음을 뜻합니다. 배포 계정의 시트·드라이브 권한을 최소화하고, 대상 Sheet를 별도 운영 계정과 제한된 공유 범위로 관리해야 합니다. 운영 Web App URL은 저장소에 기록하지 않습니다.

저장소에는 `.clasp.json`과 인증 파일이 없으므로 `clasp`를 이용한 특정 프로젝트 연결은 별도 로컬 설정이 필요합니다. GitHub 보존 절차는 [GitHub 업로드 가이드](docs/GITHUB_UPLOAD_GUIDE.md)를 참고합니다.

## 인증과 권한 경계

사용자 식별은 `Session.getActiveUser().getEmail()`과 조직 도메인 검사에 의존합니다. 관리자용 사용자·통계·설정·안내 함수는 서버 측 역할 검사를 수행하지만 다음 경계는 배포 전 추가 검토가 필요합니다.

- 미등록 또는 비활성 사용자의 초기 응답에도 공통 설정, 안내 항목과 인증 담당자 사용자 객체가 포함됩니다.
- 인증 담당자 객체는 이름, 부서, 내선, 이메일과 역할 같은 필드를 포함할 수 있습니다.
- Apps Script에서 이름이 밑줄로 끝나지 않는 최상위 함수는 클라이언트 호출 가능 범위가 될 수 있습니다.
- 코드에는 초기화, Phase 테스트와 전체 테스트를 위한 공개 이름 함수가 여러 개 있습니다.
- 일부 초기화·테스트 함수는 시트 생성, seed 입력, probe 기록 또는 테스트 행 정리를 수행합니다.
- 초기화 함수마다 선행 권한 검사의 위치와 강도가 같지 않습니다.

공개 배포 전에는 미등록 사용자에게 필요한 최소 필드만 반환하도록 초기 데이터를 축소하고 인증 담당자 연락정보의 가시성 근거를 확인해야 합니다. 운영 UI에서 사용하지 않는 초기화·테스트 함수는 비공개 이름으로 바꾸거나 명시적인 관리자 검사를 추가하는 방안을 검토해야 합니다.

## Settings 일괄 저장의 원자성 한계

`adminUpdateSettings()`는 모든 입력을 먼저 형식 검증한 뒤 `adminUpdateSetting()`을 항목별로 호출합니다. 그러나 단일 설정마다 별도의 잠금·쓰기·로그 기록이 수행되고 전체 묶음을 되돌리는 트랜잭션은 없습니다.

또한 내부 `adminUpdateSetting()`이 예외를 실패 응답 객체로 변환해도 일괄 함수는 각 결과의 `ok`를 다시 검사하지 않고 최종 성공 응답에 결과 배열을 담을 수 있습니다. 따라서 중간 쓰기 실패 시 일부 설정만 저장된 상태에서 바깥 응답은 성공처럼 보일 수 있습니다.

현재 동작을 데이터베이스 트랜잭션이나 보장된 all-or-nothing 저장으로 설명해서는 안 됩니다. 운영 전에는 하나의 잠금 범위에서 변경 전 값을 보관하고 모든 내부 결과를 검사한 뒤 실패 시 복구하거나, 부분 성공을 명확히 보고하는 방식으로 수정해야 합니다.

## 테스트

코드와 프로젝트 체크리스트는 `TEST_runAll`이 집계하는 73개 테스트 케이스를 기준으로 합니다. 범위는 시트·헤더, 사용자·권한, CSV 일괄 등록, 예약, 초기 데이터, 통계, 등록 요청, Settings와 GuideItems입니다.

73개 테스트를 실행하려면 Apps Script V8, Google Workspace 사용자 식별과 쓰기 가능한 운영 구조의 Google Sheet가 필요합니다. 로컬 셸에서 동일하게 실행할 테스트 러너는 제공하지 않습니다.

`TEST_runAll`은 관리자 검사를 수행하며 여러 테스트는 시트에 테스트 행을 추가·변경·삭제합니다. 운영 시트에서 바로 실행하지 말고 승인된 복사본에서 먼저 수행해야 합니다. 수동 검증 항목은 [수동 테스트 체크리스트](docs/MANUAL_TEST_CHECKLIST.md)에 정리되어 있습니다.

## 보안과 개인정보

- GPT 계정 ID·비밀번호·접속 URL을 코드나 Sheet에 저장하지 않습니다.
- 사용자·예약·업무 설명·등록 요청·설정 변경자 정보는 개인정보 또는 내부 업무 정보가 될 수 있습니다.
- Google Sheet 공유 대상, Apps Script 배포 도메인과 배포자 권한을 함께 제한해야 합니다.
- CSV 업로드는 실제 운영 파일이 아닌 비식별 테스트 자료로 먼저 검증해야 합니다.
- 공용 PC에서는 사용 종료 후 GPT 로그아웃, 화면 잠금과 Google 계정 세션 종료 절차가 필요합니다.
- 오류 응답과 Apps Script 로그에 이메일·업무 내용이 남을 수 있으므로 로그 접근과 보존 정책을 검토해야 합니다.

`docs/images/`의 화면 캡처 중 적어도 하나에는 실제 조직 사용자처럼 보이는 식별정보가 포함되어 있습니다. 실제 값은 이 README에 재기재하지 않았으며 캡처도 여기에 삽입하지 않습니다. 저장소를 공개하기 전에 모든 이미지의 이름, 이메일, 부서, 내선, 예약·업무 내용을 검토하고 가상 데이터로 교체하거나 안전하게 비식별화해야 합니다. 파일을 교체해도 Git 이력에 이전 이미지가 남는지 별도로 확인해야 합니다.

보안·개인정보 원칙의 기존 문서는 [보안 및 개인정보 문서](docs/SECURITY_AND_PRIVACY.md)를 참고하되, 현재 코드의 초기 데이터 범위와 공개 함수 위험을 함께 반영해 갱신해야 합니다.

## 구현 범위와 제한 사항

- 저장소 문서는 v1.01 안정화 상태를 설명하지만 현재 운영 Sheet에서 다시 실행 검증하지 않았습니다.
- Apps Script와 Google Sheets에 강하게 결합되어 로컬 단독 실행이 불가능합니다.
- 배포자 권한 실행으로 인해 서버 함수의 권한 검사가 중요합니다.
- Settings 일괄 저장은 원자적 트랜잭션이 아닙니다.
- 미등록 사용자에게 반환되는 공통 데이터 범위가 넓습니다.
- 초기화·테스트 공개 함수의 호출 권한과 변경 범위를 정리해야 합니다.
- 자동 데이터 보존·삭제·익명화와 백업 정책이 없습니다.
- Tailwind CDN 장애 또는 조직 네트워크 정책에 따라 UI가 영향을 받을 수 있습니다.
- 화면 캡처의 개인정보 검토가 완료되지 않았습니다.
- 별도 Flask·PostgreSQL·OCI 버전은 백로그일 뿐 구현되어 있지 않습니다.

## 문서

- [프로젝트 문서 색인](docs/PROJECT_DOCUMENTATION_INDEX.md)
- [아키텍처](docs/ARCHITECTURE.md)
- [운영 가이드](docs/OPERATIONS_GUIDE.md)
- [수동 테스트 체크리스트](docs/MANUAL_TEST_CHECKLIST.md)
- [보안 및 개인정보](docs/SECURITY_AND_PRIVACY.md)
- [로드맵과 백로그](docs/ROADMAP_AND_BACKLOG.md)
- [프로젝트 상태](PROJECT_STATUS.md)
- [프로젝트 작업 원칙](PROJECT_INSTRUCTIONS.md)

## 라이선스

이 저장소에는 라이선스 파일이 없습니다. 별도 허가나 라이선스 확인 없이 코드, 문서와 화면 자산의 사용·수정·재배포 조건을 추정해서는 안 됩니다.
