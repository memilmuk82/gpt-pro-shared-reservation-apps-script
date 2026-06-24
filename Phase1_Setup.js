const PHASE1_CONFIG = Object.freeze({
  SCHOOL_DOMAIN: 'senedu.kr',

  SHEETS: Object.freeze({
    USERS: 'Users',
    RESERVATIONS: 'Reservations',
    USAGE_LOG: 'UsageLog',
    GUIDE_ITEMS: 'GuideItems',
    SETTINGS: 'Settings',
  }),

  HEADERS: Object.freeze({
    Users: [
      'user_id',
      'department',
      'name',
      'extension',
      'email',
      'role',
      'active',
      'is_auth_manager',
      'sort_order',
      'created_at',
      'updated_at',
    ],

    Reservations: [
      'reservation_id',
      'user_id',
      'user_email',
      'user_name',
      'department',
      'work_type',
      'work_title',
      'work_description',
      'start_time',
      'end_time',
      'expected_minutes',
      'status',
      'safety_confirmed',
      'conflict_acknowledged',
      'created_at',
      'updated_at',
      'completed_at',
      'cancelled_at',
      'deleted_at',
      'deleted_by',
    ],

    UsageLog: [
      'log_id',
      'reservation_id',
      'user_id',
      'action_type',
      'action_time',
      'actual_start',
      'actual_end',
      'note',
    ],

    GuideItems: [
      'guide_id',
      'category',
      'title',
      'content',
      'sort_order',
      'active',
    ],

    Settings: [
      'setting_key',
      'setting_value',
      'description',
    ],
  }),

  ROLES: Object.freeze([
    'admin',
    'subadmin',
    'user',
  ]),

  RESERVATION_STATUS: Object.freeze([
    '예약',
    '사용중',
    '완료',
    '취소',
    '삭제됨',
  ]),

  USAGE_ACTIONS: Object.freeze([
    'created',
    'started',
    'completed',
    'cancelled',
    'updated',
    'admin_deleted',
  ]),

  WORK_TYPES: Object.freeze([
    '일반 AI로 해결되지 않는 업무',
    '장시간 추론',
    '복수 문서 종합 분석',
    '코드 검토 및 설계',
    '정책·교육과정 검토',
    '보고서 작성',
    '워크북 개발',
    '교과서 미발행 과목 교재 개발',
    '공개 자료 통합 분석',
    '다수 PDF 종합 분석',
    '교육과정 설계',
    'NCS 능력단위 분석',
    '교육청 승인 문서 작성 지원',
  ]),
});


/**
 * Phase 1 실행 함수
 * 학교 관리자 계정으로 Apps Script 편집기에서 실행한다.
 */
function initializeAndTestPhase1() {
  let response;

  try {
    requireSetupOwner_();

    SETUP_initializeDatabase_();

    const tests = TEST_runPhase1_();

    response = buildPhase1Response_(tests);
  } catch (error) {
    response = {
      ok: false,
      message: 'Phase 1 실행 중 오류가 발생했습니다.',
      data: {
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
        },
        tests: [
          makePhase1TestResult_(
            'PH1-ERROR',
            'Phase 1 실행 오류',
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
 * DB 시트 생성 및 기본 데이터 입력
 */
function SETUP_initializeDatabase_() {
  const lock = LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const ss = getPhase1Database_();

    const sheetNames = Object.values(PHASE1_CONFIG.SHEETS);

    sheetNames.forEach(function(sheetName) {
      ensurePhase1Sheet_(ss, sheetName, PHASE1_CONFIG.HEADERS[sheetName]);
    });

    seedPhase1Settings_(ss);
    seedPhase1GuideItems_(ss);
    seedPhase1OwnerUser_(ss);

    return {
      ok: true,
      message: 'Phase 1 DB 초기화 완료',
    };
  } finally {
    lock.releaseLock();
  }
}


/**
 * 학교 관리자 계정으로만 초기 설정 실행 허용
 *
 * Web App은 관리자 계정 권한으로 실행되지만,
 * setup 단계는 active user와 effective user가 같은 경우만 허용한다.
 */
function requireSetupOwner_() {
  const activeEmail = normalizePhase1Email_(Session.getActiveUser().getEmail());
  const effectiveEmail = normalizePhase1Email_(Session.getEffectiveUser().getEmail());

  if (!activeEmail) {
    throw new Error('접속자 이메일을 확인할 수 없습니다.');
  }

  if (!effectiveEmail) {
    throw new Error('실행 계정 이메일을 확인할 수 없습니다.');
  }

  if (activeEmail !== effectiveEmail) {
    throw new Error(
      'Phase 1 초기화는 학교 관리자 계정으로만 실행해야 합니다. 현재 접속자: ' +
      activeEmail +
      ', 실행 계정: ' +
      effectiveEmail
    );
  }

  if (!activeEmail.endsWith('@' + PHASE1_CONFIG.SCHOOL_DOMAIN)) {
    throw new Error('학교 도메인 계정이 아닙니다: ' + activeEmail);
  }
}


/**
 * Spreadsheet 가져오기
 *
 * 기본은 바인딩된 Google Sheet를 사용한다.
 * 나중에 독립 스크립트로 전환할 경우 Script Properties의 SPREADSHEET_ID를 사용할 수 있다.
 */
function getPhase1Database_() {
  const spreadsheetId = PropertiesService
    .getScriptProperties()
    .getProperty('SPREADSHEET_ID');

  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error('연결된 Google Sheet를 찾을 수 없습니다.');
  }

  return ss;
}


function ensurePhase1Sheet_(ss, sheetName, headers) {
  if (!headers || headers.length === 0) {
    throw new Error('헤더 정의가 없습니다: ' + sheetName);
  }

  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  ensurePhase1Headers_(sheet, headers);

  sheet.setFrozenRows(1);

  return sheet;
}


function ensurePhase1Headers_(sheet, requiredHeaders) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow === 0 || lastColumn === 0) {
    sheet
      .getRange(1, 1, 1, requiredHeaders.length)
      .setValues([requiredHeaders]);

    return;
  }

  const currentHeaders = sheet
    .getRange(1, 1, 1, Math.max(lastColumn, 1))
    .getValues()[0]
    .map(function(value) {
      return String(value || '').trim();
    });

  const nonEmptyHeaders = currentHeaders.filter(function(value) {
    return value !== '';
  });

  if (nonEmptyHeaders.length === 0) {
    sheet
      .getRange(1, 1, 1, requiredHeaders.length)
      .setValues([requiredHeaders]);

    return;
  }

  const missingHeaders = requiredHeaders.filter(function(header) {
    return nonEmptyHeaders.indexOf(header) === -1;
  });

  if (missingHeaders.length > 0) {
    sheet
      .getRange(1, nonEmptyHeaders.length + 1, 1, missingHeaders.length)
      .setValues([missingHeaders]);
  }
}


function seedPhase1Settings_(ss) {
  const sheet = ss.getSheetByName(PHASE1_CONFIG.SHEETS.SETTINGS);

  const rows = [
    {
      setting_key: 'app_title',
      setting_value: 'GPT Pro 공동 사용 지원 시스템',
      description: '앱 제목',
    },
    {
      setting_key: 'organization_name',
      setting_value: '학교 부서',
      description: '학교 또는 부서명. 필요 시 수정',
    },
    {
      setting_key: 'default_duration_minutes',
      setting_value: '60',
      description: '기본 예상 사용 시간',
    },
    {
      setting_key: 'max_duration_minutes',
      setting_value: '180',
      description: '3시간 이상 사용 시 사전 조율 권장',
    },
    {
      setting_key: 'auth_message',
      setting_value: 'GPT Pro 로그인 인증번호가 필요한 경우 담당 관리자에게 요청해 주세요.',
      description: 'GPT 로그인 인증번호 안내 문구',
    },
    {
      setting_key: 'ai_usage_order',
      setting_value: '1. SenGPT\n2. NotebookLM Plus\n3. Gemini Education Plus\n4. GPT Pro 5x',
      description: 'AI 활용 권장 순서',
    },
  ];

  upsertPhase1RowsByKey_(sheet, 'setting_key', rows);
}


function seedPhase1GuideItems_(ss) {
  const sheet = ss.getSheetByName(PHASE1_CONFIG.SHEETS.GUIDE_ITEMS);

  const rows = [
    {
      guide_id: 'GUIDE_APPROPRIATE_001',
      category: '적합',
      title: 'GPT Pro 적합 업무',
      content:
        '일반 AI로 해결되지 않는 업무\n' +
        '장시간 추론\n' +
        '복수 문서 종합 분석\n' +
        '코드 검토 및 설계\n' +
        '정책·교육과정 검토\n' +
        '보고서 작성\n' +
        '워크북 개발\n' +
        '교과서 미발행 과목 교재 개발\n' +
        '공개 자료 통합 분석\n' +
        '다수 PDF 종합 분석\n' +
        '교육과정 설계\n' +
        'NCS 능력단위 분석\n' +
        '교육청 승인 문서 작성 지원',
      sort_order: 10,
      active: true,
    },
    {
      guide_id: 'GUIDE_INAPPROPRIATE_001',
      category: '부적합',
      title: 'GPT Pro 부적합 업무',
      content:
        '단순 질의응답\n' +
        '가정통신문 작성\n' +
        '회의록 작성\n' +
        '문서 요약\n' +
        'PDF 질의응답\n' +
        '나이스 관련 질의\n' +
        '수업 아이디어 생성\n' +
        '교육법 관련 질의\n' +
        '실제 학생 생활기록부 작성\n' +
        '실제 학생 생활기록부 검토\n' +
        '실제 학생 생활기록부 문구 생성',
      sort_order: 20,
      active: true,
    },
    {
      guide_id: 'GUIDE_SENSITIVE_001',
      category: '민감정보',
      title: '개인정보 및 민감정보 안내',
      content:
        '주민등록번호, 연락처, 주소, 계좌번호, 건강정보를 입력하지 않습니다.\n' +
        '학생 식별정보, 학생 개인정보, 상담기록, 진단자료를 입력하지 않습니다.\n' +
        '학부모 식별정보와 학부모 개인정보를 입력하지 않습니다.\n' +
        '교직원 인사정보, 성과급 자료, 근무평정 자료, 인사자료, 급여자료, 징계자료를 입력하지 않습니다.\n' +
        '건강 상담, 보험 상담, 투자 상담, 가족 정보, 자녀 관련 정보는 개인 계정을 사용합니다.',
      sort_order: 30,
      active: true,
    },
    {
      guide_id: 'GUIDE_EVALUATION_001',
      category: '평가보안',
      title: '평가 보안 안내',
      content:
        '중간고사 원안\n' +
        '기말고사 원안\n' +
        '수행평가 문항\n' +
        '정답지\n' +
        '출제 계획\n' +
        '출제 예정 문항\n' +
        '채점 기준\n' +
        '시험은행 문항\n' +
        '문항은행은 공용 GPT 사용에 적합하지 않습니다.',
      sort_order: 40,
      active: true,
    },
    {
      guide_id: 'GUIDE_STUDENT_RECORD_001',
      category: '학생부',
      title: '학생부 관련 안내',
      content:
        '본 시스템에서는 생기부 문구 생성, 평가총평 생성, 상담문구 초안 생성을 수행하지 않습니다.\n' +
        '단, 관련 시스템 설계, 앱 설계, 화면 설계, 데이터 구조 설계, 프롬프트 설계, 보안 설계는 가능합니다.\n' +
        '실제 학생 자료 입력은 허용하지 않습니다.',
      sort_order: 50,
      active: true,
    },
  ];

  upsertPhase1RowsByKey_(sheet, 'guide_id', rows);
}


function seedPhase1OwnerUser_(ss) {
  const sheet = ss.getSheetByName(PHASE1_CONFIG.SHEETS.USERS);

  const effectiveEmail = normalizePhase1Email_(Session.getEffectiveUser().getEmail());

  if (!effectiveEmail) {
    throw new Error('초기 관리자 계정 이메일을 확인할 수 없습니다.');
  }

  const now = new Date();

  const rows = [
    {
      user_id: 'USR_' + Utilities.getUuid(),
      department: '시스템',
      name: '학교 관리자 계정',
      extension: '',
      email: effectiveEmail,
      role: 'admin',
      active: true,
      is_auth_manager: true,
      sort_order: 1,
      created_at: now,
      updated_at: '',
    },
  ];

  upsertPhase1RowsByKey_(sheet, 'email', rows);
}


function upsertPhase1RowsByKey_(sheet, keyColumn, rows) {
  const headers = getPhase1Headers_(sheet);
  const keyIndex = headers.indexOf(keyColumn);

  if (keyIndex === -1) {
    throw new Error('키 컬럼을 찾을 수 없습니다: ' + keyColumn);
  }

  const existingKeys = {};
  const lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    const values = sheet
      .getRange(2, 1, lastRow - 1, headers.length)
      .getValues();

    values.forEach(function(row) {
      const key = String(row[keyIndex] || '').trim();

      if (key) {
        existingKeys[key] = true;
      }
    });
  }

  rows.forEach(function(rowObject) {
    const key = String(rowObject[keyColumn] || '').trim();

    if (!key) {
      return;
    }

    if (existingKeys[key]) {
      return;
    }

    appendPhase1ObjectRow_(sheet, headers, rowObject);
  });
}


function appendPhase1ObjectRow_(sheet, headers, rowObject) {
  const values = headers.map(function(header) {
    return rowObject[header] !== undefined ? rowObject[header] : '';
  });

  sheet.appendRow(values);
}


function getPhase1Headers_(sheet) {
  const lastColumn = sheet.getLastColumn();

  if (lastColumn === 0) {
    return [];
  }

  return sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(function(value) {
      return String(value || '').trim();
    });
}


function normalizePhase1Email_(email) {
  return String(email || '').trim().toLowerCase();
}


/**
 * Phase 1 테스트 실행
 */
function TEST_runPhase1_() {
  const tests = [];

  tests.push(TEST_phase1RequiredSheets_());
  tests.push(TEST_phase1Headers_('Users'));
  tests.push(TEST_phase1Headers_('Reservations'));
  tests.push(TEST_phase1Headers_('UsageLog'));
  tests.push(TEST_phase1Headers_('GuideItems'));
  tests.push(TEST_phase1Headers_('Settings'));
  tests.push(TEST_phase1SettingsSeed_());
  tests.push(TEST_phase1GuideItemsSeed_());
  tests.push(TEST_phase1OwnerUserSeed_());

  return tests;
}


function TEST_phase1RequiredSheets_() {
  return safePhase1Test_('SHEET-01', '필수 시트 존재 확인', function() {
    const ss = getPhase1Database_();

    const requiredSheetNames = Object.values(PHASE1_CONFIG.SHEETS);

    const missing = requiredSheetNames.filter(function(sheetName) {
      return !ss.getSheetByName(sheetName);
    });

    return makePhase1TestResult_(
      'SHEET-01',
      '필수 시트 존재 확인',
      missing.length === 0,
      requiredSheetNames.join(', '),
      missing.length === 0 ? '모든 필수 시트 존재' : '누락: ' + missing.join(', '),
      missing.length === 0 ? '필수 시트 확인 성공' : '필수 시트 누락'
    );
  });
}


function TEST_phase1Headers_(sheetName) {
  return safePhase1Test_('SHEET-HEADER-' + sheetName, sheetName + ' 헤더 확인', function() {
    const ss = getPhase1Database_();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return makePhase1TestResult_(
        'SHEET-HEADER-' + sheetName,
        sheetName + ' 헤더 확인',
        false,
        '시트 존재 및 필수 헤더 포함',
        '시트 없음',
        sheetName + ' 시트를 찾을 수 없습니다.'
      );
    }

    const headers = getPhase1Headers_(sheet);
    const requiredHeaders = PHASE1_CONFIG.HEADERS[sheetName];

    const missing = requiredHeaders.filter(function(header) {
      return headers.indexOf(header) === -1;
    });

    return makePhase1TestResult_(
      'SHEET-HEADER-' + sheetName,
      sheetName + ' 헤더 확인',
      missing.length === 0,
      requiredHeaders.join(', '),
      missing.length === 0 ? '모든 필수 헤더 존재' : '누락: ' + missing.join(', '),
      missing.length === 0 ? sheetName + ' 헤더 확인 성공' : sheetName + ' 헤더 누락'
    );
  });
}


function TEST_phase1SettingsSeed_() {
  return safePhase1Test_('SEED-SETTINGS', 'Settings 기본값 확인', function() {
    const ss = getPhase1Database_();
    const sheet = ss.getSheetByName(PHASE1_CONFIG.SHEETS.SETTINGS);

    const rowCount = Math.max(sheet.getLastRow() - 1, 0);

    return makePhase1TestResult_(
      'SEED-SETTINGS',
      'Settings 기본값 확인',
      rowCount >= 1,
      '기본 설정값 1개 이상',
      rowCount + '개',
      rowCount >= 1 ? 'Settings 기본값 확인 성공' : 'Settings 기본값이 없습니다.'
    );
  });
}


function TEST_phase1GuideItemsSeed_() {
  return safePhase1Test_('SEED-GUIDES', 'GuideItems 기본값 확인', function() {
    const ss = getPhase1Database_();
    const sheet = ss.getSheetByName(PHASE1_CONFIG.SHEETS.GUIDE_ITEMS);

    const rowCount = Math.max(sheet.getLastRow() - 1, 0);

    return makePhase1TestResult_(
      'SEED-GUIDES',
      'GuideItems 기본값 확인',
      rowCount >= 5,
      '안내 항목 5개 이상',
      rowCount + '개',
      rowCount >= 5 ? 'GuideItems 기본값 확인 성공' : 'GuideItems 기본값이 부족합니다.'
    );
  });
}


function TEST_phase1OwnerUserSeed_() {
  return safePhase1Test_('SEED-OWNER-USER', '초기 관리자 계정 확인', function() {
    const ss = getPhase1Database_();
    const sheet = ss.getSheetByName(PHASE1_CONFIG.SHEETS.USERS);

    const headers = getPhase1Headers_(sheet);
    const emailIndex = headers.indexOf('email');
    const roleIndex = headers.indexOf('role');

    if (emailIndex === -1 || roleIndex === -1) {
      return makePhase1TestResult_(
        'SEED-OWNER-USER',
        '초기 관리자 계정 확인',
        false,
        'email, role 헤더 존재',
        '헤더 누락',
        'Users 시트에 email 또는 role 헤더가 없습니다.'
      );
    }

    const effectiveEmail = normalizePhase1Email_(Session.getEffectiveUser().getEmail());

    const rows = sheet.getLastRow() >= 2
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
      : [];

    const found = rows.some(function(row) {
      const email = normalizePhase1Email_(row[emailIndex]);
      const role = String(row[roleIndex] || '').trim();

      return email === effectiveEmail && role === 'admin';
    });

    return makePhase1TestResult_(
      'SEED-OWNER-USER',
      '초기 관리자 계정 확인',
      found,
      effectiveEmail + ' / role=admin',
      found ? '초기 관리자 존재' : '초기 관리자 없음',
      found ? '초기 관리자 계정 확인 성공' : '초기 관리자 계정을 찾을 수 없습니다.'
    );
  });
}


function safePhase1Test_(code, name, callback) {
  try {
    return callback();
  } catch (error) {
    return makePhase1TestResult_(
      code,
      name,
      false,
      '정상 실행',
      error.message,
      error.message
    );
  }
}


function makePhase1TestResult_(code, name, passed, expected, actual, message) {
  return {
    code: code,
    name: name,
    passed: passed,
    expected: expected,
    actual: actual,
    message: message,
  };
}


function buildPhase1Response_(tests) {
  const passed = tests.filter(function(test) {
    return test.passed;
  }).length;

  const failed = tests.length - passed;

  return {
    ok: failed === 0,
    message: failed === 0
      ? 'Phase 1 테스트를 모두 통과했습니다.'
      : 'Phase 1 테스트 중 실패 항목이 있습니다.',
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