# GPT Pro 공동 사용 지원 시스템

학교 부서에서 공동으로 사용하는 GPT Pro 계정을 안전하게 예약·관리하기 위한 Google Apps Script 기반 내부 업무용 웹앱입니다.

## 현재 운영 버전 기준

```text
기준일: 2026-06-23
운영 버전: Google Apps Script + Google Sheets + HTMLService
현재 상태: Phase 13-A / Phase 13-B 완료
전체 테스트: TEST_runAll 73 PASS / 0 FAIL
```

## 핵심 기능

- 공용 GPT Pro 사용 시간 예약
- 현재 사용 중인 사용자 확인
- 예약 충돌 확인 및 조율 확인 후 저장
- 사용 시작 / 사용 완료 / 예약 취소
- 미등록 사용자 등록 요청 및 관리자 승인·반려
- 사용자 권한 관리
- 사용자 CSV 일괄 등록
- Settings 관리
- GuideItems 안내 문구 관리
- 공용 PC 화면 잠금 및 사용 종료 안내

## 기술 스택

```text
Frontend: Vanilla JavaScript, Tailwind CSS, Google Apps Script HTMLService
Backend: Google Apps Script
Database: Google Sheets
Authentication: Google Workspace 계정, senedu.kr 도메인 기준
```

## 보안 원칙

- GPT 계정 ID/PW는 앱에 저장하지 않습니다.
- GPT 접속 정보는 학교 업무게시판에서 별도 관리합니다.
- 예약 시스템은 업무게시판 참고 안내만 표시합니다.
- 사용자 등록은 `senedu.kr` 도메인만 허용합니다.
- 관리자 기능은 서버에서 권한 검증을 수행합니다.
- CSV 일괄 등록은 서버 최종 검증과 all-or-nothing 저장을 적용합니다.
- GuideItems와 Settings 출력값은 화면 출력 시 escape 처리합니다.

## GitHub 업로드 시 주의

- `Client_Backup.html`은 삭제 확정 파일이므로 업로드하지 않습니다.
- 실제 교직원 개인정보가 들어간 CSV, 시트 export, 로그 파일은 업로드하지 않습니다.
- `.clasp.json`, 인증 파일, 토큰 파일은 공개 저장소에 올리지 않습니다.
- 예시 CSV는 `templates/일괄등록.csv`처럼 샘플 데이터만 포함합니다.

## 문서

```text
PROJECT_STATUS.md                  현재 상태와 다음 작업 기준
DEVELOPMENT_LOG.md                 개발 과정과 의사결정 기록
docs/ARCHITECTURE.md               구조 설명
docs/OPERATIONS_GUIDE.md           운영자 사용 안내
docs/GITHUB_UPLOAD_GUIDE.md        GitHub 업로드 절차
docs/MANUAL_TEST_CHECKLIST.md      수동/서버 테스트 체크리스트
docs/ROADMAP_AND_BACKLOG.md        선택·보류·차기 버전 작업 목록
docs/SECURITY_AND_PRIVACY.md       보안/개인정보 원칙
docs/REPOSITORY_STRUCTURE.md       GitHub 저장소 구조 제안
docs/APPS_SCRIPT_FILE_INVENTORY.md Apps Script 파일 목록
docs/HANDOFF_PROMPT.md             새 대화창 인수인계 문서
```
