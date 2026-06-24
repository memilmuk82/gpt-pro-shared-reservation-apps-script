/**
 * Phase 9-C - GuideItems 안내 문구 관리 백엔드 / 테스트
 *
 * 전제:
 * - Phase1_Setup.gs 적용 완료
 * - Phase2_UserAuth.gs 적용 완료
 * - Phase4_AppData.gs 적용 완료
 * - Phase9_SettingsManagement.gs 적용 완료
 *
 * 범위:
 * - GuideItems 목록 조회
 * - GuideItems 수정
 * - active 관리
 * - sort_order 관리
 * - HTML 문자열 데이터 보존
 *
 * 제외:
 * - GuideItems 생성
 * - GuideItems 삭제
 * - GuideItems 변경 로그
 */


const PHASE9_GUIDE_CONFIG = Object.freeze({
  MAX_CATEGORY_LENGTH: 50,
  MAX_TITLE_LENGTH: 100,
  MAX_CONTENT_LENGTH: 3000,
  MIN_SORT_ORDER: 0,
  MAX_SORT_ORDER: 999999,
});


/**
 * 관리자: GuideItems 전체 조회
 * active=false 항목도 관리자 화면에서는 표시한다.
 */
function adminGetGuideItems() {
  try {
    requirePhase2Admin_();

    const guides = getPhase9GuideItems_()
      .map(sanitizePhase9GuideItem_)
      .sort(sortPhase9GuideItems_);

    return phase9GuideOk_(guides, 'GuideItems 목록 조회 성공');
  } catch (error) {
    return phase9GuideFail_(error.message);
  }
}


/**
 * 관리자: GuideItems 수정
 *
 * 수정 가능 필드:
 * - category
 * - title
 * - content
 * - sort_order
 * - active
 */
function adminUpdateGuideItem(guideId, payload) {
  try {
    requirePhase2Admin_();

    const targetId = String(guideId || '').trim();

    if (!targetId) {
      return phase9GuideFail_('guide_id가 필요합니다.');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const guide = findPhase9GuideItemById_(targetId);

      if (!guide) {
        return phase9GuideFail_(
          '안내 항목을 찾을 수 없습니다: ' + targetId,
          {
            guide_id: targetId,
          }
        );
      }

      const cleanPayload = validatePhase9GuidePayload_(payload || {}, guide);

      updatePhase9GuideItem_(guide, cleanPayload);

      const updated = findPhase9GuideItemById_(targetId);

      return phase9GuideOk_(
        sanitizePhase9GuideItem_(updated),
        'GuideItems 수정 완료'
      );
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase9GuideFail_(error.message);
  }
}


/**
 * 관리자: GuideItems 일괄 수정
 *
 * 전체 검증 후 저장한다.
 * 하나라도 실패하면 아무 항목도 저장하지 않는다.
 */
function adminUpdateGuideItems(payload) {
  try {
    requirePhase2Admin_();

    const items = Array.isArray(payload)
      ? payload
      : [];

    if (items.length === 0) {
      return phase9GuideFail_('수정할 안내 항목이 없습니다.');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const prepared = [];
      const results = [];

      items.forEach(function(item) {
        const guideId = String(item.guide_id || '').trim();

        if (!guideId) {
          results.push({
            ok: false,
            guide_id: '',
            message: 'guide_id가 필요합니다.',
          });
          return;
        }

        const guide = findPhase9GuideItemById_(guideId);

        if (!guide) {
          results.push({
            ok: false,
            guide_id: guideId,
            message: '안내 항목을 찾을 수 없습니다: ' + guideId,
          });
          return;
        }

        try {
          const cleanPayload = validatePhase9GuidePayload_(item, guide);

          prepared.push({
            guide_id: guideId,
            guide: guide,
            patch: cleanPayload,
          });

          results.push({
            ok: true,
            guide_id: guideId,
            message: '검증 성공',
          });
        } catch (error) {
          results.push({
            ok: false,
            guide_id: guideId,
            message: error.message,
          });
        }
      });

      const failed = results.filter(function(result) {
        return result.ok !== true;
      });

      if (failed.length > 0) {
        return phase9GuideFail_(
          '일부 안내 항목 수정에 실패했습니다.',
          {
            results: results,
          }
        );
      }

      prepared.forEach(function(item) {
        updatePhase9GuideItem_(item.guide, item.patch);
      });

      const updatedItems = prepared.map(function(item) {
        return sanitizePhase9GuideItem_(
          findPhase9GuideItemById_(item.guide_id)
        );
      });

      return phase9GuideOk_(
        updatedItems,
        'GuideItems 일괄 수정 완료'
      );
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return phase9GuideFail_(error.message);
  }
}


function getPhase9GuideItems_() {
  const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.GUIDE_ITEMS);
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


function findPhase9GuideItemById_(guideId) {
  const targetId = String(guideId || '').trim();

  if (!targetId) {
    return null;
  }

  const guides = getPhase9GuideItems_();

  for (let i = 0; i < guides.length; i++) {
    if (String(guides[i].guide_id || '').trim() === targetId) {
      return guides[i];
    }
  }

  return null;
}


function updatePhase9GuideItem_(guide, patch) {
  const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.GUIDE_ITEMS);
  const headers = getPhase2Headers_(sheet);

  updatePhase2RowByNumber_(sheet, headers, guide._rowNumber, patch);
}


function validatePhase9GuidePayload_(payload, existingGuide) {
  const data = payload || {};
  const existing = existingGuide || {};

  const result = {};

  result.category = hasPhase9OwnProperty_(data, 'category')
    ? String(data.category || '').trim()
    : String(existing.category || '').trim();

  result.title = hasPhase9OwnProperty_(data, 'title')
    ? String(data.title || '').trim()
    : String(existing.title || '').trim();

  result.content = hasPhase9OwnProperty_(data, 'content')
    ? String(data.content || '')
    : String(existing.content || '');

  result.sort_order = hasPhase9OwnProperty_(data, 'sort_order')
    ? validatePhase9GuideSortOrder_(data.sort_order)
    : existing.sort_order;

  result.active = hasPhase9OwnProperty_(data, 'active')
    ? parsePhase9GuideBoolean_(data.active)
    : toPhase2Boolean_(existing.active);

  if (!result.category) {
    throw new Error('분류를 입력해 주세요.');
  }

  if (result.category.length > PHASE9_GUIDE_CONFIG.MAX_CATEGORY_LENGTH) {
    throw new Error(
      '분류는 ' +
      PHASE9_GUIDE_CONFIG.MAX_CATEGORY_LENGTH +
      '자 이하로 입력해 주세요.'
    );
  }

  if (!result.title) {
    throw new Error('제목을 입력해 주세요.');
  }

  if (result.title.length > PHASE9_GUIDE_CONFIG.MAX_TITLE_LENGTH) {
    throw new Error(
      '제목은 ' +
      PHASE9_GUIDE_CONFIG.MAX_TITLE_LENGTH +
      '자 이하로 입력해 주세요.'
    );
  }

  if (!String(result.content || '').trim()) {
    throw new Error('내용을 입력해 주세요.');
  }

  if (String(result.content || '').length > PHASE9_GUIDE_CONFIG.MAX_CONTENT_LENGTH) {
    throw new Error(
      '내용은 ' +
      PHASE9_GUIDE_CONFIG.MAX_CONTENT_LENGTH +
      '자 이하로 입력해 주세요.'
    );
  }

  return result;
}


function validatePhase9GuideSortOrder_(value) {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue)) {
    throw new Error('정렬 순서는 정수로 입력해 주세요.');
  }

  if (numberValue < PHASE9_GUIDE_CONFIG.MIN_SORT_ORDER) {
    throw new Error(
      '정렬 순서는 ' +
      PHASE9_GUIDE_CONFIG.MIN_SORT_ORDER +
      ' 이상이어야 합니다.'
    );
  }

  if (numberValue > PHASE9_GUIDE_CONFIG.MAX_SORT_ORDER) {
    throw new Error(
      '정렬 순서는 ' +
      PHASE9_GUIDE_CONFIG.MAX_SORT_ORDER +
      ' 이하이어야 합니다.'
    );
  }

  return numberValue;
}


function parsePhase9GuideBoolean_(value) {
  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  const text = String(value || '').trim().toLowerCase();

  if (['true', 'yes', 'y', '1', '활성'].indexOf(text) !== -1) {
    return true;
  }

  if (['false', 'no', 'n', '0', '비활성'].indexOf(text) !== -1) {
    return false;
  }

  throw new Error('active 값은 true 또는 false여야 합니다.');
}


function hasPhase9OwnProperty_(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}


function sanitizePhase9GuideItem_(guide) {
  if (!guide) {
    return null;
  }

  return {
    guide_id: String(guide.guide_id || '').trim(),
    category: String(guide.category || '').trim(),
    title: String(guide.title || '').trim(),
    content: String(guide.content || ''),
    sort_order: guide.sort_order === '' ? '' : Number(guide.sort_order || 0),
    active: toPhase2Boolean_(guide.active),
  };
}


function sortPhase9GuideItems_(a, b) {
  const orderA = Number(a.sort_order === '' ? 999999 : a.sort_order);
  const orderB = Number(b.sort_order === '' ? 999999 : b.sort_order);

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return String(a.title || '').localeCompare(String(b.title || ''), 'ko');
}


function phase9GuideOk_(data, message) {
  return {
    ok: true,
    data: data,
    message: message || '',
  };
}


function phase9GuideFail_(message, detail) {
  return {
    ok: false,
    data: detail || null,
    message: message || '오류가 발생했습니다.',
  };
}


/**
 * Phase 9-C 테스트 실행
 */
function TEST_runPhase9GuideItems() {
  const tests = [];

  try {
    TEST_resetPhase9GuideData_();

    tests.push(TEST_phase9GuideAdminList_());
    tests.push(TEST_phase9GuideUpdate_());
    tests.push(TEST_phase9GuideActiveExcluded_());
    tests.push(TEST_phase9GuideSortOrder_());
    tests.push(TEST_phase9GuideHtmlStringPreserved_());
    tests.push(TEST_phase9GuideRejectUnknownId_());
    tests.push(TEST_phase9GuideBulkAllOrNothing_());
  } catch (error) {
    tests.push(makePhase9GuideTestResult_(
      'P9-GUIDE-ERROR',
      'Phase 9-C 테스트 실행 오류',
      false,
      '정상 실행',
      error.message,
      error.message
    ));
  } finally {
    TEST_resetPhase9GuideData_();
  }

  const response = buildPhase9GuideTestResponse_(tests);

  Logger.log(JSON.stringify(response, null, 2));

  return response;
}


function TEST_phase9GuideAdminList_() {
  return safePhase9GuideTest_('P9-GUIDE-01', '관리자 GuideItems 목록 조회', function() {
    TEST_addPhase9GuideItem_({
      guide_id: 'TEST_GUIDE_LIST',
      category: '테스트',
      title: '목록 조회 테스트',
      content: '목록 조회 테스트 내용',
      sort_order: 9101,
      active: false,
    });

    const result = adminGetGuideItems();

    const found = result.ok &&
      result.data.some(function(item) {
        return item.guide_id === 'TEST_GUIDE_LIST' &&
          item.active === false;
      });

    return makePhase9GuideTestResult_(
      'P9-GUIDE-01',
      '관리자 GuideItems 목록 조회',
      found,
      'active=false 항목도 관리자 목록에 포함',
      result.message,
      found ? '관리자 GuideItems 목록 조회 성공' : '관리자 GuideItems 목록 조회 실패'
    );
  });
}


function TEST_phase9GuideUpdate_() {
  return safePhase9GuideTest_('P9-GUIDE-02', 'GuideItems 수정', function() {
    TEST_addPhase9GuideItem_({
      guide_id: 'TEST_GUIDE_UPDATE',
      category: '수정전',
      title: '수정 전 제목',
      content: '수정 전 내용',
      sort_order: 9201,
      active: true,
    });

    const updated = adminUpdateGuideItem('TEST_GUIDE_UPDATE', {
      category: '수정후',
      title: '수정 후 제목',
      content: '수정 후 내용',
      sort_order: 9202,
      active: false,
    });

    const item = findPhase9GuideItemById_('TEST_GUIDE_UPDATE');

    const passed = updated.ok &&
      item &&
      String(item.category || '') === '수정후' &&
      String(item.title || '') === '수정 후 제목' &&
      String(item.content || '') === '수정 후 내용' &&
      Number(item.sort_order || 0) === 9202 &&
      toPhase2Boolean_(item.active) === false;

    return makePhase9GuideTestResult_(
      'P9-GUIDE-02',
      'GuideItems 수정',
      passed,
      'category/title/content/sort_order/active 수정',
      updated.message,
      passed ? 'GuideItems 수정 성공' : 'GuideItems 수정 실패'
    );
  });
}


function TEST_phase9GuideActiveExcluded_() {
  return safePhase9GuideTest_('P9-GUIDE-03', '비활성 안내 사용자 화면 제외', function() {
    TEST_addPhase9GuideItem_({
      guide_id: 'TEST_GUIDE_INACTIVE_EXCLUDED',
      category: '테스트',
      title: '비활성 제외 테스트',
      content: '비활성 제외 테스트 내용',
      sort_order: 9301,
      active: true,
    });

    const updated = adminUpdateGuideItem('TEST_GUIDE_INACTIVE_EXCLUDED', {
      active: false,
    });

    const userGuides = getPhase4GuideItems_();

    const excluded = userGuides.every(function(item) {
      return item.guide_id !== 'TEST_GUIDE_INACTIVE_EXCLUDED';
    });

    const passed = updated.ok && excluded;

    return makePhase9GuideTestResult_(
      'P9-GUIDE-03',
      '비활성 안내 사용자 화면 제외',
      passed,
      'active=false 항목은 사용자 안내에서 제외',
      'excluded=' + excluded,
      passed ? '비활성 안내 제외 성공' : '비활성 안내 제외 실패'
    );
  });
}


function TEST_phase9GuideSortOrder_() {
  return safePhase9GuideTest_('P9-GUIDE-04', 'GuideItems 정렬 순서 확인', function() {
    TEST_addPhase9GuideItem_({
      guide_id: 'TEST_GUIDE_SORT_B',
      category: '테스트',
      title: '정렬 B',
      content: '정렬 B 내용',
      sort_order: 9402,
      active: true,
    });

    TEST_addPhase9GuideItem_({
      guide_id: 'TEST_GUIDE_SORT_A',
      category: '테스트',
      title: '정렬 A',
      content: '정렬 A 내용',
      sort_order: 9401,
      active: true,
    });

    const guides = getPhase4GuideItems_()
      .filter(function(item) {
        return String(item.guide_id || '').indexOf('TEST_GUIDE_SORT_') === 0;
      });

    const ids = guides.map(function(item) {
      return item.guide_id;
    });

    const passed =
      ids.length === 2 &&
      ids[0] === 'TEST_GUIDE_SORT_A' &&
      ids[1] === 'TEST_GUIDE_SORT_B';

    return makePhase9GuideTestResult_(
      'P9-GUIDE-04',
      'GuideItems 정렬 순서 확인',
      passed,
      'sort_order 오름차순',
      ids.join(', '),
      passed ? 'GuideItems 정렬 순서 확인 성공' : 'GuideItems 정렬 순서 확인 실패'
    );
  });
}


function TEST_phase9GuideHtmlStringPreserved_() {
  return safePhase9GuideTest_('P9-GUIDE-05', 'HTML 문자열 데이터 보존', function() {
    const htmlText = '<script>alert("x")</script>\n테스트';

    TEST_addPhase9GuideItem_({
      guide_id: 'TEST_GUIDE_HTML',
      category: '테스트',
      title: 'HTML 문자열 테스트',
      content: '기존 내용',
      sort_order: 9501,
      active: true,
    });

    const updated = adminUpdateGuideItem('TEST_GUIDE_HTML', {
      content: htmlText,
    });

    const item = findPhase9GuideItemById_('TEST_GUIDE_HTML');

    const passed = updated.ok &&
      item &&
      String(item.content || '') === htmlText;

    return makePhase9GuideTestResult_(
      'P9-GUIDE-05',
      'HTML 문자열 데이터 보존',
      passed,
      'HTML은 실행하지 않고 문자열 데이터로 보존',
      passed ? 'content preserved' : String(item && item.content),
      passed ? 'HTML 문자열 데이터 보존 성공' : 'HTML 문자열 데이터 보존 실패'
    );
  });
}


function TEST_phase9GuideRejectUnknownId_() {
  return safePhase9GuideTest_('P9-GUIDE-06', '없는 guide_id 수정 거부', function() {
    const result = adminUpdateGuideItem('TEST_GUIDE_UNKNOWN', {
      title: '수정되면 안 됨',
    });

    const passed = result.ok === false;

    return makePhase9GuideTestResult_(
      'P9-GUIDE-06',
      '없는 guide_id 수정 거부',
      passed,
      '없는 guide_id 수정 실패',
      result.message,
      passed ? '없는 guide_id 수정 거부 성공' : '없는 guide_id 수정 거부 실패'
    );
  });
}


function TEST_phase9GuideBulkAllOrNothing_() {
  return safePhase9GuideTest_('P9-GUIDE-07', 'GuideItems 일괄 수정 전체 검증', function() {
    TEST_addPhase9GuideItem_({
      guide_id: 'TEST_GUIDE_BULK_OK',
      category: '테스트',
      title: '일괄 수정 원본',
      content: '일괄 수정 원본 내용',
      sort_order: 9701,
      active: true,
    });

    TEST_addPhase9GuideItem_({
      guide_id: 'TEST_GUIDE_BULK_BAD',
      category: '테스트',
      title: '일괄 수정 실패 원본',
      content: '일괄 수정 실패 원본 내용',
      sort_order: 9702,
      active: true,
    });

    const result = adminUpdateGuideItems([
      {
        guide_id: 'TEST_GUIDE_BULK_OK',
        title: '바뀌면 안 되는 제목',
      },
      {
        guide_id: 'TEST_GUIDE_BULK_BAD',
        title: '',
      },
    ]);

    const okItem = findPhase9GuideItemById_('TEST_GUIDE_BULK_OK');
    const badItem = findPhase9GuideItemById_('TEST_GUIDE_BULK_BAD');

    const noPartialSave =
      okItem &&
      String(okItem.title || '') === '일괄 수정 원본' &&
      badItem &&
      String(badItem.title || '') === '일괄 수정 실패 원본';

    const passed =
      result.ok === false &&
      noPartialSave === true;

    return makePhase9GuideTestResult_(
      'P9-GUIDE-07',
      'GuideItems 일괄 수정 전체 검증',
      passed,
      '하나라도 실패하면 아무 항목도 저장하지 않음',
      'result.ok=' + result.ok + ', noPartialSave=' + noPartialSave,
      passed ? 'GuideItems 일괄 수정 전체 검증 성공' : 'GuideItems 일괄 수정 전체 검증 실패'
    );
  });
}


function TEST_addPhase9GuideItem_(rowObject) {
  const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.GUIDE_ITEMS);
  const headers = getPhase2Headers_(sheet);

  appendPhase2ObjectRow_(sheet, headers, rowObject);
}


function TEST_resetPhase9GuideData_() {
  TEST_deletePhase9GuideRowsByPrefix_('TEST_GUIDE_');
}


function TEST_deletePhase9GuideRowsByPrefix_(prefix) {
  const sheet = getPhase2Sheet_(PHASE1_CONFIG.SHEETS.GUIDE_ITEMS);
  const headers = getPhase2Headers_(sheet);

  const guideIdIndex = headers.indexOf('guide_id');

  if (guideIdIndex === -1) {
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
    const guideId = String(values[i][guideIdIndex] || '').trim();

    if (guideId.indexOf(prefix) === 0) {
      sheet.deleteRow(i + 2);
    }
  }
}


function safePhase9GuideTest_(code, name, callback) {
  try {
    return callback();
  } catch (error) {
    return makePhase9GuideTestResult_(
      code,
      name,
      false,
      '정상 실행',
      error.message,
      error.message
    );
  }
}


function makePhase9GuideTestResult_(code, name, passed, expected, actual, message) {
  return {
    code: code,
    name: name,
    passed: passed === true,
    expected: expected,
    actual: actual,
    message: message,
  };
}


function buildPhase9GuideTestResponse_(tests) {
  const passed = tests.filter(function(test) {
    return test.passed === true;
  }).length;

  const failed = tests.length - passed;

  return {
    ok: failed === 0,
    message: failed === 0
      ? 'Phase 9-C 테스트를 모두 통과했습니다.'
      : 'Phase 9-C 테스트 중 실패 항목이 있습니다.',
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