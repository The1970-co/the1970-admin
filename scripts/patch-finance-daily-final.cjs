#!/usr/bin/env node
/*
  Finance daily final patch - The 1970
  Chỉ sửa file admin: components/admin/finance/FinanceDailyPageClient.tsx

  Mục tiêu:
  - Bảng chốt tiền từng ngày không bị mất data khi /finance/daily-ledger trả rỗng.
  - Khi /finance/daily-ledger có data: dùng ledger core làm nguồn sự thật, KHÔNG merge live vào để tránh cộng đôi/sai số dư.
  - Chỉ dùng /finance/daily làm fallback hiển thị khi ledger core rỗng hoàn toàn.
  - Chặn trộn chi nhánh/nguồn tiền bằng business key: ngày + chi nhánh chuẩn hoá + nguồn tiền chuẩn hoá.
*/

const fs = require('fs');
const path = require('path');

const target = process.argv[2] || path.join(process.cwd(), 'components/admin/finance/FinanceDailyPageClient.tsx');

if (!fs.existsSync(target)) {
  console.error(`Không tìm thấy file: ${target}`);
  process.exit(1);
}

let src = fs.readFileSync(target, 'utf8');
const backup = `${target}.bak-finance-final-${new Date().toISOString().replace(/[:.]/g, '-')}`;
fs.writeFileSync(backup, src);

function replaceOrFail(label, re, replacement) {
  if (!re.test(src)) {
    console.error(`Không tìm thấy đoạn cần sửa: ${label}`);
    console.error(`Đã tạo backup: ${backup}`);
    process.exit(1);
  }
  src = src.replace(re, replacement);
}

// 1) Bảo đảm state ledgerLiveData vẫn đọc được. Có bản đã vô tình viết const [, setLedgerLiveData].
src = src.replace(
  /const\s*\[\s*,\s*setLedgerLiveData\s*\]\s*=\s*useState<any>\(null\);/,
  'const [ledgerLiveData, setLedgerLiveData] = useState<any>(null);',
);

// 2) safeRows nhận được nhiều shape backend để fallback không trắng bảng.
src = src.replace(
  /function safeRows\(value: unknown\): MoneyRow\[\] \{\s*return Array\.isArray\(value\) \? \(value as MoneyRow\[\]\) : \[\];\s*\}/s,
  `function safeRows(value: unknown): MoneyRow[] {
  if (Array.isArray(value)) return value as MoneyRow[];
  const anyValue = value as any;
  if (Array.isArray(anyValue?.payments)) return anyValue.payments as MoneyRow[];
  if (Array.isArray(anyValue?.rows)) return anyValue.rows as MoneyRow[];
  if (Array.isArray(anyValue?.transactions)) return anyValue.transactions as MoneyRow[];
  if (Array.isArray(anyValue?.items)) return anyValue.items as MoneyRow[];
  return [];
}`,
);

// 3) Chèn helper chuẩn hoá số tiền và key nếu chưa có.
if (!src.includes('function financeNumber(value: unknown)')) {
  const insertAfter = /function safeRows\(value: unknown\): MoneyRow\[\] \{[\s\S]*?\n\}/;
  const helper = `

function financeNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function hasLedgerMoney(row: DailyLedgerRow) {
  return (
    financeNumber(row.openingBalance) !== 0 ||
    financeNumber(row.posReceiptAmount) !== 0 ||
    financeNumber(row.manualReceiptAmount) !== 0 ||
    financeNumber(row.manualPaymentAmount) !== 0 ||
    financeNumber(row.totalReceipt) !== 0 ||
    financeNumber(row.totalPayment) !== 0 ||
    financeNumber(row.netAmount) !== 0 ||
    financeNumber(row.closingBalance) !== 0 ||
    financeNumber(row.countedAmount) !== 0 ||
    financeNumber(row.differenceAmount) !== 0
  );
}

function normalizeLedgerCoreRow(row: DailyLedgerRow): DailyLedgerRow {
  const totalReceipt = financeNumber(
    row.totalReceipt ?? financeNumber(row.posReceiptAmount) + financeNumber(row.manualReceiptAmount),
  );
  const totalPayment = financeNumber(row.totalPayment ?? row.manualPaymentAmount);
  const netAmount = financeNumber(row.netAmount ?? totalReceipt - totalPayment);
  const openingBalance = financeNumber(row.openingBalance);
  const closingBalance = financeNumber(row.closingBalance ?? openingBalance + netAmount);

  return {
    ...row,
    date: String(row.date || '').slice(0, 10),
    branchName: canonicalBranchName(row.branchName || row.branchId),
    openingBalance,
    posReceiptAmount: financeNumber(row.posReceiptAmount),
    manualReceiptAmount: financeNumber(row.manualReceiptAmount),
    manualPaymentAmount: financeNumber(row.manualPaymentAmount ?? totalPayment),
    totalReceipt,
    totalPayment,
    netAmount,
    closingBalance,
    countedAmount: row.countedAmount === null || row.countedAmount === undefined ? null : financeNumber(row.countedAmount),
    differenceAmount: row.differenceAmount === null || row.differenceAmount === undefined ? null : financeNumber(row.differenceAmount),
  };
}

function ledgerBusinessKeyStrict(row: DailyLedgerRow) {
  const branchName = canonicalBranchName(row.branchName || row.branchId);
  return [
    String(row.date || '').slice(0, 10) || 'NO_DATE',
    branchName || 'NO_BRANCH',
    canonicalSourceKey(row, branchName) || 'NO_SOURCE',
  ].join('|');
}
`;
  src = src.replace(insertAfter, (m) => `${m}${helper}`);
}

// 4) Thay toàn bộ block ledgerLiveRows + ledgerRows bằng bản core-first, fallback-only.
const newLedgerRowsBlock = `const ledgerLiveRows = useMemo(() => {
    // Fallback duy nhất khi /finance/daily-ledger rỗng. Không dùng để ghi đè ledger core.
    return safeRows(ledgerLiveData?.payments || ledgerLiveData?.rows || ledgerLiveData);
  }, [ledgerLiveData]);

  const ledgerRows = useMemo(() => {
    const coreRows = safeLedgerRows(ledgerData)
      .map((row) => {
        const normalized = normalizeLedgerCoreRow(row);
        return closedLedgerKeys.has(ledgerRowKey(normalized))
          ? {
              ...normalized,
              status: 'LOCKED',
              countedAmount: normalized.countedAmount ?? normalized.closingBalance ?? 0,
              differenceAmount: normalized.differenceAmount ?? 0,
            }
          : normalized;
      })
      .filter((row) => row.date && row.branchName && row.branchName !== '—');

    // NGUYÊN TẮC CHỐT: nếu core đã trả ledger rows thì core là nguồn sự thật.
    // Không patch live payment vào core ở frontend nữa để tránh sai dây chuyền số dư đầu/cuối.
    if (coreRows.length) {
      const map = new Map<string, DailyLedgerRow>();

      coreRows.forEach((row) => {
        const key = ledgerBusinessKeyStrict(row);
        const existing = map.get(key);
        if (!existing) {
          map.set(key, { ...row });
          return;
        }

        // Backend đôi khi trả trùng một business key. Nếu số giống nhau thì bỏ bản lặp,
        // nếu là mảnh khác nhau thì cộng để vẫn không mất tiền.
        const sameNumbers =
          financeNumber(existing.openingBalance) === financeNumber(row.openingBalance) &&
          financeNumber(existing.totalReceipt) === financeNumber(row.totalReceipt) &&
          financeNumber(existing.totalPayment) === financeNumber(row.totalPayment) &&
          financeNumber(existing.closingBalance) === financeNumber(row.closingBalance);

        if (!sameNumbers) mergeLedgerAmount(existing, row);
        if (String(row.status || '').toUpperCase() === 'LOCKED') existing.status = 'LOCKED';
      });

      return Array.from(map.values()).sort((a, b) => {
        const dateDiff = String(b.date || '').localeCompare(String(a.date || ''));
        if (dateDiff !== 0) return dateDiff;
        const branchDiff = branchSortWeight(a.branchName) - branchSortWeight(b.branchName);
        if (branchDiff !== 0) return branchDiff;
        return String(a.paymentSourceName || a.paymentSourceCode || '').localeCompare(
          String(b.paymentSourceName || b.paymentSourceCode || ''),
          'vi',
        );
      });
    }

    // Fallback chống trắng bảng: chỉ chạy khi /finance/daily-ledger không có dòng nào.
    const fallback = new Map<string, DailyLedgerRow>();

    ledgerLiveRows.forEach((row) => {
      const dateKey = rowDateKey(row);
      if (!dateKey) return;

      const rawAmount = financeNumber(row.amount);
      if (!rawAmount) return;

      const amount = Math.abs(rawAmount);
      const branchName = canonicalBranchName(displayBranchName(row));
      if (!branchName || branchName === '—') return;

      const sourceName = displaySourceName(row);
      const sourceCode = row.sourceCode || row.method || row.paymentSourceId || sourceName;
      const sourceType = sourceKind(row);
      const sourceKey = canonicalSourceKey(
        {
          sourceType,
          paymentSourceName: sourceName,
          paymentSourceCode: sourceCode,
          paymentSourceId: row.paymentSourceId,
        },
        branchName,
      );
      const key = [dateKey, branchName, sourceKey].join('|');

      const current =
        fallback.get(key) ||
        ({
          date: dateKey,
          branchId: row.branchId,
          branchName,
          paymentSourceId: row.paymentSourceId || sourceCode,
          paymentSourceName: sourceName,
          paymentSourceCode: sourceCode,
          sourceType,
          openingBalance: 0,
          posReceiptAmount: 0,
          manualReceiptAmount: 0,
          manualPaymentAmount: 0,
          totalReceipt: 0,
          totalPayment: 0,
          netAmount: 0,
          closingBalance: 0,
          countedAmount: null,
          differenceAmount: null,
          status: 'OPEN',
          isSyntheticLive: true,
        } as DailyLedgerRow);

      if (isReceiptRow(row)) {
        if (isPosRow(row) || String(row.recordType || '').toUpperCase() === 'PAYMENT') {
          current.posReceiptAmount = financeNumber(current.posReceiptAmount) + amount;
        } else {
          current.manualReceiptAmount = financeNumber(current.manualReceiptAmount) + amount;
        }
        current.totalReceipt = financeNumber(current.totalReceipt) + amount;
      } else {
        current.manualPaymentAmount = financeNumber(current.manualPaymentAmount) + amount;
        current.totalPayment = financeNumber(current.totalPayment) + amount;
      }

      current.netAmount = financeNumber(current.totalReceipt) - financeNumber(current.totalPayment);
      current.closingBalance = financeNumber(current.openingBalance) + financeNumber(current.netAmount);
      fallback.set(key, current);
    });

    return Array.from(fallback.values())
      .filter(hasLedgerMoney)
      .sort((a, b) => {
        const dateDiff = String(b.date || '').localeCompare(String(a.date || ''));
        if (dateDiff !== 0) return dateDiff;
        const branchDiff = branchSortWeight(a.branchName) - branchSortWeight(b.branchName);
        if (branchDiff !== 0) return branchDiff;
        return String(a.paymentSourceName || a.paymentSourceCode || '').localeCompare(
          String(b.paymentSourceName || b.paymentSourceCode || ''),
          'vi',
        );
      });
  }, [ledgerData, ledgerLiveRows, closedLedgerKeys, branchNameById, paymentSourceNameById]);

  `;

replaceOrFail(
  'ledgerLiveRows + ledgerRows block',
  /const ledgerLiveRows = useMemo\([\s\S]*?\n\s*\}, \[ledgerData, ledgerLiveRows, closedLedgerKeys\]\);\s*\n\s*/,
  newLedgerRowsBlock,
);

// 5) Sửa ledgerSummary nếu bản cũ đang cộng opening từng row theo cả range hoặc cashClosing theo toàn range.
src = src.replace(
  /const ledgerSummary = useMemo\(\(\) => \{[\s\S]*?\n\s*\}, \[ledgerRows\]\);/,
  `const ledgerSummary = useMemo(() => {
    const acc = {
      opening: 0,
      receipt: 0,
      payment: 0,
      net: 0,
      closing: 0,
      difference: 0,
      cashClosing: 0,
      locked: 0,
      open: 0,
    };

    const rowsByDate = new Map<string, DailyLedgerRow[]>();

    ledgerRows.forEach((row) => {
      const dateKey = String(row.date || '').slice(0, 10);
      if (!dateKey) return;
      const list = rowsByDate.get(dateKey) || [];
      list.push(row);
      rowsByDate.set(dateKey, list);

      acc.receipt += financeNumber(row.totalReceipt);
      acc.payment += financeNumber(row.totalPayment);
      acc.net += financeNumber(row.netAmount);
      acc.difference += financeNumber(row.differenceAmount);

      if (String(row.status || '').toUpperCase() === 'LOCKED') acc.locked += 1;
      else acc.open += 1;
    });

    const dates = Array.from(rowsByDate.keys()).sort();
    const firstRows = rowsByDate.get(dates[0] || '') || [];
    const lastRows = rowsByDate.get(dates[dates.length - 1] || '') || [];

    acc.opening = firstRows.reduce((sum, row) => sum + financeNumber(row.openingBalance), 0);
    acc.closing = lastRows.reduce((sum, row) => sum + financeNumber(row.closingBalance), 0);
    acc.cashClosing = lastRows.reduce(
      (sum, row) => sum + (isCashLedgerRow(row) ? financeNumber(row.closingBalance) : 0),
      0,
    );

    return acc;
  }, [ledgerRows]);`,
);

fs.writeFileSync(target, src);

console.log('✅ Đã patch FinanceDailyPageClient.tsx');
console.log(`Backup: ${backup}`);
console.log('Tiếp theo chạy: npm run build');
