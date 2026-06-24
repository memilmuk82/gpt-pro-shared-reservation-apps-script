/**
 * Phase 7-A - 등록 요청 / 사용자 승인 백엔드
 *
 * 전제:
 * - Phase1_Setup.gs 적용 완료
 * - Phase2_UserAuth.gs 적용 완료
 * - Phase3_Reservations.gs 적용 완료
 * - Phase4_AppData.gs 적용 완료
 * - Phase5_StatsAndTests.gs 적용 완료
 */

const PHASE7_CONFIG = Object.freeze({
  SHEET_NAME: 'RegistrationRequests',

  HEADERS: [
    'request_id',
    'email',
    'name',
    'department',
    'extension',
    'status',
    'created_at',
    'processed_at',
    'processed_by',
    'note',
  ],

  STATUS: Object.freeze({
    PENDING: '대기',
    APPROVED: '승인',
    REJECTED: '반려',
  }),
});


/**
 * Phase 7 초기화 + 테스트
 * 관리자 계정으로 Apps Script 편집기에서 실행
 */
function initializeAndTestPhase7() {
  let response;

  try {
    SETUP_initializePhase7_();
    response = TEST_runPhase7();
  } catch (error) {
    response = {
      ok: false,
      message: 'Phase 7 실행 중 오류가 발생했습니다.',
      data: {
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
        },
        tests: [
          makePhase7TestResult_(
            'P7-ERROR',
            'Phase 7 실행 오류',
            false,
            '정상 실행',
            error.message,
            error.message
          ),
        ],
      },
    };
  }

  Logger.log(JSON.stringify(response, null, 2));
  return response;
}


/**
 * RegistrationRequests 시트 생성
 */
function SETUP_initializePhase7_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = getPhase1Database_();
    ensurePhase1Sheet_(ss, PHASE7_CONFIG.SHEET_NAME, PHASE7_CONFIG.HEADERS);

    return phase7Ok_(null, 'Phase 7 시트 초기화 완료');
  } finally {
    lock.releaseLock();
  }
}


/**
 * 프론트 초기 데이터 v2
 * 기존 getInitialData()에 myRegistrationRequest를 추가한다.
 */
function getInitialDataV2() {
  const response = getInitialData();

  if (!response || !response.ok || !response.data) {
    return response;
  }

  const email = response.data.currentUser && response.data.currentUser.email
    ? response.data.currentUser.email
    : '';

  response.data.myRegistrationRequest = email
    ? getPhase7LatestRequestByEmail_(email)
    : null;

  return response;
}


/**
 * 미등록 사용자 등록 요청
 *
 * 일반 사용자는 이메일을 직접 입력하지 않는다.
 * 접속한 Google 계정을 기준으로 요청한다.
 *
 * 테스트에서만 __testEmail 사용 가능.
 */
function createRegistrationRequest(payload) {
  try {
    SETUP_initializePhase7_();

    const data = payload || {};
    const email = getPhase7RequestEmail_(data);

    const cleanPayload = validatePhase7RegistrationPayload_(data, email);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const existingUser = findPhase2UserByEmail_(cleanPayload.email);

      if (existingUser) {
        if (toPhase2Boolean_(existingUser.active)) {
          return phase7Fail_('이미 등록된 사용자입니다.');
        }

        return phase7Fail_('비활성화된 사용자입니다. 관리자에게 문의해 주세요.');
      }

      const pendingRequest = findPhase7PendingRequestByEmail_(cleanPayload.email);

      if (pendingRequest) {
        return phase7Fail_('이미 처리 대기 중인 등록 요청이 있습니다.');
      }

      const sheet = getPhase7Sheet_();
      const headers = getPhase2Headers_(sheet);
      const now = new Date();

      const request = {
        request_id: makePhase7Id_('REQ_', data.__test === true),
        email: cleanPayload.email,
        name: cleanPayload.name,
        department: cleanPayload.department,
        extension: cleanPayload.extension,
        status: PHASE7_CONFIG.STATUS.PENDING,
        created_at: now,
        processed_at: '',
        processed_by: '',
        note: '',
      };

      appendPhase2ObjectRow_(sheet, headers, request);

      return phase7Ok_(
        sanitizePhase7Request_(request),
        '등록 요청이 접수되었습니다.'
      );
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase7Fail_(error.message);
  }
}


/**
 * 내 최근 등록 요청 조회
 */
function getMyRegistrationRequest() {
  try {
    SETUP_initializePhase7_();

    const email = getPhase2ActiveEmail_();

    if (!email) {
      return phase7Fail_('접속자 이메일을 확인할 수 없습니다.');
    }

    return phase7Ok_(
      getPhase7LatestRequestByEmail_(email),
      '내 등록 요청 조회 성공'
    );
  } catch (error) {
    return phase7Fail_(error.message);
  }
}


/**
 * 관리자: 등록 요청 목록 조회
 */
function adminGetRegistrationRequests() {
  try {
    SETUP_initializePhase7_();
    requirePhase2Admin_();

    const requests = getPhase7Requests_()
      .map(sanitizePhase7Request_)
      .sort(sortPhase7Requests_);

    return phase7Ok_(requests, '등록 요청 목록 조회 성공');
  } catch (error) {
    return phase7Fail_(error.message);
  }
}


/**
 * 관리자: 등록 요청 승인
 */
function adminApproveRegistrationRequest(requestId) {
  try {
    SETUP_initializePhase7_();

    const admin = requirePhase2Admin_();

    if (!requestId) {
      return phase7Fail_('request_id가 필요합니다.');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const request = findPhase7RequestById_(requestId);

      if (!request) {
        return phase7Fail_('등록 요청을 찾을 수 없습니다.');
      }

      if (String(request.status || '').trim() !== PHASE7_CONFIG.STATUS.PENDING) {
        return phase7Fail_('대기 상태의 요청만 승인할 수 있습니다.');
      }

      const existingUser = findPhase2UserByEmail_(request.email);

      if (existingUser) {
        return phase7Fail_('이미 등록된 사용자 이메일입니다: ' + request.email);
      }

      const usersSheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.USERS);
      const userHeaders = getPhase2Headers_(usersSheet);
      const now = new Date();

      const user = {
        user_id: makePhase7Id_('USR_', String(request.request_id || '').indexOf('TEST_REQ_') === 0),
        department: String(request.department || '').trim(),
        name: String(request.name || '').trim(),
        extension: String(request.extension || '').trim(),
        email: normalizePhase2Email_(request.email),
        role: 'user',
        active: true,
        is_auth_manager: false,
        sort_order: '',
        created_at: now,
        updated_at: '',
      };

      appendPhase2ObjectRow_(usersSheet, userHeaders, user);

      updatePhase7Request_(request, {
        status: PHASE7_CONFIG.STATUS.APPROVED,
        processed_at: now,
        processed_by: admin.email,
        note: '승인',
      });

      return phase7Ok_(
        {
          request: sanitizePhase7Request_(findPhase7RequestById_(requestId)),
          user: sanitizePhase2User_(user),
        },
        '등록 요청 승인 완료'
      );
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase7Fail_(error.message);
  }
}


/**
 * 관리자: 등록 요청 반려
 */
function adminRejectRegistrationRequest(requestId, note) {
  try {
    SETUP_initializePhase7_();

    const admin = requirePhase2Admin_();

    if (!requestId) {
      return phase7Fail_('request_id가 필요합니다.');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const request = findPhase7RequestById_(requestId);

      if (!request) {
        return phase7Fail_('등록 요청을 찾을 수 없습니다.');
      }

      if (String(request.status || '').trim() !== PHASE7_CONFIG.STATUS.PENDING) {
        return phase7Fail_('대기 상태의 요청만 반려할 수 있습니다.');
      }

      const now = new Date();

      updatePhase7Request_(request, {
        status: PHASE7_CONFIG.STATUS.REJECTED,
        processed_at: now,
        processed_by: admin.email,
        note: String(note || '반려').trim(),
      });

      return phase7Ok_(
        sanitizePhase7Request_(findPhase7RequestById_(requestId)),
        '등록 요청 반려 완료'
      );
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase7Fail_(error.message);
  }
}


function getPhase7RequestEmail_(payload) {
  const data = payload || {};

  if (data.__test === true) {
    requirePhase2Admin_();

    const testEmail = normalizePhase2Email_(data.__testEmail);

    if (!testEmail) {
      throw new Error('테스트 이메일이 필요합니다.');
    }

    return testEmail;
  }

  return getPhase2ActiveEmail_();
}


function validatePhase7RegistrationPayload_(payload, email) {
  const data = payload || {};

  const cleanEmail = normalizePhase2Email_(email);
  const name = String(data.name || '').trim();
  const department = String(data.department || '').trim();
  const extension = String(data.extension || '').trim();

  if (!cleanEmail) {
    throw new Error('접속자 이메일을 확인할 수 없습니다.');
  }

  if (!isPhase2SchoolEmail_(cleanEmail)) {
    throw new Error('학교 도메인 계정만 등록 요청할 수 있습니다: ' + cleanEmail);
  }

  if (!name) {
    throw new Error('이름을 입력해 주세요.');
  }

  if (!department) {
    throw new Error('부서를 입력해 주세요.');
  }

  return {
    email: cleanEmail,
    name: name,
    department: department,
    extension: extension,
  };
}


function getPhase7Sheet_() {
  const ss = getPhase1Database_();
  const sheet = ss.getSheetByName(PHASE7_CONFIG.SHEET_NAME);

  if (!sheet) {
    throw new Error('RegistrationRequests 시트를 찾을 수 없습니다.');
  }

  return sheet;
}


function getPhase7Requests_() {
  const sheet = getPhase7Sheet_();
  const headers = getPhase2Headers_(sheet);

  if (sheet.getLastRow() < 2) {
    return [];
  }

  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
    .getValues();

  return values.map(function(row, index) {
    const object = {};

    headers.forEach(function(header, columnIndex) {
      object[header] = row[columnIndex];
    });

    object._rowNumber = index + 2;

    return object;
  });
}


function findPhase7RequestById_(requestId) {
  const targetId = String(requestId || '').trim();

  if (!targetId) {
    return null;
  }

  const requests = getPhase7Requests_();

  for (let i = 0; i < requests.length; i++) {
    if (String(requests[i].request_id || '').trim() === targetId) {
      return requests[i];
    }
  }

  return null;
}


function findPhase7PendingRequestByEmail_(email) {
  const targetEmail = normalizePhase2Email_(email);

  if (!targetEmail) {
    return null;
  }

  const requests = getPhase7Requests_();

  return requests
    .filter(function(request) {
      return normalizePhase2Email_(request.email) === targetEmail &&
        String(request.status || '').trim() === PHASE7_CONFIG.STATUS.PENDING;
    })
    .sort(sortPhase7Requests_)[0] || null;
}


function getPhase7LatestRequestByEmail_(email) {
  const targetEmail = normalizePhase2Email_(email);

  if (!targetEmail) {
    return null;
  }

  const requests = getPhase7Requests_()
    .filter(function(request) {
      return normalizePhase2Email_(request.email) === targetEmail;
    })
    .sort(function(a, b) {
      return toPhase3Date_(b.created_at).getTime() -
        toPhase3Date_(a.created_at).getTime();
    });

  return requests.length > 0
    ? sanitizePhase7Request_(requests[0])
    : null;
}


function updatePhase7Request_(request, patch) {
  const sheet = getPhase7Sheet_();
  const headers = getPhase2Headers_(sheet);

  updatePhase2RowByNumber_(sheet, headers, request._rowNumber, patch);
}


function sanitizePhase7Request_(request) {
  if (!request) {
    return null;
  }

  return {
    request_id: String(request.request_id || '').trim(),
    email: normalizePhase2Email_(request.email),
    name: String(request.name || '').trim(),
    department: String(request.department || '').trim(),
    extension: String(request.extension || '').trim(),
    status: String(request.status || '').trim(),
    created_at: formatPhase3Date_(request.created_at),
    processed_at: formatPhase3Date_(request.processed_at),
    processed_by: normalizePhase2Email_(request.processed_by),
    note: String(request.note || '').trim(),
  };
}


function sortPhase7Requests_(a, b) {
  const statusA = String(a.status || '').trim();
  const statusB = String(b.status || '').trim();

  const statusOrder = {};
  statusOrder[PHASE7_CONFIG.STATUS.PENDING] = 1;
  statusOrder[PHASE7_CONFIG.STATUS.APPROVED] = 2;
  statusOrder[PHASE7_CONFIG.STATUS.REJECTED] = 3;

  const orderA = statusOrder[statusA] || 99;
  const orderB = statusOrder[statusB] || 99;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return toPhase3Date_(b.created_at).getTime() -
    toPhase3Date_(a.created_at).getTime();
}


function makePhase7Id_(prefix, isTest) {
  return (isTest ? 'TEST_' : '') + prefix + Utilities.getUuid();
}


function phase7Ok_(data, message) {
  return {
    ok: true,
    data: data,
    message: message || '',
  };
}


function phase7Fail_(message, detail) {
  return {
    ok: false,
    data: detail || null,
    message: message || '오류가 발생했습니다.',
  };
}


/**
 * Phase 7 테스트 실행
 */
function TEST_runPhase7() {
  const tests = [];

  try {
    SETUP_initializePhase7_();

    TEST_resetPhase7Data_();

    tests.push(TEST_phase7SheetHeaders_());
    tests.push(TEST_phase7CreateRequest_());
    tests.push(TEST_phase7DuplicatePendingRequest_());
    tests.push(TEST_phase7InvalidDomain_());
    tests.push(TEST_phase7ExistingUserCannotRequest_());
    tests.push(TEST_phase7AdminGetRequests_());
    tests.push(TEST_phase7ApproveRequest_());
    tests.push(TEST_phase7RejectRequest_());
    tests.push(TEST_phase7MyLatestRequest_());
  } catch (error) {
    tests.push(makePhase7TestResult_(
      'P7-ERROR',
      'Phase 7 테스트 실행 오류',
      false,
      '정상 실행',
      error.message,
      error.message
    ));
  } finally {
    TEST_resetPhase7Data_();
  }

  const response = buildPhase7TestResponse_(tests);

  Logger.log(JSON.stringify(response, null, 2));

  return response;
}


function TEST_phase7SheetHeaders_() {
  return safePhase7Test_('P7-SHEET-01', 'RegistrationRequests 헤더 확인', function() {
    const sheet = getPhase7Sheet_();
    const headers = getPhase2Headers_(sheet);

    const missing = PHASE7_CONFIG.HEADERS.filter(function(header) {
      return headers.indexOf(header) === -1;
    });

    const passed = missing.length === 0;

    return makePhase7TestResult_(
      'P7-SHEET-01',
      'RegistrationRequests 헤더 확인',
      passed,
      PHASE7_CONFIG.HEADERS.join(', '),
      passed ? '모든 필수 헤더 존재' : '누락: ' + missing.join(', '),
      passed ? '헤더 확인 성공' : '헤더 확인 실패'
    );
  });
}


function TEST_phase7CreateRequest_() {
  return safePhase7Test_('P7-REQ-01', '등록 요청 생성', function() {
    const result = createRegistrationRequest({
      __test: true,
      __testEmail: 'test.phase7.request@senedu.kr',
      name: '요청자',
      department: '테스트부',
      extension: '7001',
    });

    const passed = result.ok &&
      result.data &&
      result.data.status === PHASE7_CONFIG.STATUS.PENDING;

    return makePhase7TestResult_(
      'P7-REQ-01',
      '등록 요청 생성',
      passed,
      'status=대기',
      result.message,
      passed ? '등록 요청 생성 성공' : '등록 요청 생성 실패'
    );
  });
}


function TEST_phase7DuplicatePendingRequest_() {
  return safePhase7Test_('P7-REQ-02', '중복 대기 요청 방지', function() {
    const payload = {
      __test: true,
      __testEmail: 'test.phase7.duplicate@senedu.kr',
      name: '중복요청자',
      department: '테스트부',
      extension: '7002',
    };

    const first = createRegistrationRequest(payload);
    const second = createRegistrationRequest(payload);

    const passed = first.ok === true && second.ok === false;

    return makePhase7TestResult_(
      'P7-REQ-02',
      '중복 대기 요청 방지',
      passed,
      '첫 번째 성공, 두 번째 실패',
      'first=' + first.ok + ', second=' + second.ok + ', message=' + second.message,
      passed ? '중복 요청 방지 성공' : '중복 요청 방지 실패'
    );
  });
}


function TEST_phase7InvalidDomain_() {
  return safePhase7Test_('P7-REQ-03', '외부 도메인 요청 방지', function() {
    const result = createRegistrationRequest({
      __test: true,
      __testEmail: 'outsider@example.com',
      name: '외부인',
      department: '테스트부',
      extension: '7003',
    });

    const passed = result.ok === false;

    return makePhase7TestResult_(
      'P7-REQ-03',
      '외부 도메인 요청 방지',
      passed,
      '요청 실패',
      result.message,
      passed ? '외부 도메인 요청 방지 성공' : '외부 도메인 요청 방지 실패'
    );
  });
}


function TEST_phase7ExistingUserCannotRequest_() {
  return safePhase7Test_('P7-REQ-04', '기존 사용자 요청 방지', function() {
    const user = adminCreateUser({
      __test: true,
      department: '테스트부',
      name: '기존사용자',
      extension: '7004',
      email: 'test.phase7.existing@senedu.kr',
      role: 'user',
      active: true,
    });

    const request = createRegistrationRequest({
      __test: true,
      __testEmail: 'test.phase7.existing@senedu.kr',
      name: '기존사용자',
      department: '테스트부',
      extension: '7004',
    });

    const passed = user.ok === true && request.ok === false;

    return makePhase7TestResult_(
      'P7-REQ-04',
      '기존 사용자 요청 방지',
      passed,
      '이미 등록된 사용자는 요청 실패',
      request.message,
      passed ? '기존 사용자 요청 방지 성공' : '기존 사용자 요청 방지 실패'
    );
  });
}


function TEST_phase7AdminGetRequests_() {
  return safePhase7Test_('P7-ADMIN-01', '관리자 요청 목록 조회', function() {
    createRegistrationRequest({
      __test: true,
      __testEmail: 'test.phase7.list@senedu.kr',
      name: '목록요청자',
      department: '테스트부',
      extension: '7005',
    });

    const result = adminGetRegistrationRequests();

    const found = result.ok && result.data.some(function(request) {
      return request.email === 'test.phase7.list@senedu.kr';
    });

    return makePhase7TestResult_(
      'P7-ADMIN-01',
      '관리자 요청 목록 조회',
      found,
      '요청 목록에 테스트 요청 포함',
      result.message,
      found ? '요청 목록 조회 성공' : '요청 목록 조회 실패'
    );
  });
}


function TEST_phase7ApproveRequest_() {
  return safePhase7Test_('P7-APPROVE-01', '등록 요청 승인', function() {
    const created = createRegistrationRequest({
      __test: true,
      __testEmail: 'test.phase7.approve@senedu.kr',
      name: '승인대상',
      department: '승인부',
      extension: '7006',
    });

    if (!created.ok) {
      return makePhase7TestResult_(
        'P7-APPROVE-01',
        '등록 요청 승인',
        false,
        '요청 생성',
        created.message,
        '요청 생성 실패'
      );
    }

    const approved = adminApproveRegistrationRequest(created.data.request_id);
    const user = findPhase2UserByEmail_('test.phase7.approve@senedu.kr');

    const passed = approved.ok &&
      approved.data &&
      approved.data.request &&
      approved.data.request.status === PHASE7_CONFIG.STATUS.APPROVED &&
      user &&
      String(user.name || '').trim() === '승인대상';

    return makePhase7TestResult_(
      'P7-APPROVE-01',
      '등록 요청 승인',
      passed,
      '요청 status=승인, Users 등록',
      approved.message,
      passed ? '등록 요청 승인 성공' : '등록 요청 승인 실패'
    );
  });
}


function TEST_phase7RejectRequest_() {
  return safePhase7Test_('P7-REJECT-01', '등록 요청 반려', function() {
    const created = createRegistrationRequest({
      __test: true,
      __testEmail: 'test.phase7.reject@senedu.kr',
      name: '반려대상',
      department: '반려부',
      extension: '7007',
    });

    if (!created.ok) {
      return makePhase7TestResult_(
        'P7-REJECT-01',
        '등록 요청 반려',
        false,
        '요청 생성',
        created.message,
        '요청 생성 실패'
      );
    }

    const rejected = adminRejectRegistrationRequest(created.data.request_id, '테스트 반려');
    const latest = getPhase7LatestRequestByEmail_('test.phase7.reject@senedu.kr');

    const passed = rejected.ok &&
      latest &&
      latest.status === PHASE7_CONFIG.STATUS.REJECTED &&
      latest.note === '테스트 반려';

    return makePhase7TestResult_(
      'P7-REJECT-01',
      '등록 요청 반려',
      passed,
      '요청 status=반려',
      rejected.message,
      passed ? '등록 요청 반려 성공' : '등록 요청 반려 실패'
    );
  });
}


function TEST_phase7MyLatestRequest_() {
  return safePhase7Test_('P7-MYREQ-01', '최근 등록 요청 조회', function() {
    const created = createRegistrationRequest({
      __test: true,
      __testEmail: 'test.phase7.latest@senedu.kr',
      name: '최근요청자',
      department: '테스트부',
      extension: '7008',
    });

    const latest = getPhase7LatestRequestByEmail_('test.phase7.latest@senedu.kr');

    const passed = created.ok &&
      latest &&
      latest.request_id === created.data.request_id;

    return makePhase7TestResult_(
      'P7-MYREQ-01',
      '최근 등록 요청 조회',
      passed,
      '가장 최근 요청 반환',
      latest ? latest.request_id : '(없음)',
      passed ? '최근 등록 요청 조회 성공' : '최근 등록 요청 조회 실패'
    );
  });
}


function TEST_resetPhase7Data_() {
  TEST_deletePhase7Requests_();
  TEST_deletePhase7Users_();
}


function TEST_deletePhase7Requests_() {
  let sheet;

  try {
    sheet = getPhase7Sheet_();
  } catch (error) {
    return;
  }

  const headers = getPhase2Headers_(sheet);
  const requestIdIndex = headers.indexOf('request_id');
  const emailIndex = headers.indexOf('email');

  if (requestIdIndex === -1 || emailIndex === -1) {
    return;
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, headers.length)
    .getValues();

  for (let i = values.length - 1; i >= 0; i--) {
    const requestId = String(values[i][requestIdIndex] || '').trim();
    const email = normalizePhase2Email_(values[i][emailIndex]);

    if (requestId.indexOf('TEST_REQ_') === 0 || email.indexOf('test.phase7.') === 0) {
      sheet.deleteRow(i + 2);
    }
  }
}


function TEST_deletePhase7Users_() {
  const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.USERS);
  const headers = getPhase2Headers_(sheet);

  const userIdIndex = headers.indexOf('user_id');
  const emailIndex = headers.indexOf('email');

  if (userIdIndex === -1 || emailIndex === -1) {
    return;
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, headers.length)
    .getValues();

  for (let i = values.length - 1; i >= 0; i--) {
    const userId = String(values[i][userIdIndex] || '').trim();
    const email = normalizePhase2Email_(values[i][emailIndex]);

    if (userId.indexOf('TEST_USR_') === 0 || email.indexOf('test.phase7.') === 0) {
      sheet.deleteRow(i + 2);
    }
  }
}


function safePhase7Test_(code, name, callback) {
  try {
    return callback();
  } catch (error) {
    return makePhase7TestResult_(
      code,
      name,
      false,
      '정상 실행',
      error.message,
      error.message
    );
  }
}


function makePhase7TestResult_(code, name, passed, expected, actual, message) {
  return {
    code: code,
    name: name,
    passed: passed === true,
    expected: expected,
    actual: actual,
    message: message,
  };
}


function buildPhase7TestResponse_(tests) {
  const passed = tests.filter(function(test) {
    return test.passed === true;
  }).length;

  const failed = tests.length - passed;

  return {
    ok: failed === 0,
    message: failed === 0
      ? 'Phase 7 테스트를 모두 통과했습니다.'
      : 'Phase 7 테스트 중 실패 항목이 있습니다.',
    data: {
      summary: {
        total: tests.length,
        passed: passed,
        failed: failed,
      },
      tests: tests,
    },
  };
}