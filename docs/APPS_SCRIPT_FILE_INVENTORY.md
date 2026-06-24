# APPS_SCRIPT_FILE_INVENTORY.md

## Apps Script 편집기 파일 목록

이미지 기준 현재 Apps Script 프로젝트에 있는 파일은 다음과 같다.

### 업로드 대상

```text
Code.gs
Index.html
Phase1_Setup.gs
Phase2_UserAuth.gs
Phase3_Reservations.gs
Phase4_AppData.gs
Phase5_StatsAndTests.gs
Styles.html
Phase7_RegistrationRequests.gs
Client_State.html
Client_Utils.html
Client_Icons.html
Client_Components.html
Client_Views.html
Client_Handlers.html
Client_App.html
Phase9_SettingsManagement.gs
Phase9_GuideItemsManagement.gs
```

### 삭제/미업로드 대상

```text
Client_Backup.html
```

## GitHub 업로드 전 확인

- Apps Script 편집기에서 최신 코드 저장
- `TEST_runAll` 73 PASS / 0 FAIL 확인
- `Client_Backup.html` 삭제
- 실제 사용자 데이터 제거
- 문서 파일 추가
- 예시 CSV는 샘플 데이터만 포함

## Apps Script include 주의

`Client_*.html` 파일에는 내부 `<script>` 태그가 포함되어 있다.

따라서 `Index.html`에서 include할 때 다시 `<script>`로 감싸지 않는다.
