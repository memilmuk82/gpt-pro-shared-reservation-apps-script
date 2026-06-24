/**
 * Phase 3 - 예약 핵심 로직
 *
 * 전제:
 * - Phase1_Setup.gs 적용 완료
 * - Phase2_UserAuth.gs 적용 완료
 */

function createReservation(payload) {
  try {
    const currentUser = requirePhase2ActiveUser_();
    const cleanPayload = validatePhase3ReservationPayload_(payload, false);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const conflicts = findPhase3Conflicts_(
        cleanPayload.start_time,
        cleanPayload.end_time,
        ''
      );

      if (conflicts.length > 0 && cleanPayload.conflict_acknowledged !== true) {
        return phase3Fail_(
          '동시간대 예약이 있습니다. 조율 확인 후 저장해 주세요.',
          { conflicts: conflicts.map(sanitizePhase3Reservation_) }
        );
      }

      const now = new Date();
      const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.RESERVATIONS);
      const headers = getPhase2Headers_(sheet);

      const reservation = {
        reservation_id: makePhase3Id_('RES_', payload && payload.__test),
        user_id: currentUser.user_id,
        user_email: currentUser.email,
        user_name: currentUser.name,
        department: currentUser.department,
        work_type: cleanPayload.work_type,
        work_title: cleanPayload.work_title,
        work_description: cleanPayload.work_description,
        start_time: cleanPayload.start_time,
        end_time: cleanPayload.end_time,
        expected_minutes: cleanPayload.expected_minutes,
        status: '예약',
        safety_confirmed: cleanPayload.safety_confirmed,
        conflict_acknowledged: cleanPayload.conflict_acknowledged,
        created_at: now,
        updated_at: '',
        completed_at: '',
        cancelled_at: '',
        deleted_at: '',
        deleted_by: '',
      };

      appendPhase2ObjectRow_(sheet, headers, reservation);
      appendPhase3UsageLog_(reservation, 'created', '', '', '예약 생성');

      return phase3Ok_(
        sanitizePhase3Reservation_(reservation),
        '예약 등록 성공'
      );
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase3Fail_(error.message);
  }
}


function createImmediateReservation(payload) {
  try {
    const currentUser = requirePhase2ActiveUser_();
    const cleanPayload = validatePhase3ReservationPayload_(payload, true);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const conflicts = findPhase3Conflicts_(
        cleanPayload.start_time,
        cleanPayload.end_time,
        ''
      );

      if (conflicts.length > 0 && cleanPayload.conflict_acknowledged !== true) {
        return phase3Fail_(
          '동시간대 예약이 있습니다. 조율 확인 후 저장해 주세요.',
          { conflicts: conflicts.map(sanitizePhase3Reservation_) }
        );
      }

      const now = new Date();
      const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.RESERVATIONS);
      const headers = getPhase2Headers_(sheet);

      const reservation = {
        reservation_id: makePhase3Id_('RES_', payload && payload.__test),
        user_id: currentUser.user_id,
        user_email: currentUser.email,
        user_name: currentUser.name,
        department: currentUser.department,
        work_type: cleanPayload.work_type,
        work_title: cleanPayload.work_title,
        work_description: cleanPayload.work_description,
        start_time: cleanPayload.start_time,
        end_time: cleanPayload.end_time,
        expected_minutes: cleanPayload.expected_minutes,
        status: '사용중',
        safety_confirmed: cleanPayload.safety_confirmed,
        conflict_acknowledged: cleanPayload.conflict_acknowledged,
        created_at: now,
        updated_at: '',
        completed_at: '',
        cancelled_at: '',
        deleted_at: '',
        deleted_by: '',
      };

      appendPhase2ObjectRow_(sheet, headers, reservation);
      appendPhase3UsageLog_(reservation, 'started', reservation.start_time, '', '즉시 사용 시작');

      return phase3Ok_(
        sanitizePhase3Reservation_(reservation),
        '즉시 사용 시작 등록 성공'
      );
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase3Fail_(error.message);
  }
}


function checkConflicts(startTime, endTime, excludeReservationId) {
  try {
    requirePhase2ActiveUser_();

    const start = toPhase3Date_(startTime);
    const end = toPhase3Date_(endTime);

    validatePhase3TimeRange_(start, end);

    const conflicts = findPhase3Conflicts_(start, end, excludeReservationId || '');

    return phase3Ok_(
      conflicts.map(sanitizePhase3Reservation_),
      conflicts.length > 0 ? '동시간대 예약이 있습니다.' : '동시간대 예약이 없습니다.'
    );
  } catch (error) {
    return phase3Fail_(error.message);
  }
}


function startReservation(reservationId) {
  try {
    const currentUser = requirePhase2ActiveUser_();

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const reservation = findPhase3ReservationById_(reservationId);

      if (!reservation) {
        return phase3Fail_('예약을 찾을 수 없습니다.');
      }

      if (!canPhase3ControlReservation_(currentUser, reservation)) {
        return phase3Fail_('본인 예약 또는 관리자만 처리할 수 있습니다.');
      }

      if (reservation.status !== '예약') {
        return phase3Fail_('예약 상태에서만 사용 시작할 수 있습니다.');
      }

      updatePhase3Reservation_(reservation, {
        status: '사용중',
        updated_at: new Date(),
      });

      const updated = findPhase3ReservationById_(reservationId);
      appendPhase3UsageLog_(updated, 'started', new Date(), '', '사용 시작');

      return phase3Ok_(sanitizePhase3Reservation_(updated), '사용 시작 처리 완료');
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase3Fail_(error.message);
  }
}


function completeReservation(reservationId) {
  try {
    const currentUser = requirePhase2ActiveUser_();

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const reservation = findPhase3ReservationById_(reservationId);

      if (!reservation) {
        return phase3Fail_('예약을 찾을 수 없습니다.');
      }

      if (!canPhase3ControlReservation_(currentUser, reservation)) {
        return phase3Fail_('본인 예약 또는 관리자만 처리할 수 있습니다.');
      }

      if (reservation.status !== '사용중') {
        return phase3Fail_('사용중 상태에서만 완료 처리할 수 있습니다.');
      }

      const now = new Date();

      updatePhase3Reservation_(reservation, {
        status: '완료',
        completed_at: now,
        updated_at: now,
      });

      const updated = findPhase3ReservationById_(reservationId);
      appendPhase3UsageLog_(updated, 'completed', '', now, '사용 완료');

      return phase3Ok_(sanitizePhase3Reservation_(updated), '사용 완료 처리 완료');
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase3Fail_(error.message);
  }
}


function cancelReservation(reservationId) {
  try {
    const currentUser = requirePhase2ActiveUser_();

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const reservation = findPhase3ReservationById_(reservationId);

      if (!reservation) {
        return phase3Fail_('예약을 찾을 수 없습니다.');
      }

      if (!canPhase3ControlReservation_(currentUser, reservation)) {
        return phase3Fail_('본인 예약 또는 관리자만 처리할 수 있습니다.');
      }

      if (reservation.status !== '예약') {
        return phase3Fail_('예약 상태에서만 취소할 수 있습니다.');
      }

      const now = new Date();

      updatePhase3Reservation_(reservation, {
        status: '취소',
        cancelled_at: now,
        updated_at: now,
      });

      const updated = findPhase3ReservationById_(reservationId);
      appendPhase3UsageLog_(updated, 'cancelled', '', '', '예약 취소');

      return phase3Ok_(sanitizePhase3Reservation_(updated), '예약 취소 완료');
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase3Fail_(error.message);
  }
}


function adminDeleteReservation(reservationId) {
  try {
    const admin = requirePhase2Admin_();

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const reservation = findPhase3ReservationById_(reservationId);

      if (!reservation) {
        return phase3Fail_('예약을 찾을 수 없습니다.');
      }

      if (['완료', '취소', '삭제됨'].indexOf(reservation.status) !== -1) {
        return phase3Fail_('이미 종료된 예약은 삭제 처리할 수 없습니다.');
      }

      const now = new Date();

      updatePhase3Reservation_(reservation, {
        status: '삭제됨',
        deleted_at: now,
        deleted_by: admin.email,
        updated_at: now,
      });

      const updated = findPhase3ReservationById_(reservationId);
      appendPhase3UsageLog_(updated, 'admin_deleted', '', '', '관리자 삭제 처리');

      return phase3Ok_(sanitizePhase3Reservation_(updated), '관리자 삭제 처리 완료');
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase3Fail_(error.message);
  }
}


function getCurrentReservation() {
  try {
    requirePhase2ActiveUser_();

    const now = new Date();
    const reservations = getPhase3Reservations_()
      .filter(function(reservation) {
        return ['완료', '취소', '삭제됨'].indexOf(reservation.status) === -1;
      });

    const active = reservations
      .filter(function(reservation) {
        return reservation.status === '사용중' &&
          toPhase3Date_(reservation.end_time).getTime() >= now.getTime();
      })
      .sort(sortPhase3ByStartTime_)[0];

    if (active) {
      const result = sanitizePhase3Reservation_(active);
      result.current_state = '사용중';
      return phase3Ok_(result, '현재 사용중 예약 조회 성공');
    }

    const scheduledNow = reservations
      .filter(function(reservation) {
        return reservation.status === '예약' &&
          toPhase3Date_(reservation.start_time).getTime() <= now.getTime() &&
          toPhase3Date_(reservation.end_time).getTime() >= now.getTime();
      })
      .sort(sortPhase3ByStartTime_)[0];

    if (scheduledNow) {
      const result = sanitizePhase3Reservation_(scheduledNow);
      result.current_state = '예약시간도래';
      return phase3Ok_(result, '현재 시간대 예약 조회 성공');
    }

    const overdue = reservations
      .filter(function(reservation) {
        return reservation.status === '사용중' &&
          toPhase3Date_(reservation.end_time).getTime() < now.getTime();
      })
      .sort(sortPhase3ByStartTime_)[0];

    if (overdue) {
      const result = sanitizePhase3Reservation_(overdue);
      result.current_state = '종료 예정 시간 경과';
      return phase3Ok_(result, '종료 예정 시간이 지난 사용중 예약이 있습니다.');
    }

    return phase3Ok_(null, '현재 사용중인 사용자가 없습니다.');
  } catch (error) {
    return phase3Fail_(error.message);
  }
}


function getTodayReservations(dateValue) {
  try {
    requirePhase2ActiveUser_();

    const baseDate = dateValue ? toPhase3Date_(dateValue) : new Date();
    const range = getPhase3DayRange_(baseDate);

    const reservations = getPhase3Reservations_()
      .filter(function(reservation) {
        if (['삭제됨'].indexOf(reservation.status) !== -1) {
          return false;
        }

        const start = toPhase3Date_(reservation.start_time).getTime();

        return start >= range.start.getTime() && start < range.end.getTime();
      })
      .sort(sortPhase3ByStartTime_)
      .map(sanitizePhase3Reservation_);

    return phase3Ok_(reservations, '오늘 예약 조회 성공');
  } catch (error) {
    return phase3Fail_(error.message);
  }
}


function getMyReservations() {
  try {
    const currentUser = requirePhase2ActiveUser_();

    const reservations = getPhase3Reservations_()
      .filter(function(reservation) {
        return normalizePhase2Email_(reservation.user_email) === normalizePhase2Email_(currentUser.email);
      })
      .filter(function(reservation) {
        return reservation.status !== '삭제됨';
      })
      .sort(sortPhase3ByStartTime_)
      .map(sanitizePhase3Reservation_);

    return phase3Ok_(reservations, '내 예약 조회 성공');
  } catch (error) {
    return phase3Fail_(error.message);
  }
}


function validatePhase3ReservationPayload_(payload, immediate) {
  const data = payload || {};

  const workType = String(data.work_type || '').trim();
  const workTitle = String(data.work_title || '').trim();
  const workDescription = String(data.work_description || '').trim();

  if (!workType) {
    throw new Error('작업 유형을 선택해 주세요.');
  }

  if (PHASE1_CONFIG.WORK_TYPES.indexOf(workType) === -1) {
    throw new Error('올바르지 않은 작업 유형입니다: ' + workType);
  }

  if (!workTitle) {
    throw new Error('작업명을 입력해 주세요.');
  }

  if (toPhase2Boolean_(data.safety_confirmed) !== true) {
    throw new Error('사용 전 확인 사항에 동의해야 합니다.');
  }

  let startTime;
  let endTime;
  let expectedMinutes;

  if (immediate) {
    expectedMinutes = Number(data.expected_minutes || 60);

    if (!expectedMinutes || expectedMinutes < 30) {
      throw new Error('예상 사용 시간은 30분 이상이어야 합니다.');
    }

    startTime = new Date();
    endTime = new Date(startTime.getTime() + expectedMinutes * 60 * 1000);
  } else {
    startTime = toPhase3Date_(data.start_time);
    endTime = toPhase3Date_(data.end_time);
    validatePhase3TimeRange_(startTime, endTime);
    expectedMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
  }

  return {
    work_type: workType,
    work_title: workTitle,
    work_description: workDescription,
    start_time: startTime,
    end_time: endTime,
    expected_minutes: expectedMinutes,
    safety_confirmed: true,
    conflict_acknowledged: toPhase2Boolean_(data.conflict_acknowledged),
  };
}


function validatePhase3TimeRange_(startTime, endTime) {
  if (!(startTime instanceof Date) || isNaN(startTime.getTime())) {
    throw new Error('시작 시간이 올바르지 않습니다.');
  }

  if (!(endTime instanceof Date) || isNaN(endTime.getTime())) {
    throw new Error('종료 시간이 올바르지 않습니다.');
  }

  if (endTime.getTime() <= startTime.getTime()) {
    throw new Error('종료 시간은 시작 시간보다 뒤여야 합니다.');
  }

  const minutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  if (minutes < 30) {
    throw new Error('예상 사용 시간은 30분 이상이어야 합니다.');
  }
}


function findPhase3Conflicts_(startTime, endTime, excludeReservationId) {
  const start = toPhase3Date_(startTime);
  const end = toPhase3Date_(endTime);
  const excludeId = String(excludeReservationId || '').trim();

  return getPhase3Reservations_()
    .filter(function(reservation) {
      if (excludeId && String(reservation.reservation_id || '').trim() === excludeId) {
        return false;
      }

      if (['완료', '취소', '삭제됨'].indexOf(reservation.status) !== -1) {
        return false;
      }

      const reservedStart = toPhase3Date_(reservation.start_time);
      const reservedEnd = toPhase3Date_(reservation.end_time);

      return start.getTime() < reservedEnd.getTime() &&
        end.getTime() > reservedStart.getTime();
    })
    .sort(sortPhase3ByStartTime_);
}


function findPhase3ReservationById_(reservationId) {
  const targetId = String(reservationId || '').trim();

  if (!targetId) {
    return null;
  }

  const reservations = getPhase3Reservations_();

  for (let i = 0; i < reservations.length; i++) {
    if (String(reservations[i].reservation_id || '').trim() === targetId) {
      return reservations[i];
    }
  }

  return null;
}


function getPhase3Reservations_() {
  const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.RESERVATIONS);
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


function updatePhase3Reservation_(reservation, patch) {
  const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.RESERVATIONS);
  const headers = getPhase2Headers_(sheet);

  updatePhase2RowByNumber_(sheet, headers, reservation._rowNumber, patch);
}


function appendPhase3UsageLog_(reservation, actionType, actualStart, actualEnd, note) {
  const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.USAGE_LOG);
  const headers = getPhase2Headers_(sheet);

  const log = {
    log_id: makePhase3Id_('LOG_', String(reservation.reservation_id || '').indexOf('TEST_RES_') === 0),
    reservation_id: reservation.reservation_id,
    user_id: reservation.user_id,
    action_type: actionType,
    action_time: new Date(),
    actual_start: actualStart || '',
    actual_end: actualEnd || '',
    note: note || '',
  };

  appendPhase2ObjectRow_(sheet, headers, log);
}


function canPhase3ControlReservation_(currentUser, reservation) {
  if (isPhase2AdminRole_(currentUser.role)) {
    return true;
  }

  return normalizePhase2Email_(currentUser.email) === normalizePhase2Email_(reservation.user_email);
}


function sanitizePhase3Reservation_(reservation) {
  if (!reservation) {
    return null;
  }

  return {
    reservation_id: String(reservation.reservation_id || '').trim(),
    user_id: String(reservation.user_id || '').trim(),
    user_email: normalizePhase2Email_(reservation.user_email),
    user_name: String(reservation.user_name || '').trim(),
    department: String(reservation.department || '').trim(),
    work_type: String(reservation.work_type || '').trim(),
    work_title: String(reservation.work_title || '').trim(),
    work_description: String(reservation.work_description || '').trim(),
    start_time: formatPhase3Date_(reservation.start_time),
    end_time: formatPhase3Date_(reservation.end_time),
    expected_minutes: Number(reservation.expected_minutes || 0),
    status: String(reservation.status || '').trim(),
    safety_confirmed: toPhase2Boolean_(reservation.safety_confirmed),
    conflict_acknowledged: toPhase2Boolean_(reservation.conflict_acknowledged),
    created_at: formatPhase3Date_(reservation.created_at),
    updated_at: formatPhase3Date_(reservation.updated_at),
    completed_at: formatPhase3Date_(reservation.completed_at),
    cancelled_at: formatPhase3Date_(reservation.cancelled_at),
    deleted_at: formatPhase3Date_(reservation.deleted_at),
    deleted_by: String(reservation.deleted_by || '').trim(),
  };
}


function toPhase3Date_(value) {
  if (value instanceof Date) {
    return value;
  }

  if (!value) {
    return new Date('');
  }

  return new Date(value);
}


function formatPhase3Date_(value) {
  if (!value) {
    return '';
  }

  const date = toPhase3Date_(value);

  if (isNaN(date.getTime())) {
    return '';
  }

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone() || 'Asia/Seoul',
    'yyyy-MM-dd HH:mm:ss'
  );
}


function getPhase3DayRange_(dateValue) {
  const date = toPhase3Date_(dateValue);

  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0);

  return {
    start: start,
    end: end,
  };
}


function sortPhase3ByStartTime_(a, b) {
  return toPhase3Date_(a.start_time).getTime() - toPhase3Date_(b.start_time).getTime();
}


function makePhase3Id_(prefix, isTest) {
  return (isTest ? 'TEST_' : '') + prefix + Utilities.getUuid();
}


function phase3Ok_(data, message) {
  return {
    ok: true,
    data: data,
    message: message || '',
  };
}


function phase3Fail_(message, detail) {
  return {
    ok: false,
    data: detail || null,
    message: message || '오류가 발생했습니다.',
  };
}


/**
 * Phase 3 테스트
 */
function TEST_runPhase3() {
  const tests = [];

  try {
    TEST_resetPhase3Data_();

    tests.push(TEST_phase3CreateReservation_());
    tests.push(TEST_phase3CreateWithoutTitle_());
    tests.push(TEST_phase3InvalidTime_());
    tests.push(TEST_phase3SafetyRequired_());
    tests.push(TEST_phase3DescriptionOptional_());
    tests.push(TEST_phase3ImmediateStart_());
    tests.push(TEST_phase3ConflictDetected_());
    tests.push(TEST_phase3ConflictAllowedWithAck_());
    tests.push(TEST_phase3ConflictRejectedWithoutAck_());
    tests.push(TEST_phase3StatusTransitions_());
    tests.push(TEST_phase3CompleteCannotRestart_());
    tests.push(TEST_phase3AdminDelete_());
    tests.push(TEST_phase3CurrentReservation_());
  } catch (error) {
    tests.push(makePhase3TestResult_(
      'RES-ERROR',
      'Phase 3 테스트 실행 오류',
      false,
      '정상 실행',
      error.message,
      error.message
    ));
  } finally {
    TEST_resetPhase3Data_();
  }

  const response = buildPhase3TestResponse_(tests);

  Logger.log(JSON.stringify(response, null, 2));

  return response;
}


function TEST_phase3CreateReservation_() {
  return safePhase3Test_('RES-01', '정상 예약 생성', function() {
    const result = createReservation(makePhase3TestPayload_('정상 예약 생성', 9, 10, true, true));

    const passed = result.ok && result.data.status === '예약';

    return makePhase3TestResult_(
      'RES-01',
      '정상 예약 생성',
      passed,
      'status=예약',
      result.message,
      passed ? '정상 예약 생성 성공' : '정상 예약 생성 실패'
    );
  });
}


function TEST_phase3CreateWithoutTitle_() {
  return safePhase3Test_('RES-02', '작업명 필수', function() {
    const payload = makePhase3TestPayload_('', 10, 11, true, true);
    const result = createReservation(payload);

    const passed = result.ok === false;

    return makePhase3TestResult_(
      'RES-02',
      '작업명 필수',
      passed,
      '예약 실패',
      result.message,
      passed ? '작업명 필수 검증 성공' : '작업명 필수 검증 실패'
    );
  });
}


function TEST_phase3InvalidTime_() {
  return safePhase3Test_('RES-03', '시간 범위 검증', function() {
    const result = createReservation(makePhase3TestPayload_('시간 오류', 11, 10, true, true));

    const passed = result.ok === false;

    return makePhase3TestResult_(
      'RES-03',
      '시간 범위 검증',
      passed,
      '예약 실패',
      result.message,
      passed ? '시간 범위 검증 성공' : '시간 범위 검증 실패'
    );
  });
}


function TEST_phase3SafetyRequired_() {
  return safePhase3Test_('RES-04', '안전 확인 필수', function() {
    const result = createReservation(makePhase3TestPayload_('안전 확인 없음', 12, 13, false, true));

    const passed = result.ok === false;

    return makePhase3TestResult_(
      'RES-04',
      '안전 확인 필수',
      passed,
      '예약 실패',
      result.message,
      passed ? '안전 확인 검증 성공' : '안전 확인 검증 실패'
    );
  });
}


function TEST_phase3DescriptionOptional_() {
  return safePhase3Test_('RES-05', '작업 설명 선택 입력', function() {
    const payload = makePhase3TestPayload_('작업 설명 없음', 13, 14, true, true);
    payload.work_description = '';

    const result = createReservation(payload);

    const passed = result.ok === true;

    return makePhase3TestResult_(
      'RES-05',
      '작업 설명 선택 입력',
      passed,
      '예약 성공',
      result.message,
      passed ? '작업 설명 선택 입력 확인 성공' : '작업 설명 선택 입력 확인 실패'
    );
  });
}


function TEST_phase3ImmediateStart_() {
  return safePhase3Test_('RES-06', '즉시 사용 시작', function() {
    const result = createImmediateReservation({
      __test: true,
      work_type: PHASE1_CONFIG.WORK_TYPES[0],
      work_title: '즉시 사용 시작 테스트',
      work_description: '',
      expected_minutes: 60,
      safety_confirmed: true,
      conflict_acknowledged: true,
    });

    const passed = result.ok && result.data.status === '사용중';

    return makePhase3TestResult_(
      'RES-06',
      '즉시 사용 시작',
      passed,
      'status=사용중',
      result.message,
      passed ? '즉시 사용 시작 성공' : '즉시 사용 시작 실패'
    );
  });
}


function TEST_phase3ConflictDetected_() {
  return safePhase3Test_('CONFLICT-01', '충돌 감지', function() {
    const first = createReservation(makePhase3TestPayload_('충돌 기준 예약', 15, 16, true, true));
    const conflict = checkConflicts(
      makePhase3TestDate_(15, 30),
      makePhase3TestDate_(16, 30),
      ''
    );

    const passed = first.ok && conflict.ok && conflict.data.length > 0;

    return makePhase3TestResult_(
      'CONFLICT-01',
      '충돌 감지',
      passed,
      '충돌 목록 1개 이상',
      conflict.message,
      passed ? '충돌 감지 성공' : '충돌 감지 실패'
    );
  });
}


function TEST_phase3ConflictAllowedWithAck_() {
  return safePhase3Test_('CONFLICT-02', '충돌 확인 후 저장', function() {
    const first = createReservation(makePhase3TestPayload_('충돌 허용 기준', 16, 17, true, true));
    const second = createReservation(makePhase3TestPayload_('충돌 허용 대상', 16, 17, true, true));

    const passed = first.ok && second.ok;

    return makePhase3TestResult_(
      'CONFLICT-02',
      '충돌 확인 후 저장',
      passed,
      '둘 다 저장 성공',
      'first=' + first.ok + ', second=' + second.ok,
      passed ? '충돌 확인 후 저장 성공' : '충돌 확인 후 저장 실패'
    );
  });
}


function TEST_phase3ConflictRejectedWithoutAck_() {
  return safePhase3Test_('CONFLICT-03', '충돌 미확인 저장 거부', function() {
    const first = createReservation(makePhase3TestPayload_('충돌 거부 기준', 17, 18, true, true));
    const second = createReservation(makePhase3TestPayload_('충돌 거부 대상', 17, 18, true, false));

    const passed = first.ok && second.ok === false;

    return makePhase3TestResult_(
      'CONFLICT-03',
      '충돌 미확인 저장 거부',
      passed,
      '첫 번째 성공, 두 번째 실패',
      'first=' + first.ok + ', second=' + second.ok + ', message=' + second.message,
      passed ? '충돌 미확인 저장 거부 성공' : '충돌 미확인 저장 거부 실패'
    );
  });
}


function TEST_phase3StatusTransitions_() {
  return safePhase3Test_('STATUS-01', '상태 전환', function() {
    const created = createReservation(makePhase3TestPayload_('상태 전환 테스트', 18, 19, true, true));

    if (!created.ok) {
      return makePhase3TestResult_('STATUS-01', '상태 전환', false, '예약 생성', created.message, '예약 생성 실패');
    }

    const started = startReservation(created.data.reservation_id);
    const completed = completeReservation(created.data.reservation_id);

    const passed = started.ok && completed.ok && completed.data.status === '완료';

    return makePhase3TestResult_(
      'STATUS-01',
      '상태 전환',
      passed,
      '예약 → 사용중 → 완료',
      'started=' + started.ok + ', completed=' + completed.ok,
      passed ? '상태 전환 성공' : '상태 전환 실패'
    );
  });
}


function TEST_phase3CompleteCannotRestart_() {
  return safePhase3Test_('STATUS-02', '완료 예약 재시작 불가', function() {
    const created = createReservation(makePhase3TestPayload_('완료 후 재시작 테스트', 19, 20, true, true));
    startReservation(created.data.reservation_id);
    completeReservation(created.data.reservation_id);

    const restarted = startReservation(created.data.reservation_id);

    const passed = restarted.ok === false;

    return makePhase3TestResult_(
      'STATUS-02',
      '완료 예약 재시작 불가',
      passed,
      '재시작 실패',
      restarted.message,
      passed ? '완료 예약 재시작 방지 성공' : '완료 예약 재시작 방지 실패'
    );
  });
}


function TEST_phase3AdminDelete_() {
  return safePhase3Test_('STATUS-03', '관리자 삭제 처리', function() {
    const created = createReservation(makePhase3TestPayload_('관리자 삭제 테스트', 20, 21, true, true));
    const deleted = adminDeleteReservation(created.data.reservation_id);

    const passed = deleted.ok && deleted.data.status === '삭제됨';

    return makePhase3TestResult_(
      'STATUS-03',
      '관리자 삭제 처리',
      passed,
      'status=삭제됨',
      deleted.message,
      passed ? '관리자 삭제 처리 성공' : '관리자 삭제 처리 실패'
    );
  });
}


function TEST_phase3CurrentReservation_() {
  return safePhase3Test_('CUR-01', '현재 사용자 조회', function() {
    const result = createImmediateReservation({
      __test: true,
      work_type: PHASE1_CONFIG.WORK_TYPES[0],
      work_title: '현재 사용자 조회 테스트',
      work_description: '',
      expected_minutes: 60,
      safety_confirmed: true,
      conflict_acknowledged: true,
    });

    const current = getCurrentReservation();

    const passed = result.ok &&
      current.ok &&
      current.data &&
      current.data.status === '사용중';

    return makePhase3TestResult_(
      'CUR-01',
      '현재 사용자 조회',
      passed,
      '현재 사용중 예약 조회',
      current.message,
      passed ? '현재 사용자 조회 성공' : '현재 사용자 조회 실패'
    );
  });
}


function makePhase3TestPayload_(title, startHour, endHour, safetyConfirmed, conflictAcknowledged) {
  return {
    __test: true,
    work_type: PHASE1_CONFIG.WORK_TYPES[0],
    work_title: title,
    work_description: 'TEST_PHASE3',
    start_time: makePhase3TestDate_(startHour, 0),
    end_time: makePhase3TestDate_(endHour, 0),
    safety_confirmed: safetyConfirmed,
    conflict_acknowledged: conflictAcknowledged,
  };
}


function makePhase3TestDate_(hour, minute) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour, minute || 0, 0);
}


function TEST_resetPhase3Data_() {
  TEST_deletePhase3RowsByPrefix_(PHASE1_CONFIG.SHEETS.RESERVATIONS, 'reservation_id', 'TEST_RES_');
  TEST_deletePhase3RowsByPrefix_(PHASE1_CONFIG.SHEETS.USAGE_LOG, 'log_id', 'TEST_LOG_');
}


function TEST_deletePhase3RowsByPrefix_(sheetName, keyColumn, prefix) {
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


function safePhase3Test_(code, name, callback) {
  try {
    return callback();
  } catch (error) {
    return makePhase3TestResult_(
      code,
      name,
      false,
      '정상 실행',
      error.message,
      error.message
    );
  }
}


function makePhase3TestResult_(code, name, passed, expected, actual, message) {
  return {
    code: code,
    name: name,
    passed: passed,
    expected: expected,
    actual: actual,
    message: message,
  };
}


function buildPhase3TestResponse_(tests) {
  const passed = tests.filter(function(test) {
    return test.passed;
  }).length;

  const failed = tests.length - passed;

  return {
    ok: failed === 0,
    message: failed === 0
      ? 'Phase 3 테스트를 모두 통과했습니다.'
      : 'Phase 3 테스트 중 실패 항목이 있습니다.',
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