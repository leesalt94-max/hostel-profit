// ── 월 기준 박수 (기존 알고리즘 그대로) ──
const WD_NIGHTS = 21.74; // 월~목+일 (5/7 × 30.44)
const WE_NIGHTS = 8.70;  // 금+토 (2/7 × 30.44)

const PLATFORM_FEE = { air: 0.155, book: 0.175, direct: 0 };

// ── 단일 숙소 월/연 매출 계산 (에어비앤비 단가 기반) ──
function calcUnitRevenue(wdPrice, weMult, wdOcc, weOcc, platform) {
  const wePrice = wdPrice * weMult;
  const fee = PLATFORM_FEE[platform] ?? 0;
  const grossMo = wdPrice * (wdOcc / 100) * WD_NIGHTS
                + wePrice * (weOcc / 100) * WE_NIGHTS;
  const netMo = grossMo * (1 - fee);
  return {
    wePrice,
    grossMo,
    netMo,
    grossAnnual: grossMo * 12,
    netAnnual:   netMo  * 12,
    fee,
  };
}

// ── 호스텔 객실별 월/연 매출 계산 ──
function calcHostelRevenue(rooms, wdPrices, weMult, wdOcc, weOcc, platform) {
  const fee = PLATFORM_FEE[platform] ?? 0;
  const detail = {};
  let grossMo = 0;
  [4, 6, 8].forEach(t => {
    const cnt = rooms[t] || 0;
    const wdP = wdPrices[t] || 0;
    const weP = wdP * weMult;
    const roomGrossMo = (wdP * (wdOcc / 100) * WD_NIGHTS
                       + weP * (weOcc / 100) * WE_NIGHTS) * cnt;
    detail[t] = { wdP, weP, cnt, roomGrossMo };
    grossMo += roomGrossMo;
  });
  const netMo = grossMo * (1 - fee);
  return {
    detail,
    grossMo,
    netMo,
    grossAnnual: grossMo * 12,
    netAnnual:   netMo  * 12,
    fee,
  };
}

// ── 법인세 (지방소득세 포함) ──
function corpTax(profit) {
  if (profit <= 0) return 0;
  const base = profit <= 200_000_000
    ? profit * 0.09
    : 200_000_000 * 0.09 + (profit - 200_000_000) * 0.19;
  return base * 1.1;
}

// ── 종합소득세 (지방세 포함) ──
function incomeTax(income) {
  if (income <= 0) return 0;
  const B = [
    [12e6, 0.06, 0],        [46e6, 0.15, 1.08e6],
    [88e6, 0.24, 5.22e6],   [150e6, 0.35, 14.9e6],
    [300e6, 0.38, 19.4e6],  [500e6, 0.40, 25.4e6],
    [Infinity, 0.42, 35.4e6],
  ];
  for (const [lim, rate, deduct] of B) {
    if (income <= lim) return Math.max(0, income * rate - deduct) * 1.1;
  }
}

// ── 근로소득공제 ──
function wageDeduction(w) {
  if (w <= 5e6)   return w * 0.70;
  if (w <= 15e6)  return 3.5e6  + (w - 5e6)   * 0.40;
  if (w <= 45e6)  return 7.5e6  + (w - 15e6)  * 0.15;
  if (w <= 100e6) return 12e6   + (w - 45e6)  * 0.05;
  return             14.75e6 + (w - 100e6) * 0.02;
}

// ── 배당소득세 ──
function dividendTax(div, otherInc = 0) {
  const T = 20e6;
  if (div <= T) return div * 0.154;
  return T * 0.154 + Math.max(0, incomeTax(otherInc + div - T) - incomeTax(otherInc));
}

// ── 4대보험 개인 부담분 ──
function socialInsurance(salary) {
  const mo = salary / 12;
  const hp  = mo * 0.03545 * 12;
  const ltc = hp * 0.1295;
  const np  = Math.min(salary, 66e6) * 0.045;
  const emp = salary * 0.009;
  return hp + ltc + np + emp;
}

// ── 법인 최종 수취액 계산 ──
function calcTakeHome(preTaxProfit, payout, salary = 0, otherInc = 0) {
  const taxable = payout === 'sal'
    ? Math.max(0, preTaxProfit - salary)
    : preTaxProfit;

  const ct = corpTax(taxable);
  const afterCorp = Math.max(0, taxable - ct);

  let personalTax = 0, ins = 0, takeHome = 0;

  if (payout === 'div') {
    personalTax = dividendTax(afterCorp, otherInc);
    takeHome    = afterCorp - personalTax;
  } else {
    const taxableWage = Math.max(0, salary - wageDeduction(salary) - 1_500_000);
    personalTax = Math.max(0, incomeTax(taxableWage + otherInc) - incomeTax(otherInc));
    ins         = socialInsurance(salary);
    takeHome    = salary - personalTax - ins;
    if (afterCorp > 0) {
      const dTax = dividendTax(afterCorp, salary);
      takeHome  += afterCorp - dTax;
    }
  }

  return { taxable, ct, afterCorp, personalTax, ins, takeHome };
}

// ── 숫자 포맷 ──
const won = n => Math.round(n).toLocaleString('ko-KR') + '원';
const wonM = n => {
  const m = Math.round(n / 10000);
  return m.toLocaleString('ko-KR') + '만원';
};
