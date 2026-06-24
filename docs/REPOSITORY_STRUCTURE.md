# REPOSITORY_STRUCTURE.md

## 권장 저장소 구조

```text
gpt-pro-reservation-system/
├─ README.md
├─ PROJECT_STATUS.md
├─ PROJECT_INSTRUCTIONS.md
├─ DEVELOPMENT_LOG.md
├─ .gitignore
├─ appsscript.json
├─ Code.gs
├─ Phase1_Setup.gs
├─ Phase2_UserAuth.gs
├─ Phase3_Reservations.gs
├─ Phase4_AppData.gs
├─ Phase5_StatsAndTests.gs
├─ Phase7_RegistrationRequests.gs
├─ Phase9_SettingsManagement.gs
├─ Phase9_GuideItemsManagement.gs
├─ Index.html
├─ Styles.html
├─ Client_State.html
├─ Client_Utils.html
├─ Client_Icons.html
├─ Client_Components.html
├─ Client_Views.html
├─ Client_Handlers.html
├─ Client_App.html
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ OPERATIONS_GUIDE.md
│  ├─ GITHUB_UPLOAD_GUIDE.md
│  ├─ MANUAL_TEST_CHECKLIST.md
│  ├─ ROADMAP_AND_BACKLOG.md
│  ├─ SECURITY_AND_PRIVACY.md
│  ├─ REPOSITORY_STRUCTURE.md
│  ├─ APPS_SCRIPT_FILE_INVENTORY.md
│  └─ HANDOFF_PROMPT.md
└─ templates/
   └─ 일괄등록.csv
```

## 삭제 확정 파일

```text
Client_Backup.html
```

삭제 이유:

```text
리팩토링 전 백업 파일이며 현재 include하지 않는다.
Phase 13 이후 안정화와 TEST_runAll 73 PASS 확인으로 유지 필요가 사라졌다.
Git 커밋 히스토리와 문서로 보존하고 파일 자체는 삭제한다.
```

## 공개 저장소에서 제외할 파일

```text
.clasp.json
.env
.env.*
credentials*.json
client_secret*.json
token.json
실제 운영 CSV
실제 시트 export
로그 파일
개인정보 포함 파일
```
