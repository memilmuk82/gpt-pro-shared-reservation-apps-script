# MANUAL_TEST_CHECKLIST.md

## 서버 테스트

### 전체 테스트

```text
TEST_runAll
기대 결과: 전체 73, PASS 73, FAIL 0
```

### CSV 일괄 등록 테스트

```text
TEST_runPhase13UserBulkCreate
기대 결과: PASS 8, FAIL 0
```

## 관리자 화면 수동 테스트

### 사용자 관리

- 사용자 목록 조회 가능
- 사용자 추가 가능
- 사용자 수정 가능
- 사용자 비활성화 가능
- 사용자 활성화 가능
- 마지막 활성 admin 비활성화 방지
- 마지막 활성 admin 권한 변경 방지

### CSV 일괄 등록

정상 CSV:

```csv
email,name,department,extension,role,active,is_auth_manager,sort_order
test.bulk.ui1@senedu.kr,홍길동,정보과,1234,user,true,false,10
```

오류 CSV:

```csv
email,name,department,extension,role,active,is_auth_manager,sort_order
test.bulk.ui2@example.com,외부계정,정보과,1234,user,true,false,11
```

확인 항목:

- 정상 CSV 미리보기 표시
- 정상 CSV 등록 성공
- 등록 후 사용자 목록 갱신
- 오류 CSV 서버 검증 실패
- 실패 행 메시지 표시
- 오류 CSV 실패 시 어떤 사용자도 저장되지 않음

### 등록 요청

- 미등록 사용자가 등록 요청 가능
- 외부 도메인 요청 방지
- 중복 대기 요청 방지
- 관리자 승인 가능
- 관리자 반려 가능

### 예약

- 예약 생성 가능
- 즉시 사용 시작 가능
- 충돌 확인 가능
- 충돌 미확인 저장 방지
- 예약 취소 가능
- 사용 시작 가능
- 사용 완료 가능
- 완료 예약 재시작 방지

### Settings

- 설정 목록 조회 가능
- 변경된 항목만 저장
- 잘못된 숫자 설정 저장 실패
- 실패 시 all-or-nothing 유지
- 성공 시 화면 반영

### GuideItems

- 관리자 목록 조회 가능
- active=false 항목도 관리자 화면 표시
- 사용자 안내 화면에는 active=true만 표시
- HTML 문자열은 실행되지 않고 텍스트로 표시
- 일괄 저장 all-or-nothing 확인

### 공용 PC 안전장치

- 사용 종료 버튼 표시
- 사용 종료 Modal 표시
- 수동 화면 잠금 가능
- 30분 미사용 자동 화면 잠금 가능
- 잠금 화면에서 다시 접속 가능
- GPT/Google 로그아웃 안내 표시
