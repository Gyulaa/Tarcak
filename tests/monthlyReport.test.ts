import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import {
  buildReportCsv,
  buildReportPreview,
  csvCell,
  formatMinorExact,
  MAX_REPORT_MONTHS,
  monthRangeFor,
  REPORT_FILE_PREFIX,
  reportFileName,
  type ReportOptions,
  type ReportRow,
} from '../src/domain/monthlyReport';

const BOM = '﻿';
/** Whole major units → minor units (1 unit = 10^8 minor). */
const major = (n: number | bigint) => BigInt(n) * 100_000_000n;

describe('monthRangeFor', () => {
  let savedTz: string | undefined;
  before(() => {
    savedTz = process.env.TZ;
    process.env.TZ = 'Europe/Budapest';
  });
  after(() => {
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
  });

  test('a range inside one month is that one calendar month', () => {
    const months = monthRangeFor(new Date(2026, 2, 10, 12).getTime(), new Date(2026, 2, 20, 8).getTime());
    assert.deepEqual(months, [
      { key: '2026-03', fromMs: new Date(2026, 2, 1).getTime(), toMs: new Date(2026, 3, 1).getTime() },
    ]);
  });

  test('the range snaps outwards to whole months and crosses the year end', () => {
    const months = monthRangeFor(new Date(2025, 10, 30, 23).getTime(), new Date(2026, 1, 1, 1).getTime());
    assert.deepEqual(
      months.map((m) => m.key),
      ['2025-11', '2025-12', '2026-01', '2026-02']
    );
    for (let i = 1; i < months.length; i++) {
      assert.equal(months[i].fromMs, months[i - 1].toMs);
    }
  });

  test('the month boundary splits 23:59:59.999 and 00:00:00.000 correctly', () => {
    const [jan, feb] = monthRangeFor(new Date(2026, 0, 15).getTime(), new Date(2026, 1, 15).getTime());
    const lastMsOfJan = new Date(2026, 0, 31, 23, 59, 59, 999).getTime();
    const firstMsOfFeb = new Date(2026, 1, 1, 0, 0, 0, 0).getTime();
    assert.equal(lastMsOfJan, jan.toMs - 1);
    assert.equal(firstMsOfFeb, feb.fromMs);
    assert.equal(jan.toMs, feb.fromMs);
  });

  test('a month with a DST change is 23 or 25 hours off a whole number of days', () => {
    const hour = 3_600_000;
    const day = 24 * hour;
    const [march] = monthRangeFor(new Date(2026, 2, 5).getTime(), new Date(2026, 2, 6).getTime());
    const [october] = monthRangeFor(new Date(2026, 9, 5).getTime(), new Date(2026, 9, 6).getTime());
    const [june] = monthRangeFor(new Date(2026, 5, 5).getTime(), new Date(2026, 5, 6).getTime());
    assert.equal(march.toMs - march.fromMs, 31 * day - hour);
    assert.equal(october.toMs - october.fromMs, 31 * day + hour);
    assert.equal(june.toMs - june.fromMs, 30 * day);
  });

  test('exactly 240 months are allowed, 241 are refused', () => {
    assert.equal(MAX_REPORT_MONTHS, 240);
    const start = new Date(2000, 0, 1).getTime();
    assert.equal(monthRangeFor(start, new Date(2019, 11, 31).getTime()).length, 240);
    assert.throws(() => monthRangeFor(start, new Date(2020, 0, 1).getTime()), /240 months/);
  });

  test('an inverted or invalid range is refused', () => {
    assert.throws(() => monthRangeFor(2, 1), /valid time range/);
    assert.throws(() => monthRangeFor(Number.NaN, 1), /valid time range/);
  });
});

describe('formatMinorExact', () => {
  test('zero, whole and fractional amounts without trailing zeros', () => {
    assert.equal(formatMinorExact(0n, '.'), '0');
    assert.equal(formatMinorExact(major(1), '.'), '1');
    assert.equal(formatMinorExact(150_000_000n, ','), '1,5');
    assert.equal(formatMinorExact(150_000_000n, '.'), '1.5');
    assert.equal(formatMinorExact(1n, '.'), '0.00000001');
    assert.equal(formatMinorExact(1n, ','), '0,00000001');
    assert.equal(formatMinorExact(major(12) + 10_000_000n, '.'), '12.1');
  });

  test('negative amounts carry the sign, nothing rounds', () => {
    assert.equal(formatMinorExact(-1n, '.'), '-0.00000001');
    assert.equal(formatMinorExact(-250_000_000n, ','), '-2,5');
    assert.equal(formatMinorExact(-major(7), '.'), '-7');
  });

  test('values beyond 2^53 minor stay exact and are not grouped', () => {
    assert.equal(formatMinorExact(9_007_199_254_740_993n, '.'), '90071992.54740993');
    assert.equal(formatMinorExact(major(1_000_000_000), '.'), '1000000000');
    assert.equal(formatMinorExact(-major(1_000_000_000) - 1n, ','), '-1000000000,00000001');
  });
});

describe('csvCell', () => {
  test('plain text is left alone', () => {
    assert.equal(csvCell('Groceries', ';'), 'Groceries');
    assert.equal(csvCell('Árvíztűrő tükörfúrógép', ','), 'Árvíztűrő tükörfúrógép');
    assert.equal(csvCell('', ';'), '');
  });

  test('the delimiter, quotes and line breaks force quoting; quotes are doubled', () => {
    assert.equal(csvCell('a;b', ';'), '"a;b"');
    assert.equal(csvCell('a;b', ','), 'a;b');
    assert.equal(csvCell('a,b', ','), '"a,b"');
    assert.equal(csvCell('a,b', ';'), 'a,b');
    assert.equal(csvCell('a;b"c', ';'), '"a;b""c"');
    assert.equal(csvCell('say "hi"', ','), '"say ""hi"""');
    assert.equal(csvCell('one\ntwo', ';'), '"one\ntwo"');
    assert.equal(csvCell('one\r\ntwo', ','), '"one\r\ntwo"');
  });

  test('a formula trigger at the start gets a leading apostrophe', () => {
    assert.equal(csvCell('=HYPERLINK("x")', ';'), '"\'=HYPERLINK(""x"")"');
    assert.equal(csvCell('+1', ','), "'+1");
    assert.equal(csvCell('-1', ','), "'-1");
    assert.equal(csvCell('@SUM(A1)', ','), "'@SUM(A1)");
    assert.equal(csvCell('\tcmd', ','), "'\tcmd");
    assert.equal(csvCell('\rcmd', ','), '"\'\rcmd"');
  });

  test('the same characters inside the text are harmless', () => {
    assert.equal(csvCell('a=b', ','), 'a=b');
    assert.equal(csvCell('x-y+z@w', ';'), 'x-y+z@w');
    assert.equal(csvCell("'=already", ','), "'=already");
  });
});

const hu: ReportOptions = {
  months: ['2026-01', '2026-02'],
  currencies: ['EUR', 'HUF'],
  breakdown: false,
  format: 'hungarian',
};

function row(
  month: string,
  currency: string,
  kind: 'income' | 'expense',
  category: string | null,
  amount: bigint
): ReportRow {
  return { month, currency, kind, category, total: amount };
}

function lines(csv: string): string[] {
  assert.ok(csv.startsWith(BOM), 'starts with a BOM');
  assert.ok(csv.endsWith('\r\n'), 'ends with CRLF');
  return csv.slice(BOM.length, -2).split('\r\n');
}

describe('buildReportCsv, summary layout', () => {
  const rows = [
    row('2026-01', 'HUF', 'income', 'Salary', major(500_000)),
    row('2026-01', 'HUF', 'income', null, major(1_000)),
    row('2026-01', 'HUF', 'expense', 'Rent', major(150_000)),
    row('2026-01', 'EUR', 'expense', 'Travel', 250_000_000n),
  ];

  test('one row per month and currency, empty months are zeros, EUR before HUF', () => {
    assert.deepEqual(lines(buildReportCsv(rows, hu)), [
      'month;currency;income;expense;net',
      '2026-01;EUR;0;2,5;-2,5',
      '2026-01;HUF;501000;150000;351000',
      '2026-02;EUR;0;0;0',
      '2026-02;HUF;0;0;0',
    ]);
  });

  test('the International preset uses a comma delimiter and a point', () => {
    const csv = buildReportCsv(rows, { ...hu, format: 'international' });
    assert.deepEqual(lines(csv).slice(0, 2), ['month,currency,income,expense,net', '2026-01,EUR,0,2.5,-2.5']);
  });

  test('uses CRLF only, never a bare line feed', () => {
    const csv = buildReportCsv(rows, hu);
    assert.equal(csv.replace(/\r\n/g, '').includes('\n'), false);
  });

  test('a currency left out of the options is not in the file', () => {
    const csv = buildReportCsv(rows, { ...hu, currencies: ['HUF'] });
    assert.deepEqual(lines(csv), [
      'month;currency;income;expense;net',
      '2026-01;HUF;501000;150000;351000',
      '2026-02;HUF;0;0;0',
    ]);
    assert.equal(csv.includes('EUR'), false);
  });

  test('rows outside the chosen months are ignored', () => {
    const csv = buildReportCsv([...rows, row('2025-12', 'HUF', 'income', null, major(9))], hu);
    assert.equal(csv.includes('2025-12'), false);
    assert.ok(csv.includes('2026-01;HUF;501000;'));
  });

  test('a refund (negative income) counts with its sign, net = income - expense', () => {
    const csv = buildReportCsv(
      [
        row('2026-01', 'HUF', 'income', null, major(100)),
        row('2026-01', 'HUF', 'income', 'Refund', -major(130)),
        row('2026-01', 'HUF', 'expense', null, major(20)),
        row('2026-01', 'HUF', 'expense', 'Returned', -major(5)),
      ],
      { ...hu, currencies: ['HUF'], months: ['2026-01'] }
    );
    assert.deepEqual(lines(csv)[1], '2026-01;HUF;-30;15;-45');
  });

  test('sums stay exact beyond 2^53 minor units', () => {
    const big = 9_007_199_254_740_993n; // 2^53 + 1
    const csv = buildReportCsv(
      [row('2026-01', 'HUF', 'income', 'A', big), row('2026-01', 'HUF', 'income', 'B', big), row('2026-01', 'HUF', 'expense', null, 1n)],
      { ...hu, currencies: ['HUF'], months: ['2026-01'], format: 'international' }
    );
    // 2 * 90071992.54740993 = 180143985.09481986; minus 0.00000001
    assert.deepEqual(lines(csv)[1], '2026-01,HUF,180143985.09481986,0.00000001,180143985.09481985');
  });

  test('no category name or other free text reaches the summary file', () => {
    const csv = buildReportCsv(rows, hu);
    for (const word of ['Salary', 'Rent', 'Travel', 'Uncategorized']) {
      assert.equal(csv.includes(word), false, word);
    }
  });

  test('no currencies or no months give just the header', () => {
    assert.deepEqual(lines(buildReportCsv(rows, { ...hu, currencies: [] })), ['month;currency;income;expense;net']);
    assert.deepEqual(lines(buildReportCsv(rows, { ...hu, months: [] })), ['month;currency;income;expense;net']);
  });
});

describe('buildReportCsv, category breakdown', () => {
  const opts: ReportOptions = { ...hu, breakdown: true };

  test('long form: only non-zero sums, income before expense, sorted, Uncategorized for none', () => {
    const rows = [
      row('2026-02', 'HUF', 'expense', 'Rent', major(150_000)),
      row('2026-01', 'HUF', 'expense', 'Travel', major(10)),
      row('2026-01', 'HUF', 'expense', null, major(3)),
      row('2026-01', 'HUF', 'income', 'Salary', major(500)),
      row('2026-01', 'EUR', 'income', 'Salary', 150_000_000n),
      row('2026-01', 'HUF', 'expense', 'Books', 0n),
    ];
    assert.deepEqual(lines(buildReportCsv(rows, opts)), [
      'month;currency;kind;category;amount',
      '2026-01;EUR;income;Salary;1,5',
      '2026-01;HUF;income;Salary;500',
      '2026-01;HUF;expense;Travel;10',
      '2026-01;HUF;expense;Uncategorized;3',
      '2026-02;HUF;expense;Rent;150000',
    ]);
  });

  test('months without activity produce no rows', () => {
    const csv = buildReportCsv([row('2026-02', 'HUF', 'income', 'Salary', major(1))], opts);
    assert.deepEqual(lines(csv), ['month;currency;kind;category;amount', '2026-02;HUF;income;Salary;1']);
  });

  test('rows of one name in a month merge, a category that nets to zero disappears', () => {
    const rows = [
      row('2026-01', 'HUF', 'expense', 'Food', major(4)),
      row('2026-01', 'HUF', 'expense', 'Food', major(6)),
      row('2026-01', 'HUF', 'expense', 'Gift', major(5)),
      row('2026-01', 'HUF', 'expense', 'Gift', -major(5)),
    ];
    assert.deepEqual(lines(buildReportCsv(rows, opts)).slice(1), ['2026-01;HUF;expense;Food;10']);
  });

  test('a category name that is a formula or holds the delimiter and a quote is made safe', () => {
    const rows = [
      row('2026-01', 'HUF', 'expense', '=HYPERLINK("x")', major(1)),
      row('2026-01', 'HUF', 'expense', 'a;b"c', major(2)),
    ];
    assert.deepEqual(lines(buildReportCsv(rows, opts)).slice(1), [
      '2026-01;HUF;expense;"\'=HYPERLINK(""x"")";1',
      '2026-01;HUF;expense;"a;b""c";2',
    ]);
  });

  test('a skipped currency is not in the long form either', () => {
    const rows = [
      row('2026-01', 'HUF', 'income', 'Salary', major(1)),
      row('2026-01', 'EUR', 'income', 'Secret', major(1)),
    ];
    const csv = buildReportCsv(rows, { ...opts, currencies: ['HUF'] });
    assert.equal(csv.includes('Secret'), false);
    assert.equal(csv.includes('EUR'), false);
  });

  test('International long form', () => {
    const csv = buildReportCsv([row('2026-01', 'HUF', 'income', 'Salary', 150_000_000n)], {
      ...opts,
      format: 'international',
    });
    assert.deepEqual(lines(csv), ['month,currency,kind,category,amount', '2026-01,HUF,income,Salary,1.5']);
  });
});

describe('buildReportPreview', () => {
  const rows = [
    row('2026-01', 'HUF', 'income', 'Salary', major(500)),
    row('2026-01', 'HUF', 'expense', 'Rent', 123_456_789n),
    row('2026-01', 'HUF', 'expense', null, major(1)),
    row('2026-01', 'EUR', 'expense', 'Rent', major(2)),
  ];

  test('the summary is exactly what the summary file holds', () => {
    for (const format of ['hungarian', 'international'] as const) {
      const options: ReportOptions = { ...hu, format };
      const delimiter = format === 'hungarian' ? ';' : ',';
      const fromFile = lines(buildReportCsv(rows, options))
        .slice(1)
        .map((l) => l.split(delimiter));
      const preview = buildReportPreview(rows, options);
      assert.deepEqual(
        preview.summary.map((s) => [s.month, s.currency, s.income, s.expense, s.net]),
        fromFile
      );
    }
  });

  test('with the breakdown the preview counts the distinct category names that will be written', () => {
    const preview = buildReportPreview(rows, { ...hu, breakdown: true });
    assert.equal(preview.categoryCount, 2); // Salary and Rent; "no category" is not a name
    assert.equal(buildReportPreview(rows, { ...hu, breakdown: true, currencies: ['EUR'] }).categoryCount, 1);
    assert.equal(buildReportPreview(rows, { ...hu, breakdown: false }).categoryCount, 0);
  });

  test('a skipped currency does not count its category names', () => {
    const only = [row('2026-01', 'EUR', 'expense', 'Secret', major(1)), row('2026-01', 'HUF', 'expense', 'Rent', major(1))];
    assert.equal(buildReportPreview(only, { ...hu, breakdown: true, currencies: ['HUF'] }).categoryCount, 1);
  });

  test('empty means no income or expense at all for the chosen months and currencies', () => {
    assert.equal(buildReportPreview([], hu).isEmpty, true);
    assert.equal(buildReportPreview(rows, hu).isEmpty, false);
    assert.equal(buildReportPreview(rows, { ...hu, currencies: [] }).isEmpty, true);
    assert.equal(buildReportPreview(rows, { ...hu, months: ['2030-01'] }).isEmpty, true);
  });
});

describe('reportFileName', () => {
  test('is the export day only, in local time', () => {
    assert.equal(REPORT_FILE_PREFIX, 'tarcak-report-');
    assert.equal(reportFileName(new Date(2026, 0, 5, 23, 59)), 'tarcak-report-2026-01-05.csv');
    assert.equal(reportFileName(new Date(2026, 11, 31, 0, 0)), 'tarcak-report-2026-12-31.csv');
  });
});
