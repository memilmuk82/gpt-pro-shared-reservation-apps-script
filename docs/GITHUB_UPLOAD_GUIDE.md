# GITHUB_UPLOAD_GUIDE.md

## 목적

Apps Script 프로젝트 파일과 문서를 GitHub에 보존하기 위한 절차를 정리한다.

## 결론

가장 안전한 방법은 `clasp`로 Apps Script 프로젝트를 로컬로 내려받은 뒤 GitHub에 push하는 방식이다.

수동 업로드도 가능하지만, 파일 수가 많아지면 누락 위험이 있으므로 장기적으로는 `clasp` 방식을 권장한다.

---

## 업로드 대상 파일

Apps Script 편집기 기준 업로드 대상:

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

삭제/미업로드:

```text
Client_Backup.html
```

문서 업로드 대상:

```text
README.md
PROJECT_STATUS.md
DEVELOPMENT_LOG.md
PROJECT_INSTRUCTIONS.md
docs/*.md
templates/일괄등록.csv
```

업로드 금지:

```text
실제 교직원 데이터 CSV
시트 export 원본
토큰 파일
인증 파일
.clasp.json 공개 저장소 업로드
GPT 계정 ID/PW
```

---

## 방법 A: GitHub 웹 화면에서 수동 업로드

1. GitHub에서 새 저장소를 만든다.
2. 저장소를 private으로 만들지 public으로 만들지 결정한다.
3. 저장소 메인 화면에서 Add file → Upload files를 선택한다.
4. Apps Script 편집기의 각 파일 내용을 로컬 파일로 저장한다.
5. `Client_Backup.html`은 제외한다.
6. 문서 파일과 함께 업로드한다.
7. 커밋 메시지를 작성한다.

권장 커밋 메시지:

```text
Initial archive of Apps Script GPT reservation system
```

장점:

```text
설치가 필요 없다.
한 번만 보존할 때 쉽다.
```

단점:

```text
파일 누락 위험이 있다.
Apps Script와 GitHub 동기화가 자동이 아니다.
반복 관리에 불리하다.
```

---

## 방법 B: clasp 사용 권장

### 1. 설치

```bash
npm install -g @google/clasp
```

### 2. 로그인

```bash
clasp login
```

### 3. 기존 Apps Script 프로젝트 내려받기

Apps Script 프로젝트의 Script ID를 확인한 뒤 실행한다.

```bash
mkdir gpt-pro-reservation-system
cd gpt-pro-reservation-system
clasp clone <SCRIPT_ID>
```

### 4. 백업 파일 삭제

```bash
rm Client_Backup.html
```

Windows PowerShell:

```powershell
Remove-Item Client_Backup.html
```

### 5. 문서 파일 추가

```text
README.md
PROJECT_STATUS.md
DEVELOPMENT_LOG.md
PROJECT_INSTRUCTIONS.md
docs/*.md
templates/일괄등록.csv
```

### 6. Git 초기화

```bash
git init
git add .
git commit -m "Archive stable Apps Script GPT reservation system"
```

### 7. GitHub 원격 저장소 연결

```bash
git branch -M main
git remote add origin https://github.com/<OWNER>/<REPO>.git
git push -u origin main
```

---

## 방법 C: GitHub CLI 사용

```bash
gh auth login
gh repo create gpt-pro-reservation-system --private --source=. --remote=origin --push
```

운영 코드와 학교 업무 데이터가 들어갈 가능성이 있으면 private 저장소를 권장한다.

---

## 공개 저장소 주의사항

공개 저장소로 올릴 경우 반드시 확인한다.

```text
1. GPT 계정 ID/PW 없음
2. 실제 사용자 이메일/이름/부서/내선번호 없음
3. .clasp.json 없음
4. OAuth credential 없음
5. 실제 Google Sheet ID 없음
6. 운영 URL 없음
7. 테스트 데이터만 포함
```

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
└─ templates/
```
