// 기본값. 신사 호스텔 단가 = 2026-11-06 신사역 1km 시장 조사(에어비앤비·부킹·트립) 제안값.
// 온재 = stay-hub 실적(2026-02-20~11-05: 가동률 96%, 객단가 13.3만(청소비 포함 호스트 수입), 평균 2.8박, 정산액 = 매출의 약 91%).
(function (root) {
  'use strict';
  function onjae(id, name, note, on) {
    return {
      id, name, kind: 'agency', on, note,
      qty: 1, wd: 125000, we: 155000, wdOcc: 94, weOcc: 100, stay: 2.8, clean: 0,
      channels: { share: { ab: 92, bk: 5, tp: 3, dr: 0 }, fee: { ab: 3, bk: 17.5, tp: 15, dr: 0 }, parity: false },
      agencyRate: 20, agencyBase: 'net', feeVatIncluded: false,
      cleanBy: 'owner', turnCost: 40000, corpCostMo: 0, corpCostVat: false,
      owner: { rentMo: 0, rentDeduct: false, utilMo: 200000, etcMo: 100000, stdRate: 13.8, otherInc: 0, vatType: 'simplified', inVatYr: 0 },
    };
  }
  function defaults() {
    return {
      v: 1,
      props: [
        {
          id: 'sinsa', name: '신사 호스텔', kind: 'own', on: true, note: '객실 12 · 법인 직영',
          rooms: [
            { id: 'r1', name: '1인실 (3층 여성)', qty: 7, guests: 1, stay: 2, clean: 0, turnCost: 8000, wdOcc: 60, weOcc: 85,
              price: { open: { wd: 60000, we: 75000 }, reg: { wd: 70000, we: 85000 } } },
            { id: 'r2', name: '2인 가능 1인실', qty: 2, guests: 1.5, stay: 2, clean: 0, turnCost: 10000, wdOcc: 60, weOcc: 85, twoShare: 50,
              price: { open: { wd: 70000, we: 85000, wd2: 90000, we2: 115000 }, reg: { wd: 80000, we: 95000, wd2: 105000, we2: 130000 } } },
            { id: 'r4', name: '4인실 (1층)', qty: 1, guests: 3.5, stay: 2, clean: 25000, turnCost: 25000, wdOcc: 55, weOcc: 85,
              price: { open: { wd: 170000, we: 220000 }, reg: { wd: 190000, we: 250000 } } },
            { id: 'r8', name: '8인실 (2층)', qty: 2, guests: 6, stay: 2, clean: 40000, turnCost: 40000, wdOcc: 50, weOcc: 80,
              price: { open: { wd: 260000, we: 350000 }, reg: { wd: 300000, we: 400000 } } },
          ],
          channels: { share: { ab: 60, bk: 25, tp: 15, dr: 0 }, fee: { ab: 15.5, bk: 17.5, tp: 15, dr: 0 }, parity: true },
          amenity: 1500, varVat: true,
          fixed: [
            { k: 'rent', label: '임대료', amt: 3000000, vat: true, temp: true },
            { k: 'labor', label: '인건비·4대보험', amt: 2000000, vat: false, temp: true },
            { k: 'util', label: '공과금(전기·수도·가스)', amt: 600000, vat: true, temp: true },
            { k: 'net', label: '통신·보험·PMS', amt: 200000, vat: true, temp: true },
            { k: 'goods', label: '비품·수선', amt: 200000, vat: true, temp: true },
            { k: 'loan', label: '대출 이자', amt: 0, vat: false },
            { k: 'etc', label: '기타', amt: 0, vat: true },
          ],
        },
        onjae('onjae1', '온재 1호점', '신림 3룸 · stay-hub 실적', false),
        onjae('onjae2', '온재 2호점', '1호점 아래층 · 1호점 값으로 시작', false),
      ],
      corp: { costMo: 334000, payout: 'sal', salary: 48000000, otherInc: 0, noCorpTax: false },
      plan: {
        start: '2026-11', openMonths: 3,
        ramp: [60, 80, 90],                                   // 신사 호스텔 첫 달들 가동률 비율(%)
        season: [85, 85, 100, 105, 105, 100, 105, 105, 100, 105, 90, 95], // 1~12월 가동률 비율(%)
      },
    };
  }
  const api = { defaults, onjae };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Defaults = api;
})(typeof window !== 'undefined' ? window : globalThis);
