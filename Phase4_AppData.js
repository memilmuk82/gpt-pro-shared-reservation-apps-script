/**
 * Phase 4 - 앱 초기 데이터 / 안내 데이터 / 대시보드 데이터
 *
 * 전제:
 * - Phase1_Setup.gs 적용 완료
 * - Phase2_UserAuth.gs 적용 완료
 * - Phase3_Reservations.gs 적용 완료
 */


/**
 * 프론트 최초 로딩용 통합 데이터
 */
function getInitialData() {
  try {
    const currentUserResponse = getCurrentUser();
    const currentUserData = currentUserResponse.data || {
      registered: false,
      active: false,
      email: '',
      user: null,
      reason: 'UNKNOWN',
    };

    const baseData = {
      currentUser: currentUserData,
      settings: getPhase4SettingsMap_(),
      guides: getPhase4GuideItems_(),
      authManagers: getPhase4AuthManagers_(),
      workTypes: PHASE1_CONFIG.WORK_TYPES,
      now: formatPhase3Date_(new Date()),
      isAdmin: Boolean(
        currentUserData &&
        currentUserData.user &&
        isPhase2AdminRole_(currentUserData.user.role)
      ),
    };

    if (!currentUserData.active) {
      baseData.currentReservation = null;
      baseData.nextReservation = null;
      baseData.todayReservations = [];
      baseData.myReservations = [];
      baseData.activeUsers = [];

      return phase4Ok_(baseData, currentUserResponse.message || '사용자 확인 완료');
    }

    const currentReservationResponse = getCurrentReservation();
    const nextReservationResponse = getNextReservation();
    const todayReservationsResponse = getReservationsByDate(new Date());
    const myReservationsResponse = getMyReservations();
    const activeUsersResponse = getActiveUsers();

    baseData.currentReservation = currentReservationResponse.ok
      ? currentReservationResponse.data
      : null;

    baseData.nextReservation = nextReservationResponse.ok
      ? nextReservationResponse.data
      : null;

    baseData.todayReservations = todayReservationsResponse.ok
      ? todayReservationsResponse.data
      : [];

    baseData.myReservations = myReservationsResponse.ok
      ? myReservationsResponse.data
      : [];

    baseData.activeUsers = activeUsersResponse.ok
      ? activeUsersResponse.data.users
      : [];

    return phase4Ok_(baseData, '초기 데이터 조회 성공');
  } catch (error) {
    return phase4Fail_(error.message);
  }
}


/**
 * Settings 조회
 */
function getSettings() {
  try {
    requirePhase2ActiveUser_();

    return phase4Ok_(getPhase4SettingsMap_(), '설정 조회 성공');
  } catch (error) {
    return phase4Fail_(error.message);
  }
}


/**
 * GuideItems 조회
 */
function getGuideItems() {
  try {
    const currentUserResponse = getCurrentUser();

    if (!currentUserResponse.ok) {
      return phase4Fail_(currentUserResponse.message);
    }

    return phase4Ok_(getPhase4GuideItems_(), '안내 항목 조회 성공');
  } catch (error) {
    return phase4Fail_(error.message);
  }
}


/**
 * 인증번호 담당자 조회
 */
function getAuthManagers() {
  try {
    const currentUserResponse = getCurrentUser();

    if (!currentUserResponse.ok) {
      return phase4Fail_(currentUserResponse.message);
    }

    return phase4Ok_(getPhase4AuthManagers_(), '인증번호 담당자 조회 성공');
  } catch (error) {
    return phase4Fail_(error.message);
  }
}


/**
 * 다음 예약 조회
 */
function getNextReservation() {
  try {
    requirePhase2ActiveUser_();

    const now = new Date();

    const nextReservation = getPhase3Reservations_()
      .filter(function(reservation) {
        return reservation.status === '예약';
      })
      .filter(function(reservation) {
        return toPhase3Date_(reservation.start_time).getTime() >= now.getTime();
      })
      .sort(sortPhase3ByStartTime_)[0] || null;

    return phase4Ok_(
      nextReservation ? sanitizePhase3Reservation_(nextReservation) : null,
      nextReservation ? '다음 예약 조회 성공' : '다음 예약이 없습니다.'
    );
  } catch (error) {
    return phase4Fail_(error.message);
  }
}


/**
 * 특정 날짜 예약 조회
 * dateValue는 Date 객체 또는 YYYY-MM-DD 문자열을 허용한다.
 */
function getReservationsByDate(dateValue) {
  try {
    requirePhase2ActiveUser_();

    const baseDate = parsePhase4DateInput_(dateValue || new Date());
    const range = getPhase4DayRange_(baseDate);

    const reservations = getPhase3Reservations_()
      .filter(function(reservation) {
        return reservation.status !== '삭제됨';
      })
      .filter(function(reservation) {
        const startTime = toPhase3Date_(reservation.start_time).getTime();

        return startTime >= range.start.getTime() &&
          startTime < range.end.getTime();
      })
      .sort(sortPhase3ByStartTime_)
      .map(sanitizePhase3Reservation_);

    return phase4Ok_(reservations, '날짜별 예약 조회 성공');
  } catch (error) {
    return phase4Fail_(error.message);
  }
}


/**
 * Settings 내부 조회
 */
function getPhase4SettingsMap_() {
  const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.SETTINGS);
  const headers = getPhase2Headers_(sheet);

  const keyIndex = headers.indexOf('setting_key');
  const valueIndex = headers.indexOf('setting_value');

  if (keyIndex === -1 || valueIndex === -1) {
    throw new Error('Settings 시트의 헤더가 올바르지 않습니다.');
  }

  if (sheet.getLastRow() < 2) {
    return {};
  }

  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
    .getValues();

  const settings = {};

  values.forEach(function(row) {
    const key = String(row[keyIndex] || '').trim();

    if (!key) {
      return;
    }

    settings[key] = String(row[valueIndex] || '');
  });

  return settings;
}


/**
 * GuideItems 내부 조회
 */
function getPhase4GuideItems_() {
  const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.GUIDE_ITEMS);
  const headers = getPhase2Headers_(sheet);

  if (sheet.getLastRow() < 2) {
    return [];
  }

  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
    .getValues();

  return values
    .map(function(row, index) {
      const item = {};

      headers.forEach(function(header, columnIndex) {
        item[header] = row[columnIndex];
      });

      item._rowNumber = index + 2;

      return item;
    })
    .filter(function(item) {
      return toPhase2Boolean_(item.active);
    })
    .sort(function(a, b) {
      return Number(a.sort_order || 999999) - Number(b.sort_order || 999999);
    })
    .map(function(item) {
      return {
        guide_id: String(item.guide_id || '').trim(),
        category: String(item.category || '').trim(),
        title: String(item.title || '').trim(),
        content: String(item.content || ''),
        sort_order: Number(item.sort_order || 0),
        active: toPhase2Boolean_(item.active),
      };
    });
}


/**
 * 인증번호 담당자 내부 조회
 */
function getPhase4AuthManagers_() {
  const users = getPhase2Users_()
    .filter(function(user) {
      return toPhase2Boolean_(user.active);
    });

  let managers = users.filter(function(user) {
    return toPhase2Boolean_(user.is_auth_manager);
  });

  if (managers.length === 0) {
    managers = users.filter(function(user) {
      return isPhase2AdminRole_(user.role);
    });
  }

  return managers
    .map(sanitizePhase2User_)
    .sort(sortPhase2Users_);
}


/**
 * YYYY-MM-DD 문자열을 로컬 날짜로 파싱
 */
function parsePhase4DateInput_(value) {
  if (value instanceof Date) {
    return value;
  }

  const text = String(value || '').trim();

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    return new Date(year, month - 1, day, 0, 0, 0);
  }

  return new Date(text);
}


function getPhase4DayRange_(dateValue) {
  const date = parsePhase4DateInput_(dateValue);

  if (isNaN(date.getTime())) {
    throw new Error('날짜가 올바르지 않습니다.');
  }

  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0
  );

  const end = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
    0,
    0,
    0
  );

  return {
    start: start,
    end: end,
  };
}


function phase4Ok_(data, message) {
  return {
    ok: true,
    data: data,
    message: message || '',
  };
}


function phase4Fail_(message, detail) {
  return {
    ok: false,
    data: detail || null,
    message: message || '오류가 발생했습니다.',
  };
}


/**
 * Phase 4 테스트 실행
 */
function TEST_runPhase4() {
  const tests = [];

  try {
    TEST_resetPhase4Data_();

    tests.push(TEST_phase4Settings_());
    tests.push(TEST_phase4GuideItems_());
    tests.push(TEST_phase4AuthManagers_());
    tests.push(TEST_phase4DateOnlyParse_());
    tests.push(TEST_phase4ReservationsByDate_());
    tests.push(TEST_phase4NextReservationPure_());
    tests.push(TEST_phase4InitialData_());
  } catch (error) {
    tests.push(makePhase4TestResult_(
      'P4-ERROR',
      'Phase 4 테스트 실행 오류',
      false,
      '정상 실행',
      error.message,
      error.message
    ));
  } finally {
    TEST_resetPhase4Data_();
  }

  const response = buildPhase4TestResponse_(tests);

  Logger.log(JSON.stringify(response, null, 2));

  return response;
}


function TEST_phase4Settings_() {
  return safePhase4Test_('P4-SET-01', 'Settings 조회', function() {
    const settings = getPhase4SettingsMap_();

    const passed = Boolean(settings.app_title);

    return makePhase4TestResult_(
      'P4-SET-01',
      'Settings 조회',
      passed,
      'app_title 존재',
      settings.app_title || '(없음)',
      passed ? 'Settings 조회 성공' : 'Settings 조회 실패'
    );
  });
}


function TEST_phase4GuideItems_() {
  return safePhase4Test_('P4-GUIDE-01', 'GuideItems active 및 정렬 확인', function() {
    TEST_addPhase4GuideItem_({
      guide_id: 'TEST_GUIDE_ACTIVE',
      category: '테스트',
      title: '활성 테스트 안내',
      content: '<script>alert("x")</script>\n테스트',
      sort_order: 9990,
      active: true,
    });

    TEST_addPhase4GuideItem_({
      guide_id: 'TEST_GUIDE_INACTIVE',
      category: '테스트',
      title: '비활성 테스트 안내',
      content: '표시되면 안 됨',
      sort_order: 9991,
      active: false,
    });

    const guides = getPhase4GuideItems_();

    const ids = guides.map(function(guide) {
      return guide.guide_id;
    });

    const activeIncluded = ids.indexOf('TEST_GUIDE_ACTIVE') !== -1;
    const inactiveExcluded = ids.indexOf('TEST_GUIDE_INACTIVE') === -1;

    const testGuide = guides.filter(function(guide) {
      return guide.guide_id === 'TEST_GUIDE_ACTIVE';
    })[0];

    const htmlPreservedAsText = testGuide &&
      String(testGuide.content || '').indexOf('<script>') !== -1;

    const passed = activeIncluded && inactiveExcluded && htmlPreservedAsText;

    return makePhase4TestResult_(
      'P4-GUIDE-01',
      'GuideItems active 및 정렬 확인',
      passed,
      'active=true만 표시, HTML은 문자열로 보존',
      'activeIncluded=' + activeIncluded +
        ', inactiveExcluded=' + inactiveExcluded +
        ', htmlPreservedAsText=' + htmlPreservedAsText,
      passed ? 'GuideItems 조회 성공' : 'GuideItems 조회 실패'
    );
  });
}


function TEST_phase4AuthManagers_() {
  return safePhase4Test_('P4-AUTHMGR-01', '인증번호 담당자 조회', function() {
    const managers = getPhase4AuthManagers_();

    const passed = managers.length >= 1 &&
      managers.some(function(manager) {
        return manager.is_auth_manager === true || isPhase2AdminRole_(manager.role);
      });

    return makePhase4TestResult_(
      'P4-AUTHMGR-01',
      '인증번호 담당자 조회',
      passed,
      '인증번호 담당자 1명 이상',
      managers.length + '명',
      passed ? '인증번호 담당자 조회 성공' : '인증번호 담당자 조회 실패'
    );
  });
}


function TEST_phase4DateOnlyParse_() {
  return safePhase4Test_('P4-DATE-01', 'YYYY-MM-DD 로컬 날짜 파싱', function() {
    const date = parsePhase4DateInput_('2026-06-21');

    const passed =
      date.getFullYear() === 2026 &&
      date.getMonth() === 5 &&
      date.getDate() === 21 &&
      date.getHours() === 0;

    return makePhase4TestResult_(
      'P4-DATE-01',
      'YYYY-MM-DD 로컬 날짜 파싱',
      passed,
      '2026-06-21 00:00 로컬 날짜',
      formatPhase3Date_(date),
      passed ? '날짜 파싱 성공' : '날짜 파싱 실패'
    );
  });
}


function TEST_phase4ReservationsByDate_() {
  return safePhase4Test_('P4-RES-DATE-01', '날짜별 예약 조회', function() {
    const targetDate = makePhase4FutureDate_(3);

    const payload = {
      __test: true,
      work_type: PHASE1_CONFIG.WORK_TYPES[0],
      work_title: 'Phase4 날짜별 예약 조회 테스트',
      work_description: 'TEST_PHASE4',
      start_time: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 9, 0, 0),
      end_time: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 10, 0, 0),
      safety_confirmed: true,
      conflict_acknowledged: true,
    };

    const created = createReservation(payload);

    const dateText = Utilities.formatDate(
      targetDate,
      Session.getScriptTimeZone() || 'Asia/Seoul',
      'yyyy-MM-dd'
    );

    const result = getReservationsByDate(dateText);

    const found = result.ok && result.data.some(function(reservation) {
      return reservation.work_title === 'Phase4 날짜별 예약 조회 테스트';
    });

    const passed = created.ok && found;

    return makePhase4TestResult_(
      'P4-RES-DATE-01',
      '날짜별 예약 조회',
      passed,
      '지정 날짜의 테스트 예약 조회',
      result.message,
      passed ? '날짜별 예약 조회 성공' : '날짜별 예약 조회 실패'
    );
  });
}


function TEST_phase4NextReservationPure_() {
  return safePhase4Test_('P4-NEXT-01', '다음 예약 정렬 로직', function() {
    const base = new Date();

    const mockReservations = [
      {
        reservation_id: 'MOCK_2',
        status: '예약',
        start_time: new Date(base.getTime() + 120 * 60000),
        end_time: new Date(base.getTime() + 180 * 60000),
      },
      {
        reservation_id: 'MOCK_1',
        status: '예약',
        start_time: new Date(base.getTime() + 60 * 60000),
        end_time: new Date(base.getTime() + 90 * 60000),
      },
      {
        reservation_id: 'MOCK_DONE',
        status: '완료',
        start_time: new Date(base.getTime() + 30 * 60000),
        end_time: new Date(base.getTime() + 40 * 60000),
      },
    ];

    const next = getPhase4NextReservationFromList_(mockReservations, base);

    const passed = next && next.reservation_id === 'MOCK_1';

    return makePhase4TestResult_(
      'P4-NEXT-01',
      '다음 예약 정렬 로직',
      passed,
      '가장 가까운 예약 반환',
      next ? next.reservation_id : '(없음)',
      passed ? '다음 예약 정렬 로직 성공' : '다음 예약 정렬 로직 실패'
    );
  });
}


function TEST_phase4InitialData_() {
  return safePhase4Test_('P4-INIT-01', '초기 데이터 조회', function() {
    const result = getInitialData();

    const hasRequiredFields = Boolean(
      result &&
      result.ok === true &&
      result.data &&
      result.data.currentUser !== undefined &&
      result.data.settings &&
      Array.isArray(result.data.guides) &&
      Array.isArray(result.data.authManagers) &&
      Array.isArray(result.data.workTypes)
    );

    const hasWorkTypes = Boolean(
      result &&
      result.data &&
      Array.isArray(result.data.workTypes) &&
      result.data.workTypes.length > 0
    );

    const passed = hasRequiredFields && hasWorkTypes;

    return makePhase4TestResult_(
      'P4-INIT-01',
      '초기 데이터 조회',
      passed,
      'currentUser, settings, guides, authManagers, workTypes 포함',
      result && result.message
        ? result.message + ' / workTypes=' + (result.data && result.data.workTypes ? result.data.workTypes.length : 0)
        : '응답 없음',
      passed ? '초기 데이터 조회 성공' : '초기 데이터 조회 실패'
    );
  });
}


function getPhase4NextReservationFromList_(reservations, now) {
  return reservations
    .filter(function(reservation) {
      return reservation.status === '예약';
    })
    .filter(function(reservation) {
      return toPhase3Date_(reservation.start_time).getTime() >= now.getTime();
    })
    .sort(sortPhase3ByStartTime_)[0] || null;
}


function TEST_addPhase4GuideItem_(rowObject) {
  const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.GUIDE_ITEMS);
  const headers = getPhase2Headers_(sheet);

  appendPhase2ObjectRow_(sheet, headers, rowObject);
}


function makePhase4FutureDate_(daysAfter) {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + daysAfter,
    0,
    0,
    0
  );
}


function TEST_resetPhase4Data_() {
  TEST_resetPhase3Data_();
  TEST_deletePhase4RowsByPrefix_(PHASE1_CONFIG.SHEETS.GUIDE_ITEMS, 'guide_id', 'TEST_GUIDE_');
}


function TEST_deletePhase4RowsByPrefix_(sheetName, keyColumn, prefix) {
  const sheet = getPhase2Sheet_(sheetName);
  const headers = getPhase2Headers_(sheet);
  const keyIndex = headers.indexOf(keyColumn);

  if (keyIndex === -1) {
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
    const key = String(values[i][keyIndex] || '').trim();

    if (key.indexOf(prefix) === 0) {
      sheet.deleteRow(i + 2);
    }
  }
}


function safePhase4Test_(code, name, callback) {
  try {
    return callback();
  } catch (error) {
    return makePhase4TestResult_(
      code,
      name,
      false,
      '정상 실행',
      error.message,
      error.message
    );
  }
}


function makePhase4TestResult_(code, name, passed, expected, actual, message) {
  return {
    code: code,
    name: name,
    passed: passed === true,
    expected: expected,
    actual: actual,
    message: message,
  };
}


function buildPhase4TestResponse_(tests) {
  const passed = tests.filter(function(test) {
    return test.passed === true;
  }).length;

  const failed = tests.length - passed;

  return {
    ok: failed === 0,
    message: failed === 0
      ? 'Phase 4 테스트를 모두 통과했습니다.'
      : 'Phase 4 테스트 중 실패 항목이 있습니다.',
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