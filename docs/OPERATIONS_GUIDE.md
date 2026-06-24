# OPERATIONS_GUIDE.md

## 운영자 기본 작업

### 사용자 관리

관리자 화면에서 다음 작업을 수행할 수 있다.

```text
사용자 목록 조회
사용자 추가
사용자 수정
사용자 활성화/비활성화
권한 변경
인증번호 담당자 지정
CSV 일괄 등록
```

### CSV 일괄 등록 운영 절차

1. 스프레드시트와 같은 Google Drive 폴더에 있는 `일괄등록.csv`를 복사하거나 다운로드한다.
2. CSV를 편집한다.
3. 관리자 화면에서 사용자 관리로 이동한다.
4. CSV 파일을 선택한다.
5. 미리보기를 확인한다.
6. 검증 후 일괄 등록을 실행한다.
7. 실패 행이 있으면 메시지를 확인하고 CSV를 수정한다.
8. 등록 성공 후 사용자 목록이 갱신되는지 확인한다.

### CSV 컬럼

```text
email,name,department,extension,role,active,is_auth_manager,sort_order
```

### CSV 값 규칙

```text
email: 필수, senedu.kr 도메인
name: 필수
department: 필수
extension: 선택
role: 빈 값이면 user, 허용값 admin/subadmin/user
active: 빈 값이면 true, 허용값 true/false, 1/0, yes/no, y/n, 예/아니오, 활성/비활성
is_auth_manager: 빈 값이면 false, active와 같은 boolean 허용값
sort_order: 빈 값 또는 0 이상의 정수
```

### 예시 CSV

```csv
email,name,department,extension,role,active,is_auth_manager,sort_order
sample.user1@senedu.kr,홍길동,정보과,1234,user,true,false,10
sample.subadmin1@senedu.kr,김보조,교육연구부,1235,subadmin,true,true,20
sample.inactive1@senedu.kr,이비활성,교무부,1236,user,false,false,30
```

## 사용 종료 안내

사용자는 공용 PC에서 작업을 마친 뒤 다음을 직접 확인해야 한다.

```text
1. GPT에서 로그아웃
2. Google 계정 로그아웃 확인
3. 예약 시스템 사용 종료 버튼 클릭
4. 화면 잠금 상태 확인
```

앱의 화면 잠금은 Google 계정 또는 GPT 계정 자체 로그아웃이 아니다.

## 관리자 주의사항

- 최소 1명의 활성 admin을 유지한다.
- GPT 계정 ID/PW를 Settings나 GuideItems에 저장하지 않는다.
- 사용자 CSV에 외부 도메인 계정을 넣지 않는다.
- 실제 교직원 데이터가 들어간 CSV를 GitHub에 올리지 않는다.
