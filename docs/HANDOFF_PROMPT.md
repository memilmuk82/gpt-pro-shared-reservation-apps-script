# HANDOFF_PROMPT.md

## 새 대화창 인수인계 요약

이 프로젝트는 GPT Pro 공동 사용 지원 시스템이다.

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

## 반드시 확인할 문서

```text
1. PROJECT_INSTRUCTIONS.md
2. PROJECT_STATUS.md
3. DEVELOPMENT_LOG.md
4. docs/ROADMAP_AND_BACKLOG.md
```

## 현재 해야 할 일

```text
1. PROJECT_STATUS.md 최신화 반영
2. DEVELOPMENT_LOG.md 최신화 반영
3. Client_Backup.html 삭제
4. GitHub 저장소 구성
5. 일괄등록.csv를 스프레드시트와 같은 Drive 폴더에 수동 배치
```

## 구현하지 않는 기능

Apps Script 운영 버전에서는 다음을 구현하지 않는다.

```text
예시 CSV 자동 생성
예시 CSV 다운로드 버튼
Drive 파일 URL 자동 연결
상대 경로 CSV 다운로드
```

이 기능은 Flask + PostgreSQL + OCI 버전 백로그로 이관한다.

## 주의사항

- GPT 계정 ID/PW 저장 금지
- 승인 없는 시트 헤더 변경 금지
- 승인 없는 정책 변경 금지
- 네임스페이스 리팩토링 금지
- Client include 순서 유지
- Client 파일을 Index에서 다시 script 태그로 감싸지 않음
- 서버 검증 우선
- 테스트 통과 전 다음 작업 진행 금지
