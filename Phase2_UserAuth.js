/**
 * Phase 2 - 사용자 / 권한 서비스
 *
 * 전제:
 * - Phase1_Setup.gs가 이미 적용되어 있어야 한다.
 * - PHASE1_CONFIG, getPhase1Database_() 등이 존재해야 한다.
 * - Users 시트가 생성되어 있어야 한다.
 */


/**
 * 현재 접속자 정보 조회
 * 프론트에서도 호출할 수 있는 공개 함수
 */
function getCurrentUser() {
  try {
    const email = getPhase2ActiveEmail_();

    if (!email) {
      return phase2Ok_({
        registered: false,
        active: false,
        email: '',
        user: null,
        reason: 'NO_ACTIVE_EMAIL',
      }, '접속자 이메일을 확인할 수 없습니다.');
    }

    const user = findPhase2UserByEmail_(email);

    if (!user) {
      return phase2Ok_({
        registered: false,
        active: false,
        email: email,
        user: null,
        reason: 'UNREGISTERED',
      }, '등록되지 않은 사용자입니다.');
    }

    if (!toPhase2Boolean_(user.active)) {
      return phase2Ok_({
        registered: true,
        active: false,
        email: email,
        user: sanitizePhase2User_(user),
        reason: 'INACTIVE',
      }, '비활성화된 사용자입니다.');
    }

    return phase2Ok_({
      registered: true,
      active: true,
      email: email,
      user: sanitizePhase2User_(user),
      reason: '',
    }, '현재 사용자 확인 성공');
  } catch (error) {
    return phase2Fail_(error.message);
  }
}


/**
 * 활성 사용자 목록 조회
 * 일반 화면에서 조율용 연락처 표시 등에 사용할 수 있음
 */
function getActiveUsers() {
  try {
    const currentUser = requirePhase2ActiveUser_();

    const users = getPhase2Users_()
      .filter(function(user) {
        return toPhase2Boolean_(user.active);
      })
      .map(sanitizePhase2User_)
      .sort(sortPhase2Users_);

    return phase2Ok_({
      currentUser: sanitizePhase2User_(currentUser),
      users: users,
    }, '활성 사용자 목록 조회 성공');
  } catch (error) {
    return phase2Fail_(error.message);
  }
}


/**
 * 관리자용 전체 사용자 조회
 */
function adminGetUsers() {
  try {
    requirePhase2Admin_();

    const users = getPhase2Users_()
      .map(sanitizePhase2User_)
      .sort(sortPhase2Users_);

    return phase2Ok_(users, '사용자 목록 조회 성공');
  } catch (error) {
    return phase2Fail_(error.message);
  }
}


/**
 * 관리자용 사용자 추가
 */
function adminCreateUser(payload) {
  try {
    requirePhase2Admin_();

    const cleanPayload = validatePhase2CreateUserPayload_(payload);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const existing = findPhase2UserByEmail_(cleanPayload.email);

      if (existing) {
        return phase2Fail_('이미 등록된 이메일입니다: ' + cleanPayload.email);
      }

      const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.USERS);
      const headers = getPhase2Headers_(sheet);

      const now = new Date();

      const rowObject = {
        user_id: (payload && payload.__test ? 'TEST_USR_' : 'USR_') + Utilities.getUuid(),
        department: cleanPayload.department,
        name: cleanPayload.name,
        extension: cleanPayload.extension,
        email: cleanPayload.email,
        role: cleanPayload.role,
        active: cleanPayload.active,
        is_auth_manager: cleanPayload.is_auth_manager,
        sort_order: cleanPayload.sort_order,
        created_at: now,
        updated_at: '',
      };

      appendPhase2ObjectRow_(sheet, headers, rowObject);

      return phase2Ok_(sanitizePhase2User_(rowObject), '사용자 등록 성공');
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase2Fail_(error.message);
  }
}


function adminBulkCreateUsers(payload) {
  try {
    requirePhase2Admin_();

    const rows = getPhase2BulkCreateUserRows_(payload);

    if (rows.length === 0) {
      return phase2Fail_('등록할 사용자가 없습니다.', {
        results: [],
      });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const existingUsers = getPhase2Users_();
      const validation = validatePhase2BulkCreateUserRows_(rows, existingUsers);

      if (!validation.ok) {
        return phase2Fail_('CSV 일괄 등록 검증에 실패했습니다.', {
          results: validation.results,
        });
      }

      const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.USERS);
      const headers = getPhase2Headers_(sheet);
      const now = new Date();
      const isTestMode = isPhase2BulkCreateTestPayload_(payload, rows);

      const rowObjects = validation.users.map(function(user) {
        return {
          user_id: (isTestMode ? 'TEST_USR_' : 'USR_') + Utilities.getUuid(),
          department: user.department,
          name: user.name,
          extension: user.extension,
          email: user.email,
          role: user.role,
          active: user.active,
          is_auth_manager: user.is_auth_manager,
          sort_order: user.sort_order,
          created_at: now,
          updated_at: '',
        };
      });

      appendPhase2ObjectRows_(sheet, headers, rowObjects);

      return phase2Ok_({
        created_count: rowObjects.length,
        users: rowObjects.map(sanitizePhase2User_),
        results: validation.results,
      }, '사용자 CSV 일괄 등록 성공');
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase2Fail_(error.message);
  }
}


/**
 * 관리자용 사용자 수정
 *
 * 이메일은 수정하지 않는다.
 * payload.email이 기존 이메일과 다르면 오류 처리한다.
 */
function adminUpdateUser(userId, payload) {
  try {
    requirePhase2Admin_();

    if (!userId) {
      return phase2Fail_('user_id가 필요합니다.');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const user = findPhase2UserById_(userId);

      if (!user) {
        return phase2Fail_('사용자를 찾을 수 없습니다: ' + userId);
      }

      const cleanPayload = validatePhase2UpdateUserPayload_(payload, user);

      const nextRole = cleanPayload.role !== undefined ? cleanPayload.role : String(user.role || '').trim();
      const nextActive = cleanPayload.active !== undefined ? cleanPayload.active : toPhase2Boolean_(user.active);

      if (!hasAtLeastOneActiveAdminAfterChange_(userId, nextRole, nextActive)) {
        return phase2Fail_('최소 1명의 활성 관리자는 유지되어야 합니다.');
      }

      const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.USERS);
      const headers = getPhase2Headers_(sheet);

      const patch = {
        department: cleanPayload.department,
        name: cleanPayload.name,
        extension: cleanPayload.extension,
        role: cleanPayload.role,
        active: cleanPayload.active,
        is_auth_manager: cleanPayload.is_auth_manager,
        sort_order: cleanPayload.sort_order,
        updated_at: new Date(),
      };

      updatePhase2RowByNumber_(sheet, headers, user._rowNumber, patch);

      const updatedUser = findPhase2UserById_(userId);

      return phase2Ok_(sanitizePhase2User_(updatedUser), '사용자 수정 성공');
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase2Fail_(error.message);
  }
}


/**
 * 관리자용 사용자 비활성화
 */
function adminDeactivateUser(userId) {
  try {
    requirePhase2Admin_();

    if (!userId) {
      return phase2Fail_('user_id가 필요합니다.');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const user = findPhase2UserById_(userId);

      if (!user) {
        return phase2Fail_('사용자를 찾을 수 없습니다: ' + userId);
      }

      if (!hasAtLeastOneActiveAdminAfterChange_(userId, String(user.role || '').trim(), false)) {
        return phase2Fail_('최소 1명의 활성 관리자는 유지되어야 합니다.');
      }

      const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.USERS);
      const headers = getPhase2Headers_(sheet);

      updatePhase2RowByNumber_(sheet, headers, user._rowNumber, {
        active: false,
        updated_at: new Date(),
      });

      const updatedUser = findPhase2UserById_(userId);

      return phase2Ok_(sanitizePhase2User_(updatedUser), '사용자 비활성화 성공');
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase2Fail_(error.message);
  }
}


/**
 * 현재 접속자 이메일
 */
function getPhase2ActiveEmail_() {
  return normalizePhase2Email_(Session.getActiveUser().getEmail());
}


/**
 * 현재 접속자가 등록된 활성 사용자여야 함
 */
function requirePhase2ActiveUser_() {
  const email = getPhase2ActiveEmail_();

  if (!email) {
    throw new Error('접속자 이메일을 확인할 수 없습니다.');
  }

  const user = findPhase2UserByEmail_(email);

  if (!user) {
    throw new Error('등록되지 않은 사용자입니다: ' + email);
  }

  if (!toPhase2Boolean_(user.active)) {
    throw new Error('비활성화된 사용자입니다: ' + email);
  }

  return user;
}


/**
 * 현재 접속자가 관리자 또는 보조관리자여야 함
 */
function requirePhase2Admin_() {
  const user = requirePhase2ActiveUser_();

  assertPhase2AdminUser_(user);

  return user;
}


function assertPhase2AdminUser_(user) {
  if (!isPhase2AdminRole_(user.role)) {
    throw new Error('관리자 권한이 필요합니다.');
  }
}


function isPhase2AdminRole_(role) {
  const cleanRole = String(role || '').trim();

  return cleanRole === 'admin' || cleanRole === 'subadmin';
}


function findPhase2UserByEmail_(email) {
  const targetEmail = normalizePhase2Email_(email);

  if (!targetEmail) {
    return null;
  }

  const users = getPhase2Users_();

  for (let i = 0; i < users.length; i++) {
    if (normalizePhase2Email_(users[i].email) === targetEmail) {
      return users[i];
    }
  }

  return null;
}


function findPhase2UserById_(userId) {
  const targetId = String(userId || '').trim();

  if (!targetId) {
    return null;
  }

  const users = getPhase2Users_();

  for (let i = 0; i < users.length; i++) {
    if (String(users[i].user_id || '').trim() === targetId) {
      return users[i];
    }
  }

  return null;
}


function getPhase2Users_() {
  const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.USERS);
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


function getPhase2Sheet_(sheetName) {
  const ss = getPhase1Database_();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('시트를 찾을 수 없습니다: ' + sheetName);
  }

  return sheet;
}


function getPhase2Headers_(sheet) {
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


function appendPhase2ObjectRow_(sheet, headers, rowObject) {
  const values = headers.map(function(header) {
    return rowObject[header] !== undefined ? rowObject[header] : '';
  });

  sheet.appendRow(values);
}


function appendPhase2ObjectRows_(sheet, headers, rowObjects) {
  const safeRows = Array.isArray(rowObjects) ? rowObjects : [];

  if (safeRows.length === 0) {
    return;
  }

  const values = safeRows.map(function(rowObject) {
    return headers.map(function(header) {
      return rowObject[header] !== undefined ? rowObject[header] : '';
    });
  });

  sheet
    .getRange(sheet.getLastRow() + 1, 1, values.length, headers.length)
    .setValues(values);
}


function updatePhase2RowByNumber_(sheet, headers, rowNumber, patch) {
  if (!rowNumber || rowNumber < 2) {
    throw new Error('수정할 행 번호가 올바르지 않습니다.');
  }

  const range = sheet.getRange(rowNumber, 1, 1, headers.length);
  const values = range.getValues()[0];

  headers.forEach(function(header, index) {
    if (patch[header] !== undefined) {
      values[index] = patch[header];
    }
  });

  range.setValues([values]);
}


function validatePhase2CreateUserPayload_(payload) {
  const data = payload || {};

  const email = normalizePhase2Email_(data.email);
  const role = normalizePhase2Role_(data.role || 'user');

  if (!email) {
    throw new Error('이메일을 입력해 주세요.');
  }

  if (!isPhase2SchoolEmail_(email)) {
    throw new Error('학교 도메인 계정만 등록할 수 있습니다: ' + email);
  }

  if (!data.name || !String(data.name).trim()) {
    throw new Error('이름을 입력해 주세요.');
  }

  if (!data.department || !String(data.department).trim()) {
    throw new Error('부서를 입력해 주세요.');
  }

  return {
    department: String(data.department || '').trim(),
    name: String(data.name || '').trim(),
    extension: String(data.extension || '').trim(),
    email: email,
    role: role,
    active: data.active === undefined ? true : toPhase2Boolean_(data.active),
    is_auth_manager: data.is_auth_manager === undefined ? false : toPhase2Boolean_(data.is_auth_manager),
    sort_order: data.sort_order === undefined || data.sort_order === '' ? '' : Number(data.sort_order),
  };
}


function validatePhase2UpdateUserPayload_(payload, existingUser) {
  const data = payload || {};

  if (data.email !== undefined) {
    const nextEmail = normalizePhase2Email_(data.email);
    const currentEmail = normalizePhase2Email_(existingUser.email);

    if (nextEmail && nextEmail !== currentEmail) {
      throw new Error('이메일은 수정할 수 없습니다.');
    }
  }

  const result = {};

  if (data.department !== undefined) {
    const department = String(data.department || '').trim();

    if (!department) {
      throw new Error('부서를 입력해 주세요.');
    }

    result.department = department;
  }

  if (data.name !== undefined) {
    const name = String(data.name || '').trim();

    if (!name) {
      throw new Error('이름을 입력해 주세요.');
    }

    result.name = name;
  }

  if (data.extension !== undefined) {
    result.extension = String(data.extension || '').trim();
  }

  if (data.role !== undefined) {
    result.role = normalizePhase2Role_(data.role);
  }

  if (data.active !== undefined) {
    result.active = toPhase2Boolean_(data.active);
  }

  if (data.is_auth_manager !== undefined) {
    result.is_auth_manager = toPhase2Boolean_(data.is_auth_manager);
  }

  if (data.sort_order !== undefined) {
    result.sort_order = data.sort_order === '' ? '' : Number(data.sort_order);
  }

  return result;
}


function getPhase2BulkCreateUserRows_(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.users)) {
    return payload.users;
  }

  return [];
}


function isPhase2BulkCreateTestPayload_(payload, rows) {
  if (payload && payload.__test === true) {
    return true;
  }

  const safeRows = Array.isArray(rows) ? rows : [];

  for (let i = 0; i < safeRows.length; i++) {
    if (safeRows[i] && safeRows[i].__test === true) {
      return true;
    }
  }

  return false;
}


function validatePhase2BulkCreateUserRows_(rows, existingUsers) {
  const results = [];
  const cleanUsers = [];
  const existingEmailMap = {};
  const uploadEmailMap = {};

  (existingUsers || []).forEach(function(user) {
    const email = normalizePhase2Email_(user.email);

    if (email) {
      existingEmailMap[email] = true;
    }
  });

  rows.forEach(function(row, index) {
    const rowNumber = getPhase2BulkRowNumber_(row, index);
    const result = {
      row_number: rowNumber,
      email: normalizePhase2Email_(row && row.email),
      ok: true,
      message: '검증 성공',
    };

    try {
      const cleanUser = validatePhase2BulkCreateUserRow_(row);

      result.email = cleanUser.email;

      if (existingEmailMap[cleanUser.email]) {
        throw new Error('이미 등록된 이메일입니다: ' + cleanUser.email);
      }

      if (uploadEmailMap[cleanUser.email]) {
        throw new Error('CSV 내부 중복 이메일입니다: ' + cleanUser.email);
      }

      uploadEmailMap[cleanUser.email] = true;
      cleanUser._csvRowNumber = rowNumber;
      cleanUsers.push(cleanUser);
    } catch (error) {
      result.ok = false;
      result.message = '행 ' + rowNumber + ': ' + error.message;
    }

    results.push(result);
  });

  const failed = results.some(function(result) {
    return result.ok === false;
  });

  return {
    ok: failed === false,
    users: failed ? [] : cleanUsers,
    results: results,
  };
}


function getPhase2BulkRowNumber_(row, index) {
  if (row && row.row_number !== undefined && row.row_number !== '') {
    const rowNumber = Number(row.row_number);

    if (isFinite(rowNumber) && rowNumber >= 1) {
      return rowNumber;
    }
  }

  return index + 2;
}


function validatePhase2BulkCreateUserRow_(row) {
  const data = row || {};
  const email = normalizePhase2Email_(data.email);

  if (!email) {
    throw new Error('이메일을 입력해 주세요.');
  }

  if (!isPhase2SchoolEmail_(email)) {
    throw new Error('학교 도메인 계정만 등록할 수 있습니다: ' + email);
  }

  const name = String(data.name || '').trim();

  if (!name) {
    throw new Error('이름을 입력해 주세요.');
  }

  const department = String(data.department || '').trim();

  if (!department) {
    throw new Error('부서를 입력해 주세요.');
  }

  const role = data.role === undefined || String(data.role || '').trim() === ''
    ? 'user'
    : normalizePhase2Role_(data.role);

  return {
    department: department,
    name: name,
    extension: String(data.extension || '').trim(),
    email: email,
    role: role,
    active: normalizePhase2BulkBoolean_(data.active, true, 'active'),
    is_auth_manager: normalizePhase2BulkBoolean_(data.is_auth_manager, false, 'is_auth_manager'),
    sort_order: normalizePhase2BulkSortOrder_(data.sort_order),
  };
}


function normalizePhase2BulkBoolean_(value, defaultValue, fieldName) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultValue === true;
  }

  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  const text = String(value || '').trim().toLowerCase();

  const trueValues = ['true', '1', 'yes', 'y', '예', '활성'];
  const falseValues = ['false', '0', 'no', 'n', '아니오', '비활성'];

  if (trueValues.indexOf(text) !== -1) {
    return true;
  }

  if (falseValues.indexOf(text) !== -1) {
    return false;
  }

  throw new Error(fieldName + ' 값은 true/false, 1/0, 예/아니오, 활성/비활성 중 하나여야 합니다.');
}


function normalizePhase2BulkSortOrder_(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return '';
  }

  const numberValue = Number(value);

  if (!isFinite(numberValue) || Math.floor(numberValue) !== numberValue || numberValue < 0) {
    throw new Error('sort_order는 빈 값 또는 0 이상의 정수여야 합니다.');
  }

  return numberValue;
}


function normalizePhase2Role_(role) {
  const cleanRole = String(role || '').trim();

  if (PHASE1_CONFIG.ROLES.indexOf(cleanRole) === -1) {
    throw new Error('올바르지 않은 권한입니다: ' + cleanRole);
  }

  return cleanRole;
}


function hasAtLeastOneActiveAdminAfterChange_(targetUserId, nextRole, nextActive) {
  return hasAtLeastOneActivePrimaryAdminInListAfterChange_(
    getPhase2Users_(),
    targetUserId,
    nextRole,
    nextActive
  );
}


function hasAtLeastOneActivePrimaryAdminInListAfterChange_(users, targetUserId, nextRole, nextActive) {
  const safeUsers = Array.isArray(users) ? users : [];

  let count = 0;

  safeUsers.forEach(function(user) {
    const userId = String(user.user_id || '').trim();

    let role = String(user.role || '').trim();
    let active = toPhase2Boolean_(user.active);

    if (userId === targetUserId) {
      role = String(nextRole || '').trim();
      active = toPhase2Boolean_(nextActive);
    }

    if (active && isPhase2PrimaryAdminRole_(role)) {
      count++;
    }
  });

  return count >= 1;
}


function isPhase2PrimaryAdminRole_(role) {
  return String(role || '').trim() === 'admin';
}


function isPhase2SchoolEmail_(email) {
  return normalizePhase2Email_(email).endsWith('@' + PHASE1_CONFIG.SCHOOL_DOMAIN);
}


function normalizePhase2Email_(email) {
  return String(email || '').trim().toLowerCase();
}


function toPhase2Boolean_(value) {
  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  const text = String(value || '').trim().toLowerCase();

  return text === 'true' || text === '1' || text === 'yes' || text === 'y';
}


function sanitizePhase2User_(user) {
  if (!user) {
    return null;
  }

  return {
    user_id: String(user.user_id || '').trim(),
    department: String(user.department || '').trim(),
    name: String(user.name || '').trim(),
    extension: String(user.extension || '').trim(),
    email: normalizePhase2Email_(user.email),
    role: String(user.role || '').trim(),
    active: toPhase2Boolean_(user.active),
    is_auth_manager: toPhase2Boolean_(user.is_auth_manager),
    sort_order: user.sort_order === '' ? '' : user.sort_order,
  };
}


function sortPhase2Users_(a, b) {
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


function phase2Ok_(data, message) {
  return {
    ok: true,
    data: data,
    message: message || '',
  };
}


function phase2Fail_(message, detail) {
  return {
    ok: false,
    data: detail || null,
    message: message || '오류가 발생했습니다.',
  };
}


/**
 * Phase 2 테스트 실행
 * 관리자 계정으로 Apps Script 편집기에서 실행한다.
 */
function TEST_runPhase2() {
  const tests = [];

  try {
    TEST_resetPhase2Data_();

    tests.push(TEST_phase2CurrentUser_());
    tests.push(TEST_phase2CreateUser_());
    tests.push(TEST_phase2DuplicateEmail_());
    tests.push(TEST_phase2InvalidDomain_());
    tests.push(TEST_phase2UpdateUser_());
    tests.push(TEST_phase2EmailImmutable_());
    tests.push(TEST_phase2DeactivateUser_());
    tests.push(TEST_phase2ActiveUsers_());
    tests.push(TEST_phase2AdminRoleHelper_());
    tests.push(TEST_phase2MinimumActivePrimaryAdmin_());
  } catch (error) {
    tests.push(makePhase2TestResult_(
      'USER-ERROR',
      'Phase 2 테스트 실행 오류',
      false,
      '정상 실행',
      error.message,
      error.message
    ));
  } finally {
    TEST_resetPhase2Data_();
  }

  const response = buildPhase2TestResponse_(tests);

  Logger.log(JSON.stringify(response, null, 2));

  return response;
}


function TEST_phase2CurrentUser_() {
  return safePhase2Test_('USER-01', '현재 접속자 확인', function() {
    const result = getCurrentUser();

    const passed = result.ok &&
      result.data &&
      result.data.registered === true &&
      result.data.active === true &&
      result.data.user &&
      isPhase2AdminRole_(result.data.user.role);

    return makePhase2TestResult_(
      'USER-01',
      '현재 접속자 확인',
      passed,
      '현재 접속자가 등록된 활성 관리자',
      result.message,
      passed ? '현재 접속자 확인 성공' : '현재 접속자 확인 실패'
    );
  });
}


function TEST_phase2CreateUser_() {
  return safePhase2Test_('USER-02', '사용자 추가', function() {
    const result = adminCreateUser({
      __test: true,
      department: '테스트부',
      name: '테스트사용자',
      extension: '0001',
      email: 'test.phase2.create@senedu.kr',
      role: 'user',
      active: true,
      is_auth_manager: false,
      sort_order: 100,
    });

    const passed = result.ok &&
      result.data &&
      result.data.email === 'test.phase2.create@senedu.kr';

    return makePhase2TestResult_(
      'USER-02',
      '사용자 추가',
      passed,
      '사용자 등록 성공',
      result.message,
      passed ? '사용자 추가 성공' : '사용자 추가 실패'
    );
  });
}


function TEST_phase2DuplicateEmail_() {
  return safePhase2Test_('USER-03', '동일 이메일 중복 등록 방지', function() {
    const payload = {
      __test: true,
      department: '테스트부',
      name: '중복테스트',
      extension: '0002',
      email: 'test.phase2.duplicate@senedu.kr',
      role: 'user',
      active: true,
    };

    const first = adminCreateUser(payload);
    const second = adminCreateUser(payload);

    const passed = first.ok === true && second.ok === false;

    return makePhase2TestResult_(
      'USER-03',
      '동일 이메일 중복 등록 방지',
      passed,
      '첫 번째 성공, 두 번째 실패',
      'first=' + first.ok + ', second=' + second.ok + ', message=' + second.message,
      passed ? '중복 이메일 방지 성공' : '중복 이메일 방지 실패'
    );
  });
}


function TEST_phase2InvalidDomain_() {
  return safePhase2Test_('USER-04', '외부 도메인 등록 방지', function() {
    const result = adminCreateUser({
      __test: true,
      department: '테스트부',
      name: '외부도메인',
      extension: '0003',
      email: 'external@example.com',
      role: 'user',
      active: true,
    });

    const passed = result.ok === false;

    return makePhase2TestResult_(
      'USER-04',
      '외부 도메인 등록 방지',
      passed,
      'senedu.kr 외 도메인 등록 실패',
      result.message,
      passed ? '외부 도메인 등록 방지 성공' : '외부 도메인 등록 방지 실패'
    );
  });
}


function TEST_phase2UpdateUser_() {
  return safePhase2Test_('USER-05', '사용자 정보 수정', function() {
    const created = adminCreateUser({
      __test: true,
      department: '테스트부',
      name: '수정전',
      extension: '0004',
      email: 'test.phase2.update@senedu.kr',
      role: 'user',
      active: true,
    });

    if (!created.ok) {
      return makePhase2TestResult_(
        'USER-05',
        '사용자 정보 수정',
        false,
        '테스트 사용자 생성',
        created.message,
        '테스트 사용자 생성 실패'
      );
    }

    const updated = adminUpdateUser(created.data.user_id, {
      department: '수정부',
      name: '수정후',
      extension: '9999',
      role: 'subadmin',
      active: true,
      is_auth_manager: true,
      sort_order: 50,
    });

    const passed = updated.ok &&
      updated.data.department === '수정부' &&
      updated.data.name === '수정후' &&
      updated.data.extension === '9999' &&
      updated.data.role === 'subadmin' &&
      updated.data.is_auth_manager === true;

    return makePhase2TestResult_(
      'USER-05',
      '사용자 정보 수정',
      passed,
      '부서, 이름, 내선, 권한 수정 성공',
      updated.message,
      passed ? '사용자 정보 수정 성공' : '사용자 정보 수정 실패'
    );
  });
}


function TEST_phase2EmailImmutable_() {
  return safePhase2Test_('USER-06', '이메일 수정 불가', function() {
    const created = adminCreateUser({
      __test: true,
      department: '테스트부',
      name: '이메일고정',
      extension: '0005',
      email: 'test.phase2.immutable@senedu.kr',
      role: 'user',
      active: true,
    });

    if (!created.ok) {
      return makePhase2TestResult_(
        'USER-06',
        '이메일 수정 불가',
        false,
        '테스트 사용자 생성',
        created.message,
        '테스트 사용자 생성 실패'
      );
    }

    const updated = adminUpdateUser(created.data.user_id, {
      email: 'test.phase2.changed@senedu.kr',
      name: '변경시도',
    });

    const passed = updated.ok === false;

    return makePhase2TestResult_(
      'USER-06',
      '이메일 수정 불가',
      passed,
      '이메일 변경 시도 실패',
      updated.message,
      passed ? '이메일 수정 방지 성공' : '이메일 수정 방지 실패'
    );
  });
}


function TEST_phase2DeactivateUser_() {
  return safePhase2Test_('USER-07', '사용자 비활성화', function() {
    const created = adminCreateUser({
      __test: true,
      department: '테스트부',
      name: '비활성화대상',
      extension: '0006',
      email: 'test.phase2.deactivate@senedu.kr',
      role: 'user',
      active: true,
    });

    if (!created.ok) {
      return makePhase2TestResult_(
        'USER-07',
        '사용자 비활성화',
        false,
        '테스트 사용자 생성',
        created.message,
        '테스트 사용자 생성 실패'
      );
    }

    const deactivated = adminDeactivateUser(created.data.user_id);

    const passed = deactivated.ok &&
      deactivated.data.active === false;

    return makePhase2TestResult_(
      'USER-07',
      '사용자 비활성화',
      passed,
      'active = false',
      deactivated.message,
      passed ? '사용자 비활성화 성공' : '사용자 비활성화 실패'
    );
  });
}


function TEST_phase2ActiveUsers_() {
  return safePhase2Test_('USER-08', '활성 사용자 목록 확인', function() {
    const activeUser = adminCreateUser({
      __test: true,
      department: '테스트부',
      name: '활성사용자',
      extension: '0007',
      email: 'test.phase2.active@senedu.kr',
      role: 'user',
      active: true,
    });

    const inactiveUser = adminCreateUser({
      __test: true,
      department: '테스트부',
      name: '비활성사용자',
      extension: '0008',
      email: 'test.phase2.inactive@senedu.kr',
      role: 'user',
      active: false,
    });

    const listResult = getActiveUsers();

    const emails = listResult.ok
      ? listResult.data.users.map(function(user) { return user.email; })
      : [];

    const passed = activeUser.ok &&
      inactiveUser.ok &&
      emails.indexOf('test.phase2.active@senedu.kr') !== -1 &&
      emails.indexOf('test.phase2.inactive@senedu.kr') === -1;

    return makePhase2TestResult_(
      'USER-08',
      '활성 사용자 목록 확인',
      passed,
      'active=true만 포함',
      listResult.message,
      passed ? '활성 사용자 목록 확인 성공' : '활성 사용자 목록 확인 실패'
    );
  });
}


function TEST_phase2AdminRoleHelper_() {
  return safePhase2Test_('USER-09', '관리자 권한 판정', function() {
    const passed =
      isPhase2AdminRole_('admin') === true &&
      isPhase2AdminRole_('subadmin') === true &&
      isPhase2AdminRole_('user') === false &&
      isPhase2AdminRole_('') === false;

    return makePhase2TestResult_(
      'USER-09',
      '관리자 권한 판정',
      passed,
      'admin/subadmin=true, user=false',
      passed ? '정상' : '비정상',
      passed ? '관리자 권한 판정 성공' : '관리자 권한 판정 실패'
    );
  });
}


function TEST_phase2MinimumActivePrimaryAdmin_() {
  return safePhase2Test_('USER-10', '최소 활성 관리자 유지', function() {
    const users = [
      {
        user_id: 'MOCK_ADMIN_1',
        role: 'admin',
        active: true,
      },
      {
        user_id: 'MOCK_SUBADMIN_1',
        role: 'subadmin',
        active: true,
      },
      {
        user_id: 'MOCK_USER_1',
        role: 'user',
        active: true,
      },
    ];

    const cannotDeactivateOnlyAdmin =
      hasAtLeastOneActivePrimaryAdminInListAfterChange_(
        users,
        'MOCK_ADMIN_1',
        'admin',
        false
      ) === false;

    const cannotDowngradeOnlyAdminToSubadmin =
      hasAtLeastOneActivePrimaryAdminInListAfterChange_(
        users,
        'MOCK_ADMIN_1',
        'subadmin',
        true
      ) === false;

    const canDeactivateOneAdminIfAnotherAdminExists =
      hasAtLeastOneActivePrimaryAdminInListAfterChange_(
        [
          {
            user_id: 'MOCK_ADMIN_1',
            role: 'admin',
            active: true,
          },
          {
            user_id: 'MOCK_ADMIN_2',
            role: 'admin',
            active: true,
          },
          {
            user_id: 'MOCK_SUBADMIN_1',
            role: 'subadmin',
            active: true,
          },
        ],
        'MOCK_ADMIN_1',
        'admin',
        false
      ) === true;

    const passed =
      cannotDeactivateOnlyAdmin &&
      cannotDowngradeOnlyAdminToSubadmin &&
      canDeactivateOneAdminIfAnotherAdminExists;

    return makePhase2TestResult_(
      'USER-10',
      '최소 활성 관리자 유지',
      passed,
      'subadmin만으로는 최소 관리자 유지 조건을 충족하지 않음',
      'cannotDeactivateOnlyAdmin=' + cannotDeactivateOnlyAdmin +
        ', cannotDowngradeOnlyAdminToSubadmin=' + cannotDowngradeOnlyAdminToSubadmin +
        ', canDeactivateOneAdminIfAnotherAdminExists=' + canDeactivateOneAdminIfAnotherAdminExists,
      passed ? '최소 활성 관리자 유지 검증 성공' : '최소 활성 관리자 유지 검증 실패'
    );
  });
}


/**
 * Phase 13-A 테스트 실행 - 사용자 CSV 일괄 등록
 */
function TEST_runPhase13UserBulkCreate() {
  const tests = [];

  try {
    TEST_resetPhase2Data_();

    tests.push(TEST_phase13BulkCreateSuccess_());
    tests.push(TEST_phase13BulkCreateDuplicateInCsv_());
    tests.push(TEST_phase13BulkCreateExistingEmail_());
    tests.push(TEST_phase13BulkCreateInvalidDomain_());
    tests.push(TEST_phase13BulkCreateInvalidRole_());
    tests.push(TEST_phase13BulkCreateInvalidActive_());
    tests.push(TEST_phase13BulkCreateInvalidSortOrder_());
    tests.push(TEST_phase13BulkCreateAllOrNothing_());
  } catch (error) {
    tests.push(makePhase2TestResult_(
      'P13-BULK-ERROR',
      'Phase 13-A 테스트 실행 오류',
      false,
      '정상 실행',
      error.message,
      error.message
    ));
  } finally {
    TEST_resetPhase2Data_();
  }

  const response = buildPhase2TestResponse_(tests);

  Logger.log(JSON.stringify(response, null, 2));

  return response;
}


function TEST_phase13BulkCreateSuccess_() {
  return safePhase2Test_('P13-BULK-01', '사용자 CSV 일괄 등록 성공', function() {
    const result = adminBulkCreateUsers({
      __test: true,
      users: [
        {
          email: 'test.phase13.bulk.success1@senedu.kr',
          name: '일괄성공1',
          department: '테스트부',
          extension: '1301',
          role: 'user',
          active: 'true',
          is_auth_manager: 'false',
          sort_order: '1301',
        },
        {
          email: 'test.phase13.bulk.success2@senedu.kr',
          name: '일괄성공2',
          department: '테스트부',
          extension: '1302',
          role: 'subadmin',
          active: '활성',
          is_auth_manager: '예',
          sort_order: '1302',
        },
      ],
    });

    const created1 = findPhase2UserByEmail_('test.phase13.bulk.success1@senedu.kr');
    const created2 = findPhase2UserByEmail_('test.phase13.bulk.success2@senedu.kr');

    const passed =
      result.ok === true &&
      result.data &&
      result.data.created_count === 2 &&
      created1 !== null &&
      created2 !== null &&
      String(created2.role || '') === 'subadmin' &&
      toPhase2Boolean_(created2.is_auth_manager) === true;

    return makePhase2TestResult_(
      'P13-BULK-01',
      '사용자 CSV 일괄 등록 성공',
      passed,
      '2명 일괄 등록 성공',
      result.message,
      passed ? '사용자 CSV 일괄 등록 성공' : '사용자 CSV 일괄 등록 실패'
    );
  });
}


function TEST_phase13BulkCreateDuplicateInCsv_() {
  return safePhase2Test_('P13-BULK-02', 'CSV 내부 중복 이메일 방지', function() {
    const result = adminBulkCreateUsers({
      __test: true,
      users: [
        {
          email: 'test.phase13.bulk.duplicate@senedu.kr',
          name: '중복1',
          department: '테스트부',
        },
        {
          email: 'TEST.PHASE13.BULK.DUPLICATE@senedu.kr',
          name: '중복2',
          department: '테스트부',
        },
      ],
    });

    const created = findPhase2UserByEmail_('test.phase13.bulk.duplicate@senedu.kr');
    const passed = result.ok === false && created === null;

    return makePhase2TestResult_(
      'P13-BULK-02',
      'CSV 내부 중복 이메일 방지',
      passed,
      '검증 실패 및 저장 없음',
      result.message,
      passed ? 'CSV 내부 중복 이메일 방지 성공' : 'CSV 내부 중복 이메일 방지 실패'
    );
  });
}


function TEST_phase13BulkCreateExistingEmail_() {
  return safePhase2Test_('P13-BULK-03', '기존 사용자 이메일 중복 방지', function() {
    const existing = adminCreateUser({
      __test: true,
      department: '테스트부',
      name: '기존사용자',
      extension: '1303',
      email: 'test.phase13.bulk.existing@senedu.kr',
      role: 'user',
      active: true,
    });

    const result = adminBulkCreateUsers({
      __test: true,
      users: [
        {
          email: 'test.phase13.bulk.existing@senedu.kr',
          name: '중복사용자',
          department: '테스트부',
        },
      ],
    });

    const passed = existing.ok === true && result.ok === false;

    return makePhase2TestResult_(
      'P13-BULK-03',
      '기존 사용자 이메일 중복 방지',
      passed,
      '기존 이메일 포함 시 검증 실패',
      result.message,
      passed ? '기존 사용자 이메일 중복 방지 성공' : '기존 사용자 이메일 중복 방지 실패'
    );
  });
}


function TEST_phase13BulkCreateInvalidDomain_() {
  return safePhase2Test_('P13-BULK-04', 'CSV 외부 도메인 등록 방지', function() {
    const result = adminBulkCreateUsers({
      __test: true,
      users: [
        {
          email: 'test.phase13.external@example.com',
          name: '외부도메인',
          department: '테스트부',
        },
      ],
    });

    const passed = result.ok === false;

    return makePhase2TestResult_(
      'P13-BULK-04',
      'CSV 외부 도메인 등록 방지',
      passed,
      'senedu.kr 외 도메인 검증 실패',
      result.message,
      passed ? 'CSV 외부 도메인 등록 방지 성공' : 'CSV 외부 도메인 등록 방지 실패'
    );
  });
}


function TEST_phase13BulkCreateInvalidRole_() {
  return safePhase2Test_('P13-BULK-05', 'CSV role 검증', function() {
    const result = adminBulkCreateUsers({
      __test: true,
      users: [
        {
          email: 'test.phase13.bulk.invalidrole@senedu.kr',
          name: '권한오류',
          department: '테스트부',
          role: 'manager',
        },
      ],
    });

    const created = findPhase2UserByEmail_('test.phase13.bulk.invalidrole@senedu.kr');
    const passed = result.ok === false && created === null;

    return makePhase2TestResult_(
      'P13-BULK-05',
      'CSV role 검증',
      passed,
      '허용되지 않은 role 검증 실패',
      result.message,
      passed ? 'CSV role 검증 성공' : 'CSV role 검증 실패'
    );
  });
}


function TEST_phase13BulkCreateInvalidActive_() {
  return safePhase2Test_('P13-BULK-06', 'CSV active 검증', function() {
    const result = adminBulkCreateUsers({
      __test: true,
      users: [
        {
          email: 'test.phase13.bulk.invalidactive@senedu.kr',
          name: '활성값오류',
          department: '테스트부',
          active: 'maybe',
        },
      ],
    });

    const created = findPhase2UserByEmail_('test.phase13.bulk.invalidactive@senedu.kr');
    const passed = result.ok === false && created === null;

    return makePhase2TestResult_(
      'P13-BULK-06',
      'CSV active 검증',
      passed,
      '허용되지 않은 active 값 검증 실패',
      result.message,
      passed ? 'CSV active 검증 성공' : 'CSV active 검증 실패'
    );
  });
}


function TEST_phase13BulkCreateInvalidSortOrder_() {
  return safePhase2Test_('P13-BULK-07', 'CSV sort_order 검증', function() {
    const result = adminBulkCreateUsers({
      __test: true,
      users: [
        {
          email: 'test.phase13.bulk.invalidsort@senedu.kr',
          name: '정렬오류',
          department: '테스트부',
          sort_order: '1.5',
        },
      ],
    });

    const created = findPhase2UserByEmail_('test.phase13.bulk.invalidsort@senedu.kr');
    const passed = result.ok === false && created === null;

    return makePhase2TestResult_(
      'P13-BULK-07',
      'CSV sort_order 검증',
      passed,
      '0 이상의 정수가 아닌 sort_order 검증 실패',
      result.message,
      passed ? 'CSV sort_order 검증 성공' : 'CSV sort_order 검증 실패'
    );
  });
}


function TEST_phase13BulkCreateAllOrNothing_() {
  return safePhase2Test_('P13-BULK-08', 'CSV 일괄 등록 all-or-nothing', function() {
    const result = adminBulkCreateUsers({
      __test: true,
      users: [
        {
          email: 'test.phase13.bulk.atomic.valid@senedu.kr',
          name: '정상행',
          department: '테스트부',
        },
        {
          email: 'test.phase13.bulk.atomic.invalid@senedu.kr',
          name: '',
          department: '테스트부',
        },
      ],
    });

    const validCreated = findPhase2UserByEmail_('test.phase13.bulk.atomic.valid@senedu.kr');
    const invalidCreated = findPhase2UserByEmail_('test.phase13.bulk.atomic.invalid@senedu.kr');

    const passed =
      result.ok === false &&
      validCreated === null &&
      invalidCreated === null;

    return makePhase2TestResult_(
      'P13-BULK-08',
      'CSV 일괄 등록 all-or-nothing',
      passed,
      '일부 행 실패 시 전체 저장 없음',
      result.message,
      passed ? 'CSV 일괄 등록 all-or-nothing 성공' : 'CSV 일괄 등록 all-or-nothing 실패'
    );
  });
}


function TEST_resetPhase2Data_() {
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
    const row = values[i];
    const userId = String(row[userIdIndex] || '').trim();
    const email = normalizePhase2Email_(row[emailIndex]);

    if (userId.indexOf('TEST_USR_') === 0 || email.indexOf('test.phase2.') === 0) {
      sheet.deleteRow(i + 2);
    }
  }
}


function safePhase2Test_(code, name, callback) {
  try {
    return callback();
  } catch (error) {
    return makePhase2TestResult_(
      code,
      name,
      false,
      '정상 실행',
      error.message,
      error.message
    );
  }
}


function makePhase2TestResult_(code, name, passed, expected, actual, message) {
  return {
    code: code,
    name: name,
    passed: passed,
    expected: expected,
    actual: actual,
    message: message,
  };
}


function buildPhase2TestResponse_(tests) {
  const passed = tests.filter(function(test) {
    return test.passed;
  }).length;

  const failed = tests.length - passed;

  return {
    ok: failed === 0,
    message: failed === 0
      ? 'Phase 2 테스트를 모두 통과했습니다.'
      : 'Phase 2 테스트 중 실패 항목이 있습니다.',
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