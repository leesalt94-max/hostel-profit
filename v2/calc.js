// 숙소 법인 수익 시뮬레이터 v2 — 계산 엔진 (화면과 분리, 브라우저·node 공용)
// 금액 단위: 원. 가동률: 0~100(%). 가격은 게스트 결제가(부가세 포함) 기준.
(function (root) {
  'use strict';

  const WD_RATIO = 5 / 7, WE_RATIO = 2 / 7; // 평일(일~목) / 주말(금·토)
  const AVG_DAYS = 30.44;
  const CH = ['ab', 'bk', 'tp', 'dr'];
  const CH_LABEL = { ab: '에어비앤비', bk: '부킹', tp: '트립', dr: '직접' };

  // ── 세금 (기존 hostel-profit/new/js/tax.js 와 같은 규칙) ──
  function corpTax(profit) { // 지방소득세 포함
    if (profit <= 0) return 0;
    const base = profit <= 200e6 ? profit * 0.09 : 200e6 * 0.09 + (profit - 200e6) * 0.19;
    return base * 1.1;
  }
  function incomeTax(income) { // 종합소득세, 지방세 포함
    if (income <= 0) return 0;
    const B = [[12e6, 0.06, 0], [46e6, 0.15, 1.08e6], [88e6, 0.24, 5.22e6], [150e6, 0.35, 14.9e6], [300e6, 0.38, 19.4e6], [500e6, 0.40, 25.4e6], [Infinity, 0.42, 35.4e6]];
    for (const [lim, rate, ded] of B) if (income <= lim) return Math.max(0, income * rate - ded) * 1.1;
    return 0;
  }
  function wageDeduction(w) {
    if (w <= 5e6) return w * 0.70;
    if (w <= 15e6) return 3.5e6 + (w - 5e6) * 0.40;
    if (w <= 45e6) return 7.5e6 + (w - 15e6) * 0.15;
    if (w <= 100e6) return 12e6 + (w - 45e6) * 0.05;
    return 14.75e6 + (w - 100e6) * 0.02;
  }
  function dividendTax(div, otherInc = 0) {
    const T = 20e6;
    if (div <= T) return div * 0.154;
    return T * 0.154 + Math.max(0, incomeTax(otherInc + div - T) - incomeTax(otherInc));
  }
  function socialInsurance(salary) {
    const hp = salary * 0.03545, ltc = hp * 0.1295, np = Math.min(salary, 66e6) * 0.045, emp = salary * 0.009;
    return hp + ltc + np + emp;
  }
  // 대표 수취액. payout: 'div' 전액 배당 / 'sal' 급여 + 남은 이익 배당 / 'ret' 급여만, 나머지 법인 유보
  function takeHome(preTax, payout, salary = 0, otherInc = 0, noCorpTax = false) {
    const sal = payout === 'div' ? 0 : salary;
    const taxable = Math.max(0, preTax - sal);
    const ct = noCorpTax ? 0 : corpTax(taxable);
    const afterCorp = Math.max(0, taxable - ct);
    let personalTax = 0, ins = 0, home = 0, divTax = 0, retained = 0;
    if (sal > 0) {
      const tw = Math.max(0, sal - wageDeduction(sal) - 1.5e6);
      personalTax = Math.max(0, incomeTax(tw + otherInc) - incomeTax(otherInc));
      ins = socialInsurance(sal);
      home = sal - personalTax - ins;
    }
    if (payout === 'ret') retained = afterCorp;
    else if (afterCorp > 0) { divTax = dividendTax(afterCorp, sal + otherInc); home += afterCorp - divTax; }
    // 급여가 이익보다 크면 법인 적자(급여 지급 여력 부족) → preTax - sal 이 음수
    return { salary: sal, taxable, corpLoss: Math.min(0, preTax - sal), ct, afterCorp, personalTax, ins, divTax, retained, home };
  }

  // ── 채널 ──
  // 기준 가격 = 에어비앤비 게스트 결제가. parity 면 부킹·트립은 같은 순수익이 남도록 가격을 올린다(직접 예약은 같은 가격, 수수료 0).
  function channelFactors(ch) {
    const sh = {}, sum = CH.reduce((s, c) => s + (+ch.share[c] || 0), 0) || 1;
    CH.forEach(c => sh[c] = (+ch.share[c] || 0) / sum);
    const f = c => (+ch.fee[c] || 0) / 100;
    const k = {};
    CH.forEach(c => { k[c] = (ch.parity && (c === 'bk' || c === 'tp')) ? (1 - f('ab')) / (1 - f(c)) : 1; });
    const gross = CH.reduce((s, c) => s + sh[c] * k[c], 0);            // 기준가 1원당 게스트 결제액
    const fee = CH.reduce((s, c) => s + sh[c] * k[c] * f(c), 0);       // 기준가 1원당 수수료
    return { share: sh, k, gross, fee, effFee: fee / gross };
  }

  // ── 한 달 물량 ──
  function monthNights(days, qty, wdOcc, weOcc) {
    const wd = days * WD_RATIO * qty * Math.min(1, wdOcc / 100), we = days * WE_RATIO * qty * Math.min(1, weOcc / 100);
    return { wd, we, total: wd + we };
  }
  const clampOcc = v => Math.max(0, Math.min(100, v));

  // ── 직영 숙소(호스텔) 한 달 ──
  // opts: { days, priceSet: 'open'|'reg', occMul: 1, occOverride: null|% }
  function ownMonth(p, opts = {}) {
    const days = opts.days ?? AVG_DAYS, ps = opts.priceSet || 'reg', mul = opts.occMul ?? 1;
    const cf = channelFactors(p.channels);
    let base = 0, cleanBase = 0, nights = 0, turns = 0, guestNights = 0, varClean = 0;
    const rooms = p.rooms.map(r => {
      const pr = r.price[ps] || r.price.reg;
      const wdO = opts.occOverride != null ? opts.occOverride : clampOcc(r.wdOcc * mul);
      const weO = opts.occOverride != null ? opts.occOverride : clampOcc(r.weOcc * mul);
      const n = monthNights(days, r.qty, wdO, weO);
      const s2 = r.twoShare != null ? r.twoShare / 100 : 0; // 2인 가능 객실: 2인 판매 비율
      const wdP = pr.wd * (1 - s2) + (pr.wd2 ?? pr.wd) * s2, weP = pr.we * (1 - s2) + (pr.we2 ?? pr.we) * s2;
      const roomBase = n.wd * wdP + n.we * weP;
      const t = r.stay > 0 ? n.total / r.stay : 0;
      const cl = t * (r.clean || 0);
      base += roomBase; cleanBase += cl; nights += n.total; turns += t;
      const g = n.total * (r.guests || 1); guestNights += g;
      varClean += t * (r.turnCost || 0);
      return { id: r.id, name: r.name, nights: n.total, wdNights: n.wd, weNights: n.we, turns: t, gross: (roomBase + cl) * cf.gross, base: roomBase + cl };
    });
    const gross = (base + cleanBase) * cf.gross;            // 게스트 결제 매출 (부가세 포함)
    const commission = (base + cleanBase) * cf.fee;
    const outVat = gross / 11;                              // 매출세액 = 결제가 × 10/110
    const amenity = guestNights * (p.amenity || 0);
    const varCost = varClean + amenity;
    const fixed = (p.fixed || []).reduce((s, x) => s + (+x.amt || 0), 0);
    const inVat = ((p.fixed || []).filter(x => x.vat).reduce((s, x) => s + (+x.amt || 0), 0) + (p.varVat ? varCost : 0)) / 11; // 비용은 부가세 포함 금액으로 입력
    const vat = outVat - inVat;                              // 납부 부가세(음수면 환급)
    const costs = fixed + varCost;
    const profit = gross - commission - vat - costs;         // = (매출 공급가) − 수수료 − (비용 − 매입세액)
    const capNights = p.rooms.reduce((s, r) => s + r.qty, 0) * days;
    return { kind: 'own', gross, commission, outVat, inVat, vat, fixed, varCost, varClean, amenity, costs, profit, nights, turns, guestNights, occ: capNights ? nights / capNights : 0, rooms, effFee: cf.effFee };
  }

  // ── 위탁 숙소 한 달 (주인 매출 → 법인 위탁료) ──
  function agencyMonth(p, opts = {}) {
    const days = opts.days ?? AVG_DAYS, mul = opts.occMul ?? 1;
    const cf = channelFactors(p.channels);
    const n = monthNights(days, p.qty || 1, clampOcc(p.wdOcc * mul), clampOcc(p.weOcc * mul));
    const turns = p.stay > 0 ? n.total / p.stay : 0;
    const base = n.wd * p.wd + n.we * p.we + turns * (p.clean || 0);
    const gross = base * cf.gross;                 // 주인 매출 (OTA 기준 금액)
    const commission = base * cf.fee;
    const net = gross - commission;               // OTA 정산액
    const feeSupply = (p.agencyBase === 'gross' ? gross : net) * (p.agencyRate || 0) / 100; // 위탁료 공급가
    const feeVat = p.feeVatIncluded ? feeSupply / 11 : feeSupply * 0.1;
    const corpRevenue = p.feeVatIncluded ? feeSupply - feeVat : feeSupply; // 법인 수입(공급가)
    const ownerPaysFee = p.feeVatIncluded ? feeSupply : feeSupply + feeVat; // 주인이 내는 위탁료(부가세 포함)
    const cleanCost = turns * (p.turnCost || 0);
    const corpCost = (+p.corpCostMo || 0) + (p.cleanBy === 'corp' ? cleanCost : 0);
    const corpInVat = (p.corpCostVat ? (+p.corpCostMo || 0) : 0) / 11;
    const corpProfit = corpRevenue - (corpCost - corpInVat);
    const ownerCash = (+p.owner.rentMo || 0) + (+p.owner.utilMo || 0) + (+p.owner.etcMo || 0) + (p.cleanBy === 'corp' ? 0 : cleanCost);
    return { kind: 'agency', gross, commission, net, feeSupply, feeVat, corpRevenue, ownerPaysFee, corpCost, corpInVat, corpProfit, cleanCost, ownerCash, nights: n.total, turns, occ: n.total / ((p.qty || 1) * days), effFee: cf.effFee };
  }

  // 주인(개인) 연간 세금·실수령 — 기존 통합 계산기의 기준경비율 방식
  function ownerYear(p, y) { // y: 연간 합계 {gross, net, ownerPaysFee, feeSupply, ownerCash, cleanCost}
    const o = p.owner, std = (o.stdRate ?? 13.8) / 100;
    const incomeBase = y.net;                                   // 수입금액 = OTA 정산액
    const major = y.ownerPaysFee + (p.cleanBy === 'corp' ? 0 : y.cleanCost) + (+o.utilMo || 0) * 12 + (+o.etcMo || 0) * 12 + (o.rentDeduct ? (+o.rentMo || 0) * 12 : 0);
    const bizInc = Math.max(0, incomeBase - major - incomeBase * std);
    const it = Math.max(0, incomeTax(bizInc + (+o.otherInc || 0)) - incomeTax(+o.otherInc || 0));
    let vat = 0, vatNote = '';
    if (o.vatType === 'general') { vat = Math.max(0, y.gross / 11 - (y.feeVat || 0) - (+o.inVatYr || 0)); vatNote = '일반과세: 매출×10/110 − 매입(위탁료 부가세 등)'; }
    else if (y.gross < 48e6) { vat = 0; vatNote = '간이과세 납부면제(연 4,800만 미만)'; }
    else { vat = y.gross * 0.04; vatNote = y.gross >= 104e6 ? '간이 4% — 연 1억400만 이상은 일반과세 전환 대상' : '간이과세 ≈ 매출 4%(숙박업 부가율 40%×10%)'; }
    const cash = y.net - y.ownerPaysFee - y.ownerCash * 1; // ownerCash 는 연간 합계로 들어옴
    const home = cash - it - vat;
    return { incomeBase, major, bizInc, it, vat, vatNote, cash, home };
  }

  // ── 12개월 ──
  function monthsFrom(start, n) {
    const [y, m] = start.split('-').map(Number), out = [];
    for (let i = 0; i < n; i++) { const yy = y + Math.floor((m - 1 + i) / 12), mm = ((m - 1 + i) % 12) + 1; out.push({ key: `${yy}-${String(mm).padStart(2, '0')}`, m: mm, days: new Date(Date.UTC(yy, mm, 0)).getUTCDate(), i }); }
    return out;
  }

  // basis: 'first' 첫 12개월(오픈 특가·초기 가동률·계절) / 'steady' 안정기 1년(정상가·계절)
  function simulate(state, opts = {}) {
    const basis = opts.basis || 'first';
    const on = opts.only ? state.props.filter(p => opts.only.includes(p.id)) : state.props.filter(p => p.on);
    const plan = state.plan, months = monthsFrom(plan.start, 12);
    const rows = months.map(mo => {
      const season = (plan.season[mo.m - 1] ?? 100) / 100;
      const per = on.map(p => {
        if (p.kind === 'own') {
          const ramp = basis === 'first' ? ((plan.ramp[mo.i] ?? 100) / 100) : 1;
          const priceSet = basis === 'first' && mo.i < plan.openMonths ? 'open' : (opts.priceSet || 'reg');
          return { p, r: ownMonth(p, { days: mo.days, priceSet: opts.forcePrice || priceSet, occMul: (opts.occMul ?? 1) * season * ramp, occOverride: opts.occOverride ?? null }) };
        }
        return { p, r: agencyMonth(p, { days: mo.days, occMul: season }) };
      });
      const corpProfit = per.reduce((s, x) => s + (x.r.kind === 'own' ? x.r.profit : x.r.corpProfit), 0) - (+state.corp.costMo || 0);
      return { ...mo, per, corpProfit };
    });
    const sum = (f) => rows.reduce((s, r) => s + f(r), 0);
    const props = on.map(p => {
      const pick = r => r.per.find(x => x.p === p).r;
      const keys = p.kind === 'own' ? ['gross', 'commission', 'outVat', 'inVat', 'vat', 'fixed', 'varCost', 'costs', 'profit', 'nights', 'turns'] : ['gross', 'commission', 'net', 'feeSupply', 'feeVat', 'corpRevenue', 'ownerPaysFee', 'corpCost', 'corpInVat', 'corpProfit', 'cleanCost', 'ownerCash', 'nights', 'turns'];
      const y = {}; keys.forEach(k => y[k] = sum(r => pick(r)[k] || 0));
      if (p.kind === 'agency') y.owner = ownerYear(p, y);
      y.capNights = p.kind === 'own' ? p.rooms.reduce((s, r) => s + r.qty, 0) * sum(r => r.days) : (p.qty || 1) * sum(r => r.days);
      y.occ = y.capNights ? y.nights / y.capNights : 0;
      return { p, y };
    });
    const corpCostYr = (+state.corp.costMo || 0) * 12;
    const preTax = sum(r => r.corpProfit);
    const c = state.corp;
    const th = takeHome(preTax, c.payout, +c.salary || 0, +c.otherInc || 0, !!c.noCorpTax);
    return { basis, rows, props, preTax, corpCostYr, th };
  }

  // 손익분기: 직영 숙소 가동률을 일정 비율로 줄이고 늘려 법인 세전 이익(첫 12개월 또는 안정기)이 0이 되는 평균 가동률
  function breakEven(state, basis = 'steady') {
    const f = x => simulate(state, { basis, occMul: x }).preTax;
    if (f(0.0001) >= 0) return { occ: 0 };
    let lo = 0, hi = 3;
    if (f(hi) < 0) return { occ: null };
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
    const sim = simulate(state, { basis, occMul: hi });
    const own = sim.props.filter(x => x.p.kind === 'own');
    const n = own.reduce((s, x) => s + x.y.nights, 0), cap = own.reduce((s, x) => s + x.y.capNights, 0);
    return { occ: cap ? n / cap : null, mul: hi };
  }

  const api = { WD_RATIO, WE_RATIO, AVG_DAYS, CH, CH_LABEL, corpTax, incomeTax, dividendTax, takeHome, channelFactors, ownMonth, agencyMonth, ownerYear, monthsFrom, simulate, breakEven };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
