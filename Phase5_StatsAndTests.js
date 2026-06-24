/**
 * Phase 5 - 관리자 통계 / 전체 테스트 실행 통합
 *
 * 전제:
 * - Phase1_Setup.gs 적용 완료
 * - Phase2_UserAuth.gs 적용 완료
 * - Phase3_Reservations.gs 적용 완료
 * - Phase4_AppData.gs 적용 완료
 */


/**
 * 관리자 통계 조회
 */
function getStats() {
  try {
    requirePhase2Admin_();

    const users = getPhase2Users_();
    const reservations = getPhase3Reservations_();
    const logs = getPhase5UsageLogs_();

    const stats = calculatePhase5Stats_(users, reservations, logs);

    return phase5Ok_(stats, '통계 조회 성공');
  } catch (error) {
    return phase5Fail_(error.message);
  }
}


/**
 * 관리자 화면용 전체 테스트 실행
 * 프론트 관리자 화면의 [테스트 실행] 버튼에서 호출할 함수
 */
function adminRunAllTests() {
  return TEST_runAll();
}


/**
 * 전체 Phase 테스트 실행
 */
function TEST_runAll() {
  try {
    requirePhase2Admin_();

    const phases = [];

    phases.push(buildPhase5PhaseFromTests_(
      'Phase 1 - DB 초기화/스키마',
      TEST_runPhase1_()
    ));

    phases.push(normalizePhase5PhaseResponse_(
      'Phase 2 - 사용자/권한',
      TEST_runPhase2()
    ));

    phases.push(normalizePhase5PhaseResponse_(
      'Phase 13-A - 사용자 CSV 일괄 등록',
      TEST_runPhase13UserBulkCreate()
    ));

    phases.push(normalizePhase5PhaseResponse_(
      'Phase 3 - 예약 핵심 로직',
      TEST_runPhase3()
    ));

    phases.push(normalizePhase5PhaseResponse_(
      'Phase 4 - 초기 데이터 통합',
      TEST_runPhase4()
    ));

    phases.push(normalizePhase5PhaseResponse_(
      'Phase 5 - 통계/테스트 통합',
      TEST_runPhase5()
    ));

    phases.push(normalizePhase5PhaseResponse_(
      'Phase 7 - 등록 요청/승인',
      TEST_runPhase7()
    ));
    
    phases.push(normalizePhase5PhaseResponse_(
      'Phase 9 - 설정 관리',
      TEST_runPhase9()
    ));

    phases.push(normalizePhase5PhaseResponse_(
      'Phase 9-C - 안내 문구 관리',
      TEST_runPhase9GuideItems()
    ));

    const response = buildPhase5AllTestResponse_(phases);

    Logger.log(JSON.stringify(response, null, 2));

    return response;
  } catch (error) {
    const response = {
      ok: false,
      message: '전체 테스트 실행 중 오류가 발생했습니다.',
      data: {
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
        },
        phases: [],
        tests: [
          {
            phase: 'SYSTEM',
            code: 'ALL-ERROR',
            name: '전체 테스트 실행 오류',
            passed: false,
            expected: '정상 실행',
            actual: error.message,
            message: error.message,
          },
        ],
      },
    };

    Logger.log(JSON.stringify(response, null, 2));

    return response;
  }
}


/**
 * UsageLog 전체 조회
 */
function getPhase5UsageLogs_() {
  const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.USAGE_LOG);
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


/**
 * 통계 계산 핵심 로직
 */
function calculatePhase5Stats_(users, reservations, logs) {
  const statusCounts = {};
  const userStats = {};
  const workTypeStats = {};
  const monthStats = {};

  const actualMinutesByReservation = getPhase5ActualMinutesByReservation_(logs);

  users.forEach(function(user) {
    const sanitized = sanitizePhase2User_(user);
    const key = getPhase5UserKey_(sanitized);

    ensurePhase5UserStat_(userStats, key, sanitized);
  });

  reservations.forEach(function(reservation) {
    const status = String(reservation.status || '').trim() || '미지정';

    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  let totalReservedMinutes = 0;
  let totalActualMinutes = 0;
  let countableReservations = 0;

  reservations.forEach(function(reservation) {
    if (!isPhase5CountableReservation_(reservation)) {
      return;
    }

    const reservedMinutes = phase5MinutesBetween_(
      reservation.start_time,
      reservation.end_time
    );

    const reservationId = String(reservation.reservation_id || '').trim();
    const actualMinutes = actualMinutesByReservation[reservationId] || 0;

    const userKey = getPhase5ReservationUserKey_(reservation);

    const userSource = {
      user_id: String(reservation.user_id || '').trim(),
      department: String(reservation.department || '').trim(),
      name: String(reservation.user_name || '').trim(),
      email: normalizePhase2Email_(reservation.user_email),
      role: '',
      active: true,
      is_auth_manager: false,
      sort_order: '',
    };

    const userStat = ensurePhase5UserStat_(userStats, userKey, userSource);

    userStat.reservation_count++;
    userStat.reserved_minutes += reservedMinutes;
    userStat.actual_minutes += actualMinutes;

    const workType = String(reservation.work_type || '').trim() || '미지정';
    const workTypeBucket = ensurePhase5Bucket_(workTypeStats, workType);

    workTypeBucket.count++;
    workTypeBucket.reserved_minutes += reservedMinutes;
    workTypeBucket.actual_minutes += actualMinutes;

    const month = getPhase5MonthKey_(reservation.start_time);
    const monthBucket = ensurePhase5Bucket_(monthStats, month);

    monthBucket.count++;
    monthBucket.reserved_minutes += reservedMinutes;
    monthBucket.actual_minutes += actualMinutes;

    totalReservedMinutes += reservedMinutes;
    totalActualMinutes += actualMinutes;
    countableReservations++;
  });

  return {
    generated_at: formatPhase3Date_(new Date()),
    summary: {
      total_reservations: reservations.length,
      countable_reservations: countableReservations,
      reserved_minutes: totalReservedMinutes,
      actual_minutes: totalActualMinutes,
      status_counts: statusCounts,
    },
    byUser: Object.keys(userStats)
      .map(function(key) {
        return userStats[key];
      })
      .sort(sortPhase5UserStats_),
    byWorkType: Object.keys(workTypeStats)
      .map(function(key) {
        return {
          work_type: key,
          count: workTypeStats[key].count,
          reserved_minutes: workTypeStats[key].reserved_minutes,
          actual_minutes: workTypeStats[key].actual_minutes,
        };
      })
      .sort(function(a, b) {
        return b.count - a.count;
      }),
    byMonth: Object.keys(monthStats)
      .map(function(key) {
        return {
          month: key,
          count: monthStats[key].count,
          reserved_minutes: monthStats[key].reserved_minutes,
          actual_minutes: monthStats[key].actual_minutes,
        };
      })
      .sort(function(a, b) {
        return a.month.localeCompare(b.month);
      }),
  };
}


function getPhase5ActualMinutesByReservation_(logs) {
  const startsByReservationId = {};
  const endsByReservationId = {};

  logs.forEach(function(log) {
    const reservationId = String(log.reservation_id || '').trim();
    const actionType = String(log.action_type || '').trim();

    if (!reservationId) {
      return;
    }

    if (actionType === 'started' && log.actual_start) {
      const start = toPhase3Date_(log.actual_start);

      if (!isNaN(start.getTime())) {
        if (
          !startsByReservationId[reservationId] ||
          start.getTime() < startsByReservationId[reservationId].getTime()
        ) {
          startsByReservationId[reservationId] = start;
        }
      }
    }

    if (actionType === 'completed' && log.actual_end) {
      const end = toPhase3Date_(log.actual_end);

      if (!isNaN(end.getTime())) {
        if (
          !endsByReservationId[reservationId] ||
          end.getTime() > endsByReservationId[reservationId].getTime()
        ) {
          endsByReservationId[reservationId] = end;
        }
      }
    }
  });

  const result = {};

  Object.keys(startsByReservationId).forEach(function(reservationId) {
    const start = startsByReservationId[reservationId];
    const end = endsByReservationId[reservationId];

    if (!start || !end) {
      return;
    }

    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);

    result[reservationId] = Math.max(minutes, 0);
  });

  return result;
}


function isPhase5CountableReservation_(reservation) {
  const status = String(reservation.status || '').trim();

  return status !== '취소' && status !== '삭제됨';
}


function phase5MinutesBetween_(startValue, endValue) {
  const start = toPhase3Date_(startValue);
  const end = toPhase3Date_(endValue);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 0;
  }

  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);

  return Math.max(minutes, 0);
}


function getPhase5UserKey_(user) {
  return String(user.user_id || '').trim() ||
    normalizePhase2Email_(user.email) ||
    'UNKNOWN_USER';
}


function getPhase5ReservationUserKey_(reservation) {
  return String(reservation.user_id || '').trim() ||
    normalizePhase2Email_(reservation.user_email) ||
    'UNKNOWN_USER';
}


function ensurePhase5UserStat_(userStats, key, userSource) {
  if (!userStats[key]) {
    userStats[key] = {
      user_id: String(userSource.user_id || '').trim(),
      department: String(userSource.department || '').trim(),
      name: String(userSource.name || '').trim() || String(userSource.user_name || '').trim(),
      email: normalizePhase2Email_(userSource.email || userSource.user_email),
      role: String(userSource.role || '').trim(),
      active: toPhase2Boolean_(userSource.active),
      sort_order: userSource.sort_order === '' ? '' : userSource.sort_order,
      reservation_count: 0,
      reserved_minutes: 0,
      actual_minutes: 0,
    };
  }

  return userStats[key];
}


function ensurePhase5Bucket_(map, key) {
  const cleanKey = String(key || '').trim() || '미지정';

  if (!map[cleanKey]) {
    map[cleanKey] = {
      count: 0,
      reserved_minutes: 0,
      actual_minutes: 0,
    };
  }

  return map[cleanKey];
}


function getPhase5MonthKey_(dateValue) {
  const date = toPhase3Date_(dateValue);

  if (isNaN(date.getTime())) {
    return '날짜 미지정';
  }

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone() || 'Asia/Seoul',
    'yyyy-MM'
  );
}


function sortPhase5UserStats_(a, b) {
  const orderA = Number(a.sort_order || 999999);
  const orderB = Number(b.sort_order || 999999);

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  const deptCompare = String(a.department || '').localeCompare(String(b.department || ''), 'ko');

  if (deptCompare !== 0) {
    return deptCompare;
  }

  return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
}


function phase5Ok_(data, message) {
  return {
    ok: true,
    data: data,
    message: message || '',
  };
}


function phase5Fail_(message, detail) {
  return {
    ok: false,
    data: detail || null,
    message: message || '오류가 발생했습니다.',
  };
}


/**
 * Phase 5 테스트 실행
 */
function TEST_runPhase5() {
  const tests = [];

  try {
    tests.push(TEST_phase5StatsPure_());
    tests.push(TEST_phase5GetStats_());
    tests.push(TEST_phase5AggregateBuilder_());
  } catch (error) {
    tests.push(makePhase5TestResult_(
      'P5-ERROR',
      'Phase 5 테스트 실행 오류',
      false,
      '정상 실행',
      error.message,
      error.message
    ));
  }

  const response = buildPhase5TestResponse_(tests);

  Logger.log(JSON.stringify(response, null, 2));

  return response;
}


function TEST_phase5StatsPure_() {
  return safePhase5Test_('P5-STAT-01', '통계 순수 로직 계산', function() {
    const base = new Date(2026, 5, 21, 0, 0, 0);

    const users = [
      {
        user_id: 'MOCK_U1',
        department: '정보과',
        name: '사용자1',
        extension: '1001',
        email: 'mock.u1@senedu.kr',
        role: 'user',
        active: true,
        sort_order: 1,
      },
      {
        user_id: 'MOCK_U2',
        department: '일본어과',
        name: '사용자2',
        extension: '1002',
        email: 'mock.u2@senedu.kr',
        role: 'user',
        active: true,
        sort_order: 2,
      },
    ];

    const reservations = [
      {
        reservation_id: 'MOCK_RES_A',
        user_id: 'MOCK_U1',
        user_email: 'mock.u1@senedu.kr',
        user_name: '사용자1',
        department: '정보과',
        work_type: '워크북 개발',
        start_time: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9, 0, 0),
        end_time: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 11, 0, 0),
        status: '완료',
      },
      {
        reservation_id: 'MOCK_RES_B',
        user_id: 'MOCK_U1',
        user_email: 'mock.u1@senedu.kr',
        user_name: '사용자1',
        department: '정보과',
        work_type: '보고서 작성',
        start_time: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 11, 0, 0),
        end_time: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0),
        status: '취소',
      },
      {
        reservation_id: 'MOCK_RES_C',
        user_id: 'MOCK_U2',
        user_email: 'mock.u2@senedu.kr',
        user_name: '사용자2',
        department: '일본어과',
        work_type: '워크북 개발',
        start_time: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 13, 0, 0),
        end_time: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 14, 0, 0),
        status: '예약',
      },
      {
        reservation_id: 'MOCK_RES_D',
        user_id: 'MOCK_U2',
        user_email: 'mock.u2@senedu.kr',
        user_name: '사용자2',
        department: '일본어과',
        work_type: '교육과정 설계',
        start_time: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 15, 0, 0),
        end_time: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 16, 0, 0),
        status: '삭제됨',
      },
    ];

    const logs = [
      {
        log_id: 'MOCK_LOG_1',
        reservation_id: 'MOCK_RES_A',
        user_id: 'MOCK_U1',
        action_type: 'started',
        action_time: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9, 10, 0),
        actual_start: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9, 10, 0),
        actual_end: '',
      },
      {
        log_id: 'MOCK_LOG_2',
        reservation_id: 'MOCK_RES_A',
        user_id: 'MOCK_U1',
        action_type: 'completed',
        action_time: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 40, 0),
        actual_start: '',
        actual_end: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 40, 0),
      },
    ];

    const stats = calculatePhase5Stats_(users, reservations, logs);

    const user1 = stats.byUser.filter(function(user) {
      return user.user_id === 'MOCK_U1';
    })[0];

    const user2 = stats.byUser.filter(function(user) {
      return user.user_id === 'MOCK_U2';
    })[0];

    const workType = stats.byWorkType.filter(function(item) {
      return item.work_type === '워크북 개발';
    })[0];

    const passed =
      stats.summary.total_reservations === 4 &&
      stats.summary.countable_reservations === 2 &&
      stats.summary.reserved_minutes === 180 &&
      stats.summary.actual_minutes === 90 &&
      user1.reservation_count === 1 &&
      user1.reserved_minutes === 120 &&
      user1.actual_minutes === 90 &&
      user2.reservation_count === 1 &&
      user2.reserved_minutes === 60 &&
      workType.count === 2;

    return makePhase5TestResult_(
      'P5-STAT-01',
      '통계 순수 로직 계산',
      passed,
      '총 4건, 집계대상 2건, 예약 180분, 실제 90분',
      'total=' + stats.summary.total_reservations +
        ', countable=' + stats.summary.countable_reservations +
        ', reserved=' + stats.summary.reserved_minutes +
        ', actual=' + stats.summary.actual_minutes,
      passed ? '통계 순수 로직 계산 성공' : '통계 순수 로직 계산 실패'
    );
  });
}


function TEST_phase5GetStats_() {
  return safePhase5Test_('P5-STAT-02', 'getStats 관리자 조회', function() {
    const result = getStats();

    const passed =
      result.ok === true &&
      result.data &&
      result.data.summary &&
      Array.isArray(result.data.byUser) &&
      Array.isArray(result.data.byWorkType) &&
      Array.isArray(result.data.byMonth);

    return makePhase5TestResult_(
      'P5-STAT-02',
      'getStats 관리자 조회',
      passed,
      'summary, byUser, byWorkType, byMonth 포함',
      result.message,
      passed ? 'getStats 관리자 조회 성공' : 'getStats 관리자 조회 실패'
    );
  });
}


function TEST_phase5AggregateBuilder_() {
  return safePhase5Test_('P5-TEST-01', '전체 테스트 집계 로직', function() {
    const phaseResponse = {
      ok: false,
      message: 'mock',
      data: {
        summary: {
          total: 2,
          passed: 1,
          failed: 1,
        },
        tests: [
          {
            code: 'MOCK-01',
            name: '성공 테스트',
            passed: true,
            expected: 'true',
            actual: 'true',
            message: '성공',
          },
          {
            code: 'MOCK-02',
            name: '실패 테스트',
            passed: false,
            expected: 'true',
            actual: 'false',
            message: '실패',
          },
        ],
      },
    };

    const phase = normalizePhase5PhaseResponse_('Mock Phase', phaseResponse);
    const all = buildPhase5AllTestResponse_([phase]);

    const passed =
      all.ok === false &&
      all.data.summary.total === 2 &&
      all.data.summary.passed === 1 &&
      all.data.summary.failed === 1 &&
      all.data.tests[0].phase === 'Mock Phase';

    return makePhase5TestResult_(
      'P5-TEST-01',
      '전체 테스트 집계 로직',
      passed,
      'total=2, passed=1, failed=1',
      JSON.stringify(all.data.summary),
      passed ? '전체 테스트 집계 로직 성공' : '전체 테스트 집계 로직 실패'
    );
  });
}


function buildPhase5PhaseFromTests_(phaseName, tests) {
  const safeTests = Array.isArray(tests) ? tests : [];

  const passed = safeTests.filter(function(test) {
    return test.passed === true;
  }).length;

  const failed = safeTests.length - passed;

  return {
    phase: phaseName,
    ok: failed === 0,
    summary: {
      total: safeTests.length,
      passed: passed,
      failed: failed,
    },
    tests: safeTests.map(function(test) {
      return {
        phase: phaseName,
        code: test.code,
        name: test.name,
        passed: test.passed === true,
        expected: test.expected,
        actual: test.actual,
        message: test.message,
      };
    }),
  };
}


function normalizePhase5PhaseResponse_(phaseName, response) {
  if (!response || !response.data || !Array.isArray(response.data.tests)) {
    return {
      phase: phaseName,
      ok: false,
      summary: {
        total: 1,
        passed: 0,
        failed: 1,
      },
      tests: [
        {
          phase: phaseName,
          code: 'PHASE-ERROR',
          name: phaseName + ' 응답 오류',
          passed: false,
          expected: '테스트 응답',
          actual: '응답 없음 또는 형식 오류',
          message: phaseName + ' 테스트 응답 형식이 올바르지 않습니다.',
        },
      ],
    };
  }

  return buildPhase5PhaseFromTests_(phaseName, response.data.tests);
}


function buildPhase5AllTestResponse_(phases) {
  const allTests = [];

  phases.forEach(function(phase) {
    phase.tests.forEach(function(test) {
      allTests.push(test);
    });
  });

  const passed = allTests.filter(function(test) {
    return test.passed === true;
  }).length;

  const failed = allTests.length - passed;

  const phaseSummaries = phases.map(function(phase) {
    return {
      phase: phase.phase,
      ok: phase.ok,
      summary: phase.summary,
    };
  });

  return {
    ok: failed === 0,
    message: failed === 0
      ? '전체 테스트를 모두 통과했습니다.'
      : '전체 테스트 중 실패 항목이 있습니다.',
    data: {
      summary: {
        total: allTests.length,
        passed: passed,
        failed: failed,
      },
      phases: phaseSummaries,
      tests: allTests,
    },
  };
}


function safePhase5Test_(code, name, callback) {
  try {
    return callback();
  } catch (error) {
    return makePhase5TestResult_(
      code,
      name,
      false,
      '정상 실행',
      error.message,
      error.message
    );
  }
}


function makePhase5TestResult_(code, name, passed, expected, actual, message) {
  return {
    code: code,
    name: name,
    passed: passed === true,
    expected: expected,
    actual: actual,
    message: message,
  };
}


function buildPhase5TestResponse_(tests) {
  const passed = tests.filter(function(test) {
    return test.passed === true;
  }).length;

  const failed = tests.length - passed;

  return {
    ok: failed === 0,
    message: failed === 0
      ? 'Phase 5 테스트를 모두 통과했습니다.'
      : 'Phase 5 테스트 중 실패 항목이 있습니다.',
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