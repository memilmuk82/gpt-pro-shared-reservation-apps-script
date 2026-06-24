/**
 * Phase 9-A - 설정 관리 백엔드 / 테스트
 *
 * 전제:
 * - Phase1_Setup.gs 적용 완료
 * - Phase2_UserAuth.gs 적용 완료
 * - Phase3_Reservations.gs 적용 완료
 * - Phase4_AppData.gs 적용 완료
 * - Phase5_StatsAndTests.gs 적용 완료
 * - Phase7_RegistrationRequests.gs 적용 완료
 */

const PHASE9_CONFIG = Object.freeze({
  SETTINGS_LOG_SHEET_NAME: 'SettingsLog',

  SETTINGS_LOG_HEADERS: [
    'log_id',
    'setting_key',
    'old_value',
    'new_value',
    'changed_by',
    'changed_at',
    'note',
  ],

  DEFAULT_SETTINGS: [
    {
      setting_key: 'board_reference_message',
      setting_value: 'GPT 접속 링크, 공용 계정, 비밀번호는 업무게시판의 안내글을 참고해 주세요.',
      description: 'GPT 접속 정보 업무게시판 참고 안내',
    },
    {
      setting_key: 'logout_notice',
      setting_value: '사용 후 반드시 GPT에서 로그아웃해 주세요. 브라우저를 닫는 것만으로는 로그아웃되지 않을 수 있습니다.',
      description: 'GPT 사용 후 로그아웃 안내',
    },
  ],

  EDITABLE_SETTINGS: [
    {
      key: 'app_title',
      label: '앱 제목',
      type: 'text',
      required: true,
      maxLength: 100,
    },
    {
      key: 'organization_name',
      label: '학교/부서명',
      type: 'text',
      required: true,
      maxLength: 100,
    },
    {
      key: 'auth_message',
      label: '인증번호 안내 문구',
      type: 'text',
      required: true,
      maxLength: 300,
    },
    {
      key: 'board_reference_message',
      label: '업무게시판 참고 안내',
      type: 'text',
      required: true,
      maxLength: 300,
    },
    {
      key: 'logout_notice',
      label: '로그아웃 안내 문구',
      type: 'text',
      required: true,
      maxLength: 300,
    },
    {
      key: 'ai_usage_order',
      label: 'AI 활용 권장 순서',
      type: 'multiline',
      required: true,
      maxLength: 1000,
    },
    {
      key: 'default_duration_minutes',
      label: '기본 사용 시간',
      type: 'integer',
      required: true,
      min: 30,
      max: 480,
    },
    {
      key: 'max_duration_minutes',
      label: '장시간 사용 안내 기준',
      type: 'integer',
      required: true,
      min: 30,
      max: 720,
    },
  ],
});


/**
 * Phase 9 초기화 + 테스트
 * 관리자 계정으로 Apps Script 편집기에서 실행
 */
function initializeAndTestPhase9() {
  let response;

  try {
    SETUP_initializePhase9_();
    response = TEST_runPhase9();
  } catch (error) {
    response = {
      ok: false,
      message: 'Phase 9 실행 중 오류가 발생했습니다.',
      data: {
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
        },
        tests: [
          makePhase9TestResult_(
            'P9-ERROR',
            'Phase 9 실행 오류',
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
 * Phase 9 시트 및 기본 설정 초기화
 */
function SETUP_initializePhase9_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = getPhase1Database_();

    ensurePhase1Sheet_(
      ss,
      PHASE9_CONFIG.SETTINGS_LOG_SHEET_NAME,
      PHASE9_CONFIG.SETTINGS_LOG_HEADERS
    );

    const settingsSheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.SETTINGS);

    upsertPhase1RowsByKey_(
      settingsSheet,
      'setting_key',
      PHASE9_CONFIG.DEFAULT_SETTINGS
    );

    return phase9Ok_(null, 'Phase 9 초기화 완료');
  } finally {
    lock.releaseLock();
  }
}


/**
 * 관리자 설정 조회
 * 프론트 관리자 설정 화면에서 사용할 함수
 */
function getAdminSettings() {
  try {
    SETUP_initializePhase9_();
    requirePhase2Admin_();

    const settings = getPhase9EditableSettings_();

    return phase9Ok_(settings, '관리자 설정 조회 성공');
  } catch (error) {
    return phase9Fail_(error.message);
  }
}


/**
 * 관리자 설정 단일 수정
 *
 * settingKey:
 * - PHASE9_CONFIG.EDITABLE_SETTINGS에 정의된 key만 허용
 *
 * settingValue:
 * - text / multiline / integer 검증 후 저장
 *
 * options:
 * - 테스트에서만 { __test: true } 사용
 */
function adminUpdateSetting(settingKey, settingValue, options) {
  try {
    SETUP_initializePhase9_();

    const admin = requirePhase2Admin_();

    const key = String(settingKey || '').trim();
    const meta = getPhase9EditableSettingMeta_(key);

    if (!meta) {
      return phase9Fail_('수정할 수 없는 설정입니다: ' + key);
    }

    const cleanValue = validatePhase9SettingValue_(meta, settingValue);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      let row = findPhase9SettingByKey_(key);

      if (!row) {
        appendPhase9SettingRow_(key, cleanValue, meta.label);
        row = findPhase9SettingByKey_(key);
      }

      const oldValue = String(row.setting_value || '');

      if (oldValue === cleanValue) {
        return phase9Ok_(
          {
            setting_key: key,
            setting_value: cleanValue,
            changed: false,
          },
          '설정값이 변경되지 않았습니다.'
        );
      }

      const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.SETTINGS);
      const headers = getPhase2Headers_(sheet);

      updatePhase2RowByNumber_(sheet, headers, row._rowNumber, {
        setting_value: cleanValue,
      });

      appendPhase9SettingsLog_({
        setting_key: key,
        old_value: oldValue,
        new_value: cleanValue,
        changed_by: admin.email,
        note: options && options.__test === true ? 'TEST_PHASE9' : '설정 수정',
        is_test: options && options.__test === true,
      });

      return phase9Ok_(
        {
          setting_key: key,
          setting_value: cleanValue,
          changed: true,
        },
        '설정 수정 완료'
      );
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase9Fail_(error.message);
  }
}


/**
 * 관리자 설정 다중 수정
 * 프론트에서 여러 설정을 한 번에 저장할 때 사용 가능
 */
function adminUpdateSettings(payload) {
  try {
    const items = Array.isArray(payload)
      ? payload
      : [];

    if (items.length === 0) {
      return phase9Fail_(
        '수정할 설정이 없습니다.'
      );
    }

    const validations = [];

    // 1단계
    // 전부 검증

    items.forEach(function(item) {
      const key = String(
        item.setting_key || ''
      ).trim();

      const meta =
        getPhase9EditableSettingMeta_(key);

      if (!meta) {
        validations.push({
          ok: false,
          setting_key: key,
          message:
            '수정할 수 없는 설정입니다: ' +
            key,
        });

        return;
      }

      try {
        validatePhase9SettingValue_(
          meta,
          item.setting_value
        );

        validations.push({
          ok: true,
          setting_key: key,
        });
      } catch (error) {
        validations.push({
          ok: false,
          setting_key: key,
          message: error.message,
        });
      }
    });

    const failed =
      validations.filter(function(item) {
        return item.ok !== true;
      });

    if (failed.length > 0) {
      return phase9Fail_(
        '일부 설정 수정에 실패했습니다.',
        {
          results: failed,
        }
      );
    }

    // 2단계
    // 전부 통과했을 때만 저장

    const results = [];

    items.forEach(function(item) {
      const result =
        adminUpdateSetting(
          item.setting_key,
          item.setting_value
        );

      results.push(result);
    });

    return phase9Ok_(
      results,
      '설정 일괄 수정 완료'
    );
  } catch (error) {
    return phase9Fail_(
      error.message
    );
  }
}


function getPhase9EditableSettings_() {
  const settingsMap = getPhase4SettingsMap_();

  return PHASE9_CONFIG.EDITABLE_SETTINGS.map(function(meta) {
    return {
      setting_key: meta.key,
      label: meta.label,
      type: meta.type,
      required: meta.required === true,
      min: meta.min !== undefined ? meta.min : '',
      max: meta.max !== undefined ? meta.max : '',
      maxLength: meta.maxLength || '',
      setting_value: settingsMap[meta.key] !== undefined ? String(settingsMap[meta.key]) : '',
      description: getPhase9SettingDescription_(meta.key),
    };
  });
}


function getPhase9SettingDescription_(settingKey) {
  const row = findPhase9SettingByKey_(settingKey);

  if (!row) {
    return '';
  }

  return String(row.description || '');
}


function getPhase9EditableSettingMeta_(settingKey) {
  const key = String(settingKey || '').trim();

  return PHASE9_CONFIG.EDITABLE_SETTINGS.filter(function(meta) {
    return meta.key === key;
  })[0] || null;
}


function validatePhase9SettingValue_(meta, value) {
  let text = String(value === undefined || value === null ? '' : value).trim();

  if (meta.required === true && !text) {
    throw new Error(meta.label + '은(는) 비워둘 수 없습니다.');
  }

  if (meta.maxLength && text.length > meta.maxLength) {
    throw new Error(
      meta.label +
      '은(는) ' +
      meta.maxLength +
      '자 이하로 입력해 주세요.'
    );
  }

  if (meta.type === 'integer') {
    const numberValue = Number(text);

    if (!Number.isInteger(numberValue)) {
      throw new Error(meta.label + '은(는) 정수로 입력해 주세요.');
    }

    if (meta.min !== undefined && numberValue < meta.min) {
      throw new Error(meta.label + '은(는) ' + meta.min + ' 이상이어야 합니다.');
    }

    if (meta.max !== undefined && numberValue > meta.max) {
      throw new Error(meta.label + '은(는) ' + meta.max + ' 이하이어야 합니다.');
    }

    text = String(numberValue);
  }

  return text;
}


function findPhase9SettingByKey_(settingKey) {
  const key = String(settingKey || '').trim();

  if (!key) {
    return null;
  }

  const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.SETTINGS);
  const headers = getPhase2Headers_(sheet);

  if (sheet.getLastRow() < 2) {
    return null;
  }

  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
    .getValues();

  for (let i = 0; i < values.length; i++) {
    const row = {};
    headers.forEach(function(header, columnIndex) {
      row[header] = values[i][columnIndex];
    });

    row._rowNumber = i + 2;

    if (String(row.setting_key || '').trim() === key) {
      return row;
    }
  }

  return null;
}


function appendPhase9SettingRow_(settingKey, settingValue, description) {
  const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.SETTINGS);
  const headers = getPhase2Headers_(sheet);

  appendPhase2ObjectRow_(sheet, headers, {
    setting_key: settingKey,
    setting_value: settingValue,
    description: description || '',
  });
}


function appendPhase9SettingsLog_(payload) {
  const sheet = getPhase2Sheet_(PHASE9_CONFIG.SETTINGS_LOG_SHEET_NAME);
  const headers = getPhase2Headers_(sheet);

  appendPhase2ObjectRow_(sheet, headers, {
    log_id: makePhase9Id_('SETLOG_', payload.is_test === true),
    setting_key: payload.setting_key,
    old_value: payload.old_value,
    new_value: payload.new_value,
    changed_by: payload.changed_by,
    changed_at: new Date(),
    note: payload.note || '',
  });
}


function getPhase9SettingsLogs_() {
  const sheet = getPhase2Sheet_(PHASE9_CONFIG.SETTINGS_LOG_SHEET_NAME);
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


function makePhase9Id_(prefix, isTest) {
  return (isTest ? 'TEST_' : '') + prefix + Utilities.getUuid();
}


function phase9Ok_(data, message) {
  return {
    ok: true,
    data: data,
    message: message || '',
  };
}


function phase9Fail_(message, detail) {
  return {
    ok: false,
    data: detail || null,
    message: message || '오류가 발생했습니다.',
  };
}


/**
 * Phase 9 테스트 실행
 */
function TEST_runPhase9() {
  const tests = [];

  try {
    SETUP_initializePhase9_();

    TEST_resetPhase9Data_();

    tests.push(TEST_phase9SettingsLogHeaders_());
    tests.push(TEST_phase9GetAdminSettings_());
    tests.push(TEST_phase9UpdateAllowedSetting_());
    tests.push(TEST_phase9RejectUnknownSettingKey_());
    tests.push(TEST_phase9RejectBlankRequiredSetting_());
    tests.push(TEST_phase9RejectInvalidIntegerSetting_());
    tests.push(TEST_phase9SettingsLog_());
  } catch (error) {
    tests.push(makePhase9TestResult_(
      'P9-ERROR',
      'Phase 9 테스트 실행 오류',
      false,
      '정상 실행',
      error.message,
      error.message
    ));
  } finally {
    TEST_resetPhase9Data_();
  }

  const response = buildPhase9TestResponse_(tests);

  Logger.log(JSON.stringify(response, null, 2));

  return response;
}


function TEST_phase9SettingsLogHeaders_() {
  return safePhase9Test_('P9-SHEET-01', 'SettingsLog 헤더 확인', function() {
    const sheet = getPhase2Sheet_(PHASE9_CONFIG.SETTINGS_LOG_SHEET_NAME);
    const headers = getPhase2Headers_(sheet);

    const missing = PHASE9_CONFIG.SETTINGS_LOG_HEADERS.filter(function(header) {
      return headers.indexOf(header) === -1;
    });

    const passed = missing.length === 0;

    return makePhase9TestResult_(
      'P9-SHEET-01',
      'SettingsLog 헤더 확인',
      passed,
      PHASE9_CONFIG.SETTINGS_LOG_HEADERS.join(', '),
      passed ? '모든 필수 헤더 존재' : '누락: ' + missing.join(', '),
      passed ? 'SettingsLog 헤더 확인 성공' : 'SettingsLog 헤더 확인 실패'
    );
  });
}


function TEST_phase9GetAdminSettings_() {
  return safePhase9Test_('P9-SET-01', '관리자 설정 조회', function() {
    const result = getAdminSettings();

    const keys = result.ok
      ? result.data.map(function(item) {
          return item.setting_key;
        })
      : [];

    const requiredKeys = PHASE9_CONFIG.EDITABLE_SETTINGS.map(function(meta) {
      return meta.key;
    });

    const missing = requiredKeys.filter(function(key) {
      return keys.indexOf(key) === -1;
    });

    const passed = result.ok && missing.length === 0;

    return makePhase9TestResult_(
      'P9-SET-01',
      '관리자 설정 조회',
      passed,
      '편집 가능 설정 전체 조회',
      passed ? '모든 편집 가능 설정 조회' : '누락: ' + missing.join(', '),
      passed ? '관리자 설정 조회 성공' : '관리자 설정 조회 실패'
    );
  });
}


function TEST_phase9UpdateAllowedSetting_() {
  return safePhase9Test_('P9-SET-02', '허용된 설정 수정', function() {
    const key = 'board_reference_message';
    const original = String(findPhase9SettingByKey_(key).setting_value || '');
    const next = 'TEST_PHASE9_BOARD_' + Utilities.getUuid();

    const updated = adminUpdateSetting(key, next, { __test: true });
    const current = findPhase9SettingByKey_(key);

    const restored = adminUpdateSetting(key, original, { __test: true });

    const passed =
      updated.ok === true &&
      current &&
      String(current.setting_value || '') === next &&
      restored.ok === true;

    return makePhase9TestResult_(
      'P9-SET-02',
      '허용된 설정 수정',
      passed,
      '허용된 setting_key 수정 성공',
      updated.message,
      passed ? '허용된 설정 수정 성공' : '허용된 설정 수정 실패'
    );
  });
}


function TEST_phase9RejectUnknownSettingKey_() {
  return safePhase9Test_('P9-SET-03', '허용되지 않은 설정 거부', function() {
    const result = adminUpdateSetting(
      'gpt_password',
      '절대 저장하면 안 되는 값',
      { __test: true }
    );

    const passed = result.ok === false;

    return makePhase9TestResult_(
      'P9-SET-03',
      '허용되지 않은 설정 거부',
      passed,
      'gpt_password 저장 실패',
      result.message,
      passed ? '허용되지 않은 setting_key 거부 성공' : '허용되지 않은 setting_key 거부 실패'
    );
  });
}


function TEST_phase9RejectBlankRequiredSetting_() {
  return safePhase9Test_('P9-SET-04', '필수 설정 빈 값 거부', function() {
    const result = adminUpdateSetting(
      'app_title',
      '',
      { __test: true }
    );

    const passed = result.ok === false;

    return makePhase9TestResult_(
      'P9-SET-04',
      '필수 설정 빈 값 거부',
      passed,
      '빈 app_title 저장 실패',
      result.message,
      passed ? '필수 설정 빈 값 거부 성공' : '필수 설정 빈 값 거부 실패'
    );
  });
}


function TEST_phase9RejectInvalidIntegerSetting_() {
  return safePhase9Test_('P9-SET-05', '숫자 설정값 검증', function() {
    const result = adminUpdateSetting(
      'default_duration_minutes',
      '10',
      { __test: true }
    );

    const passed = result.ok === false;

    return makePhase9TestResult_(
      'P9-SET-05',
      '숫자 설정값 검증',
      passed,
      '30분 미만 저장 실패',
      result.message,
      passed ? '숫자 설정값 검증 성공' : '숫자 설정값 검증 실패'
    );
  });
}


function TEST_phase9SettingsLog_() {
  return safePhase9Test_('P9-LOG-01', '설정 변경 로그 기록', function() {
    const key = 'logout_notice';
    const original = String(findPhase9SettingByKey_(key).setting_value || '');
    const next = 'TEST_PHASE9_LOGOUT_' + Utilities.getUuid();

    const beforeLogs = getPhase9SettingsLogs_().length;

    const updated = adminUpdateSetting(key, next, { __test: true });
    const afterLogs = getPhase9SettingsLogs_();

    const logFound = afterLogs.some(function(log) {
      return String(log.log_id || '').indexOf('TEST_SETLOG_') === 0 &&
        String(log.setting_key || '') === key &&
        String(log.old_value || '') === original &&
        String(log.new_value || '') === next;
    });

    const restored = adminUpdateSetting(key, original, { __test: true });

    const passed =
      updated.ok === true &&
      afterLogs.length > beforeLogs &&
      logFound &&
      restored.ok === true;

    return makePhase9TestResult_(
      'P9-LOG-01',
      '설정 변경 로그 기록',
      passed,
      'old/new value 로그 기록',
      'logFound=' + logFound,
      passed ? '설정 변경 로그 기록 성공' : '설정 변경 로그 기록 실패'
    );
  });
}


function TEST_resetPhase9Data_() {
  TEST_deletePhase9SettingsLogs_();
}


function TEST_deletePhase9SettingsLogs_() {
  let sheet;

  try {
    sheet = getPhase2Sheet_(PHASE9_CONFIG.SETTINGS_LOG_SHEET_NAME);
  } catch (error) {
    return;
  }

  const headers = getPhase2Headers_(sheet);
  const logIdIndex = headers.indexOf('log_id');
  const noteIndex = headers.indexOf('note');

  if (logIdIndex === -1) {
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
    const logId = String(values[i][logIdIndex] || '').trim();
    const note = noteIndex >= 0 ? String(values[i][noteIndex] || '').trim() : '';

    if (logId.indexOf('TEST_SETLOG_') === 0 || note === 'TEST_PHASE9') {
      sheet.deleteRow(i + 2);
    }
  }
}


function safePhase9Test_(code, name, callback) {
  try {
    return callback();
  } catch (error) {
    return makePhase9TestResult_(
      code,
      name,
      false,
      '정상 실행',
      error.message,
      error.message
    );
  }
}


function makePhase9TestResult_(code, name, passed, expected, actual, message) {
  return {
    code: code,
    name: name,
    passed: passed === true,
    expected: expected,
    actual: actual,
    message: message,
  };
}


function buildPhase9TestResponse_(tests) {
  const passed = tests.filter(function(test) {
    return test.passed === true;
  }).length;

  const failed = tests.length - passed;

  return {
    ok: failed === 0,
    message: failed === 0
      ? 'Phase 9 테스트를 모두 통과했습니다.'
      : 'Phase 9 테스트 중 실패 항목이 있습니다.',
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