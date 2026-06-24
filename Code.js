 const PHASE0_CONFIG = {
  SCHOOL_DOMAIN: 'senedu.kr',
  PROBE_SHEET_NAME: '_Probe',
};

function doGet(e) {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('GPT Pro 공동 사용 지원 시스템');
}

function include(filename) {
  return HtmlService
    .createTemplateFromFile(filename)
    .evaluate()
    .getContent();
}

function runPhase0Tests() {
  const now = new Date();

  const activeEmail = safeGetEmail_(() => Session.getActiveUser().getEmail());
  const effectiveEmail = safeGetEmail_(() => Session.getEffectiveUser().getEmail());
  const scriptTimeZone = safeRun_(() => Session.getScriptTimeZone(), '');

  const sheetResult = testSheetAccess_(now, activeEmail, effectiveEmail, scriptTimeZone);

  const tests = [
    {
      code: 'PH0-01',
      name: 'Active User Email 확인',
      passed: Boolean(activeEmail),
      expected: '접속자 이메일이 빈 값이 아님',
      actual: activeEmail || '(빈 값)',
      message: activeEmail
        ? '접속자 이메일 확인 성공'
        : '접속자 이메일을 가져오지 못했습니다. 배포 방식 또는 Workspace 정책 확인이 필요합니다.',
    },
    {
      code: 'PH0-02',
      name: 'Effective User Email 확인',
      passed: Boolean(effectiveEmail),
      expected: '실행 주체 이메일이 빈 값이 아님',
      actual: effectiveEmail || '(빈 값)',
      message: effectiveEmail
        ? '실행 주체 이메일 확인 성공'
        : '실행 주체 이메일을 가져오지 못했습니다.',
    },
    {
      code: 'PH0-03',
      name: '학교 도메인 확인',
      passed: Boolean(activeEmail) && activeEmail.toLowerCase().endsWith('@' + PHASE0_CONFIG.SCHOOL_DOMAIN),
      expected: '@' + PHASE0_CONFIG.SCHOOL_DOMAIN,
      actual: activeEmail || '(빈 값)',
      message: activeEmail
        ? '도메인 확인 완료'
        : '접속자 이메일이 없어 도메인 확인 불가',
    },
    {
      code: 'PH0-04',
      name: 'Google Sheets 접근 확인',
      passed: sheetResult.ok,
      expected: '연결된 Google Sheet 읽기/쓰기 가능',
      actual: sheetResult.message,
      message: sheetResult.message,
    },
    {
      code: 'PH0-05',
      name: '스크립트 시간대 확인',
      passed: Boolean(scriptTimeZone),
      expected: 'Script timezone 확인 가능',
      actual: scriptTimeZone || '(빈 값)',
      message: scriptTimeZone
        ? '스크립트 시간대 확인 성공'
        : '스크립트 시간대를 확인하지 못했습니다.',
    },
  ];

  const summary = {
    total: tests.length,
    passed: tests.filter(t => t.passed).length,
    failed: tests.filter(t => !t.passed).length,
  };

  return {
    ok: summary.failed === 0,
    message: summary.failed === 0
      ? 'Phase 0 테스트를 모두 통과했습니다.'
      : 'Phase 0 테스트 중 실패 항목이 있습니다.',
    data: {
      activeEmail,
      effectiveEmail,
      scriptTimeZone,
      timestamp: Utilities.formatDate(now, scriptTimeZone || 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
      tests,
      summary,
    },
  };
}

function testSheetAccess_(now, activeEmail, effectiveEmail, scriptTimeZone) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (!ss) {
      return {
        ok: false,
        message: '연결된 Spreadsheet를 찾지 못했습니다. Google Sheet에서 Apps Script를 열었는지 확인하세요.',
      };
    }

    let sheet = ss.getSheetByName(PHASE0_CONFIG.PROBE_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(PHASE0_CONFIG.PROBE_SHEET_NAME);
      sheet.appendRow([
        'timestamp',
        'active_email',
        'effective_email',
        'script_timezone',
      ]);
    }

    sheet.appendRow([
      now,
      activeEmail || '',
      effectiveEmail || '',
      scriptTimeZone || '',
    ]);

    return {
      ok: true,
      message: `시트 접근 성공: ${PHASE0_CONFIG.PROBE_SHEET_NAME}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: `시트 접근 실패: ${error.message}`,
    };
  }
}

function safeGetEmail_(callback) {
  try {
    const email = callback();
    return email ? String(email).trim() : '';
  } catch (error) {
    return '';
  }
}

function safeRun_(callback, fallbackValue) {
  try {
    const value = callback();
    return value === undefined || value === null ? fallbackValue : value;
  } catch (error) {
    return fallbackValue;
  }
}