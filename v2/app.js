// 숙소 법인 수익 시뮬레이터 v2 — 화면
(function () {
  'use strict';
  const KEY = 'hp_v2_state';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const man = v => (v < 0 ? '−' : '') + Math.round(Math.abs(v) / 1e4).toLocaleString('ko-KR') + '만';
  const won = v => (v < 0 ? '−' : '') + Math.round(Math.abs(v)).toLocaleString('ko-KR');
  const pct = v => v == null ? '—' : (Math.round(v * 1000) / 10) + '%';

  let state = load();
  let ui = { tab: 'in', sel: 'sinsa', priceSet: 'open', basis: 'first' };
  try { Object.assign(ui, JSON.parse(localStorage.getItem(KEY + '_ui') || '{}')); } catch {}

  function load() {
    const h = location.hash.match(/#s=([^&]+)/);
    if (h) { try { const s = JSON.parse(decodeURIComponent(escape(atob(h[1].replace(/-/g, '+').replace(/_/g, '/'))))); history.replaceState(null, '', location.pathname); localStorage.setItem(KEY, JSON.stringify(s)); return s; } catch {} }
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch {}
    return Defaults.defaults();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); localStorage.setItem(KEY + '_ui', JSON.stringify(ui)); } catch {} }
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 1800); }

  // path: "props.0.rooms.1.price.open.wd"
  function getP(path) { return path.split('.').reduce((o, k) => o?.[k], state); }
  function setP(path, val) { const ks = path.split('.'); let o = state; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks.at(-1)] = val; }

  const num = (path, opt = {}) => `<input type="number" data-p="${path}" value="${getP(path) ?? ''}" step="${opt.step || 'any'}" class="${opt.cls || ''}" inputmode="decimal">`;
  const txt = (path, cls = 'nm') => `<input type="text" data-p="${path}" data-t="s" value="${esc(getP(path))}" class="${cls}">`;
  const chk = (path, label) => `<label class="chk"><input type="checkbox" data-p="${path}" data-t="b" ${getP(path) ? 'checked' : ''}>${label}</label>`;
  const sel = (path, opts) => `<select data-p="${path}" data-t="s">${opts.map(([v, l]) => `<option value="${v}" ${String(getP(path)) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;

  // ── 사업장 카드 ──
  function renderProps() {
    $('#props').innerHTML = state.props.map((p, i) => `
      <div class="pc ${ui.sel === p.id ? 'sel' : ''} ${p.on ? '' : 'off'}" data-act="sel" data-id="${p.id}">
        <button class="sw ${p.on ? 'on' : ''}" data-act="toggle" data-id="${p.id}" aria-label="켜기/끄기"></button>
        <b>${esc(p.name)}</b><span class="lab">${esc(p.note || '')}</span><br>
        <span class="tag ${p.kind === 'own' ? 't-own' : 't-ag'}">${p.kind === 'own' ? '법인 직영' : '위탁 ' + p.agencyRate + '%'}</span>
      </div>`).join('') + `<button class="pc add" data-act="addAgency">+ 위탁 숙소 추가</button>`;
  }

  function channelBlock(base) {
    const ch = getP(base + '.channels');
    return `<div class="tw"><table>
      <tr><th>채널</th>${Calc.CH.map(c => `<th>${Calc.CH_LABEL[c]}</th>`).join('')}</tr>
      <tr><td>예약 비중(%)</td>${Calc.CH.map(c => `<td>${num(base + '.channels.share.' + c, { cls: 'xs', step: 5 })}</td>`).join('')}</tr>
      <tr><td>수수료(%)</td>${Calc.CH.map(c => `<td>${num(base + '.channels.fee.' + c, { cls: 'xs', step: 0.5 })}</td>`).join('')}</tr>
    </table></div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:6px">
      ${chk(base + '.channels.parity', '부킹·트립은 같은 순수익이 남게 가격 자동 조정')}
      <span class="lab">에어비앤비 수수료:</span>
      <button class="btn" data-act="abfee" data-base="${base}" data-v="15.5">호스트 전액 15.5%</button>
      <button class="btn" data-act="abfee" data-base="${base}" data-v="3">분담 3%</button>
    </div>
    ${(() => { const s = Calc.CH.reduce((a, c) => a + (+ch.share[c] || 0), 0); return Math.abs(s - 100) > 0.5 ? `<div class="warn">예약 비중 합계 ${s}% → 100%로 맞춰 계산해요</div>` : ''; })()}`;
  }

  // ── 직영 편집 ──
  function ownEditor(p, i) {
    const b = 'props.' + i, ps = ui.priceSet;
    const rooms = p.rooms.map((r, j) => {
      const rb = `${b}.rooms.${j}`, two = r.twoShare != null;
      return `<tr>
        <td>${txt(rb + '.name')}</td>
        <td>${num(rb + '.qty', { cls: 'xs', step: 1 })}</td>
        <td>${num(`${rb}.price.${ps}.wd`, { step: 5000 })}${two ? `<div class="lab">2인 ${num(`${rb}.price.${ps}.wd2`, { step: 5000 })}</div>` : ''}</td>
        <td>${num(`${rb}.price.${ps}.we`, { step: 5000 })}${two ? `<div class="lab">2인 ${num(`${rb}.price.${ps}.we2`, { step: 5000 })}</div>` : ''}</td>
        <td>${num(rb + '.wdOcc', { cls: 'xs', step: 5 })}</td>
        <td>${num(rb + '.weOcc', { cls: 'xs', step: 5 })}</td>
        <td>${num(rb + '.clean', { cls: 'sm', step: 5000 })}</td>
        <td>${num(rb + '.stay', { cls: 'xs', step: 0.5 })}</td>
        <td>${num(rb + '.guests', { cls: 'xs', step: 0.5 })}</td>
        <td>${num(rb + '.turnCost', { cls: 'sm', step: 1000 })}</td>
        <td>${two ? num(rb + '.twoShare', { cls: 'xs', step: 10 }) : `<button class="btn" data-act="addTwo" data-p="${rb}" title="2인 가격 추가">+2인</button>`}</td>
        <td><button class="x" data-act="delRoom" data-i="${i}" data-j="${j}" title="삭제">×</button></td>
      </tr>`;
    }).join('');
    const fixed = p.fixed.map((f, j) => `<div class="fl"><span>${txt(`${b}.fixed.${j}.label`, 'nm')} ${f.temp ? '<span class="lab" style="color:var(--c3)">임시값</span>' : ''}</span>
      <span>${num(`${b}.fixed.${j}.amt`, { step: 100000, cls: f.temp ? 'temp' : '' })} ${chk(`${b}.fixed.${j}.vat`, '세금계산서')} <button class="x" data-act="delFixed" data-i="${i}" data-j="${j}">×</button></span></div>`).join('');
    return `
    <div class="card">
      <div class="h">${esc(p.name)} · 객실 단가 <span class="lab">에어비앤비 게스트 결제가(부가세 포함)</span>
        <span class="r seg" id="pset"><button data-pset="open" class="${ps === 'open' ? 'on' : ''}">오픈 특가</button><button data-pset="reg" class="${ps === 'reg' ? 'on' : ''}">정상가</button></span></div>
      <div class="tw"><table>
        <tr><th>객실</th><th>수량</th><th>평일 1박</th><th>주말 1박</th><th>평일 가동%</th><th>주말 가동%</th><th>청소비(1회)</th><th>평균 박</th><th>평균 인원</th><th>1회 청소·세탁비</th><th>2인 판매%</th><th></th></tr>
        ${rooms}
      </table></div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="btn" data-act="addRoom" data-i="${i}">+ 객실 유형 추가</button>
        <button class="btn" data-act="survey" data-i="${i}">시장 조사 제안가 다시 불러오기</button>
      </div>
      <div class="note">'${ps === 'open' ? '오픈 특가' : '정상가'}' 가격을 고치는 중이에요. 첫 12개월은 오픈 특가 ${state.plan.openMonths}개월 → 정상가, 안정기 1년은 정상가로 계산해요. 가동률은 계절·오픈 초기 비율이 곱해져요(아래 '계산 기간').</div>
    </div>
    <div class="grid2">
      <div class="card"><div class="h">판매 채널</div>${channelBlock(b)}
        <div class="note">기준 가격 = 에어비앤비 가격. 자동 조정을 켜면 부킹은 수수료 차이만큼 비싸게 팔아 같은 순수익이 남아요(오늘 단가표의 '부킹 입력가').</div></div>
      <div class="card"><div class="h">월 고정비 <span class="r lab">부가세 포함 금액</span></div>${fixed}
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center"><button class="btn" data-act="addFixed" data-i="${i}">+ 항목</button>
        <span class="lab">어메니티(1인 1박)</span>${num(b + '.amenity', { cls: 'sm', step: 500 })} ${chk(b + '.varVat', '청소·어메니티 세금계산서')}</div>
        <div class="note">노란 칸은 임시값이에요. 실제 금액으로 바꿔 주세요. 1회 청소·세탁비는 객실 표에 있어요(예약 1건마다).</div></div>
    </div>`;
  }

  // ── 위탁 편집 ──
  function agencyEditor(p, i) {
    const b = 'props.' + i;
    return `
    <div class="card">
      <div class="h">${txt(b + '.name')} <span class="lab">위탁 숙소</span> <button class="btn r" data-act="delProp" data-i="${i}">이 숙소 삭제</button></div>
      <div class="grid2">
        <div>
          <div class="fl"><label>평일 1박 <span class="lab">호스트 매출 기준(청소비 포함 가능)</span></label>${num(b + '.wd', { step: 5000 })}</div>
          <div class="fl"><label>주말 1박</label>${num(b + '.we', { step: 5000 })}</div>
          <div class="fl"><label>평일 / 주말 가동률(%)</label><span>${num(b + '.wdOcc', { cls: 'xs', step: 5 })} ${num(b + '.weOcc', { cls: 'xs', step: 5 })}</span></div>
          <div class="fl"><label>평균 숙박(박) · 청소비 수입(1회)</label><span>${num(b + '.stay', { cls: 'xs', step: 0.1 })} ${num(b + '.clean', { cls: 'sm', step: 5000 })}</span></div>
          <div class="fl"><label>1회 청소·세탁비 · 누가 내나</label><span>${num(b + '.turnCost', { cls: 'sm', step: 5000 })} ${sel(b + '.cleanBy', [['owner', '주인'], ['corp', '법인']])}</span></div>
          ${p.id === 'onjae1' || p.id === 'onjae2' ? `<div class="note">기본값 = stay-hub 실적(2/20~11/5): 가동률 96%, 객단가 13.3만(청소비 포함), 평균 2.8박, 정산액 ≈ 매출 91%. <button class="btn" data-act="onjaeDefault" data-i="${i}">실적 기본값으로</button></div>` : ''}
        </div>
        <div>
          <div class="fl"><label>위탁료율(%)</label>${num(b + '.agencyRate', { cls: 'xs', step: 1 })}</div>
          <div class="fl"><label>위탁료 기준</label>${sel(b + '.agencyBase', [['net', 'OTA 수수료 뺀 정산액'], ['gross', 'OTA 매출(수수료 전)']])}</div>
          <div class="fl"><label>위탁료 부가세</label>${sel(b + '.feeVatIncluded', [['false', '별도(주인이 10% 추가)'], ['true', '포함']])}</div>
          <div class="fl"><label>법인이 이 숙소에 쓰는 비용(월)</label><span>${num(b + '.corpCostMo', { step: 50000 })} ${chk(b + '.corpCostVat', '세금계산서')}</span></div>
        </div>
      </div>
    </div>
    <div class="grid2">
      <div class="card"><div class="h">판매 채널</div>${channelBlock(b)}</div>
      <div class="card"><div class="h">주인(개인) 쪽 <span class="lab">주인마다 따로 계산</span></div>
        <div class="fl"><label>월 임대료 ${chk(b + '.owner.rentDeduct', '경비 인정')}</label>${num(b + '.owner.rentMo', { step: 100000 })}</div>
        <div class="fl"><label>월 공과금</label>${num(b + '.owner.utilMo', { step: 50000 })}</div>
        <div class="fl"><label>월 기타 비용(비품 등)</label>${num(b + '.owner.etcMo', { step: 50000 })}</div>
        <div class="fl"><label>기준경비율(%) · 다른 소득(연)</label><span>${num(b + '.owner.stdRate', { cls: 'xs', step: 0.1 })} ${num(b + '.owner.otherInc', { step: 1000000 })}</span></div>
        <div class="fl"><label>부가세</label>${sel(b + '.owner.vatType', [['simplified', '간이과세'], ['general', '일반과세']])}</div>
        <div class="note">이전 통합 계산기와 같은 기준경비율 방식이에요. 임대료는 기본적으로 세금 경비로 안 넣고 현금 지출로만 빼요('경비 인정' 체크 시 경비 포함).</div></div>
    </div>`;
  }

  function renderEditor() {
    const i = state.props.findIndex(p => p.id === ui.sel);
    if (i < 0) { ui.sel = state.props[0].id; return renderEditor(); }
    const p = state.props[i];
    $('#editor').innerHTML = p.kind === 'own' ? ownEditor(p, i) : agencyEditor(p, i);
  }

  function renderCorp() {
    const c = state.corp;
    $('#corp').innerHTML = `<div class="h">법인 · 대표 수취 방식</div>
      <div class="fl"><label>법인 유지비(월) <span class="lab">세무·등기 등, 사업장과 별도</span></label>${num('corp.costMo', { step: 10000 })}</div>
      <div class="fl"><label>이익 가져가는 방식</label>${sel('corp.payout', [['sal', '급여 + 남는 이익 배당'], ['div', '전액 배당'], ['ret', '급여만, 나머지 법인 유보']])}</div>
      <div class="fl ${c.payout === 'div' ? 'hide' : ''}"><label>대표 급여(연)</label>${num('corp.salary', { step: 1000000 })}</div>
      <div class="fl"><label>대표 다른 소득(연)</label>${num('corp.otherInc', { step: 1000000 })}</div>
      <div class="fl"><label>${chk('corp.noCorpTax', '법인세 0원(이월결손금)')}</label><span></span></div>`;
  }
  function renderPlan() {
    const pl = state.plan, mn = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    $('#plan').innerHTML = `<div class="h">계산 기간 · 가동률 보정</div>
      <div class="fl"><label>시작 월 · 오픈 특가 기간(개월)</label><span><input type="month" data-p="plan.start" data-t="s" value="${pl.start}" style="width:130px"> ${num('plan.openMonths', { cls: 'xs', step: 1 })}</span></div>
      <div class="fl"><label>오픈 초기 가동률 비율(%) <span class="lab">신사 첫 1·2·3개월</span></label><span>${[0, 1, 2].map(k => num('plan.ramp.' + k, { cls: 'xs', step: 5 })).join(' ')}</span></div>
      <div class="lab" style="margin:8px 0 4px">월별 계절 비율(%) — 입력한 가동률 × 이 비율 (최대 100%)</div>
      <div class="tw"><table><tr>${mn.map(m => `<th>${m}</th>`).join('')}</tr><tr>${pl.season.map((_, k) => `<td style="position:static">${num('plan.season.' + k, { cls: 'xs', step: 5 })}</td>`).join('')}</tr></table></div>`;
  }

  // ── 결과 ──
  function sim(opts = {}) { return Calc.simulate(state, { basis: ui.basis, ...opts }); }

  function renderResults() {
    const r = sim(), be = Calc.breakEven(state, ui.basis);
    const own = r.props.filter(x => x.p.kind === 'own'), ag = r.props.filter(x => x.p.kind === 'agency');
    const S = (arr, k) => arr.reduce((s, x) => s + (x.y[k] || 0), 0);
    const gross = S(own, 'gross'), comm = S(own, 'commission'), vat = S(own, 'vat'), costs = S(own, 'costs');
    const agRev = S(ag, 'corpRevenue'), agCost = S(ag, 'corpCost') - S(ag, 'corpInVat');
    const th = r.th, basisL = ui.basis === 'first' ? `첫 12개월(${state.plan.start}~)` : '안정기 1년(정상가)';
    const personal = th.personalTax + th.ins + th.divTax;
    const inflow = gross + agRev;
    const parts = [
      ['수수료', comm, 'var(--c5)'], ['부가세', Math.max(0, vat), 'var(--c4)'], ['운영비', costs + agCost + r.corpCostYr, 'var(--c6)'],
      ['법인세', th.ct, 'var(--c3)'], ['대표 개인세·보험', personal, 'var(--c1)'], [state.corp.payout === 'ret' ? '대표 급여 수령' : '대표 수취', th.home, 'var(--c2)'], ['법인 유보', th.retained, 'var(--acc)'],
    ].filter(x => x[1] > 0);
    const tot = parts.reduce((s, x) => s + x[1], 0) || 1;

    const cols = r.props;
    const row = (label, f, cls = '') => `<tr class="${cls}"><td>${label}</td>${cols.map(x => `<td>${f(x) == null ? '' : man(f(x))}</td>`).join('')}<td>${man(cols.reduce((s, x) => s + (f(x) || 0), 0))}</td></tr>`;
    const pl = `<div class="tw"><table>
      <tr><th>법인 손익 (${basisL})</th>${cols.map(x => `<th>${esc(x.p.name)}</th>`).join('')}<th>합계</th></tr>
      ${row('게스트 결제 매출', x => x.p.kind === 'own' ? x.y.gross : null)}
      ${row('− 채널 수수료', x => x.p.kind === 'own' ? -x.y.commission : null)}
      ${row('− 부가세 납부(매출×10/110 − 매입)', x => x.p.kind === 'own' ? -x.y.vat : null)}
      ${row('+ 위탁료 수입(공급가)', x => x.p.kind === 'agency' ? x.y.corpRevenue : null)}
      ${row('− 운영비(고정+청소·어메니티, 매입세액 뺀)', x => x.p.kind === 'own' ? -(x.y.costs - x.y.inVat) : -(x.y.corpCost - x.y.corpInVat))}
      <tr><td>− 법인 유지비</td>${cols.map(() => '<td></td>').join('')}<td>${man(-r.corpCostYr)}</td></tr>
      <tr class="sum"><td>= 법인 세전 이익</td>${cols.map(x => `<td>${man(x.p.kind === 'own' ? x.y.profit : x.y.corpProfit)}</td>`).join('')}<td>${man(r.preTax)}</td></tr>
    </table></div>`;
    const ownNote = own.length ? (() => { const y = own[0].y; return `<div class="note">${esc(own[0].p.name)}: 판 밤 ${Math.round(y.nights).toLocaleString()}박 · 평균 가동률 ${pct(y.occ)} · 1박 평균 결제가 ${won(y.gross / (y.nights || 1))}원 · 예약 약 ${Math.round(y.turns)}건 · 매입세액 ${man(y.inVat)}</div>`; })() : '';

    const tax = `<div class="tw"><table>
      <tr><th>세금·수취</th><th>금액</th></tr>
      <tr><td>법인 세전 이익</td><td>${man(r.preTax)}</td></tr>
      ${th.salary ? `<tr><td>− 대표 급여(비용)</td><td>${man(-th.salary)}</td></tr>` : ''}
      ${th.corpLoss < 0 ? `<tr><td class="neg">급여가 이익보다 커서 법인 적자</td><td class="neg">${man(th.corpLoss)}</td></tr>` : ''}
      <tr><td>− 법인세(지방세 포함)${state.corp.noCorpTax ? ' · 0원 적용' : ''}</td><td>${man(-th.ct)}</td></tr>
      <tr><td>${state.corp.payout === 'ret' ? '법인 유보' : '배당'}</td><td>${man(state.corp.payout === 'ret' ? th.retained : th.afterCorp)}</td></tr>
      ${th.salary ? `<tr class="sub"><td>급여 소득세 · 4대보험(개인)</td><td>${man(-(th.personalTax + th.ins))}</td></tr>` : ''}
      ${th.divTax ? `<tr class="sub"><td>배당소득세</td><td>${man(-th.divTax)}</td></tr>` : ''}
      <tr class="sum"><td>대표 최종 수취액(연)</td><td>${man(th.home)}</td></tr>
    </table></div>`;

    // 12개월 막대
    const W = 640, H = 170, P = 26, mx = Math.max(1, ...r.rows.map(x => Math.abs(x.corpProfit)));
    const y0 = r.rows.some(x => x.corpProfit < 0) ? H / 2 : H - 22, sc = (y0 - 14) / mx, bw = (W - P * 2) / 12;
    const bars = r.rows.map((x, k) => { const h = Math.abs(x.corpProfit) * sc, y = x.corpProfit >= 0 ? y0 - h : y0; const isOpen = ui.basis === 'first' && k < state.plan.openMonths;
      return `<rect x="${P + k * bw + 4}" y="${y}" width="${bw - 8}" height="${Math.max(1, h)}" rx="3" fill="${x.corpProfit < 0 ? 'var(--neg)' : isOpen ? 'color-mix(in oklab,var(--acc) 45%,transparent)' : 'var(--acc)'}"><title>${x.key} 법인 세전 ${man(x.corpProfit)}</title></rect>
      <text x="${P + k * bw + bw / 2}" y="${x.corpProfit >= 0 ? y - 4 : y + h + 11}" font-size="10" text-anchor="middle" fill="var(--mut)">${Math.round(x.corpProfit / 1e4)}</text>
      <text x="${P + k * bw + bw / 2}" y="${H - 6}" font-size="10" text-anchor="middle" fill="var(--mut)">${x.m}월</text>`; }).join('');
    const chart = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:190px"><line x1="${P}" x2="${W - P}" y1="${y0}" y2="${y0}" stroke="var(--line)"/>${bars}</svg>
      <div class="lab">막대 = 월 법인 세전 이익(만 원)${ui.basis === 'first' ? ` · 연한 막대 = 오픈 특가 ${state.plan.openMonths}개월` : ''} · 계절 비율과 오픈 초기 가동률 반영</div>`;

    const noAgency = id => { const s2 = JSON.parse(JSON.stringify(state)); s2.props.find(p => p.id === id).agencyRate = 0; return Calc.simulate(s2, { basis: ui.basis, only: [id] }).props[0].y.owner.home; };
    const owners = ag.map(x => { const o = x.y.owner, y = x.y; return `<div class="card"><div class="h">${esc(x.p.name)} 주인(개인) <span class="r lab">${basisL}</span></div><div class="tw"><table>
      <tr><td>OTA 매출 (가동률 ${pct(y.occ)})</td><td>${man(y.gross)}</td></tr>
      <tr><td>− OTA 수수료</td><td>${man(-y.commission)}</td></tr>
      <tr><td>− 위탁료 ${x.p.agencyRate}%${x.p.feeVatIncluded ? '' : ' + 부가세'}</td><td>${man(-y.ownerPaysFee)}</td></tr>
      <tr><td>− 청소·공과금·임대료 등</td><td>${man(-y.ownerCash)}</td></tr>
      <tr><td>− 종합소득세(기준경비율)</td><td>${man(-o.it)}</td></tr>
      <tr><td>− 부가세 <span class="lab">${esc(o.vatNote)}</span></td><td>${man(-o.vat)}</td></tr>
      <tr class="sum"><td>주인 실수령(연)</td><td>${man(o.home)}</td></tr>
      <tr class="sub"><td>참고: 위탁료 없이 직접 운영하면</td><td>${man(noAgency(x.p.id))}</td></tr></table></div>
      <div class="note">참고값은 같은 매출·비용에서 위탁료만 0%로 놓고 세금까지 다시 계산한 값이에요. 주인이 직접 운영할 때 드는 시간·인건비는 넣지 않았어요.</div></div>`; }).join('');

    $('#tab-res').innerHTML = `
      <div class="card">
        <div class="hero">
          <div><div class="lab">대표 최종 수취액 · ${basisL}</div><div class="big ${th.home >= 0 ? 'pos' : 'neg'}">${man(th.home)}</div><div class="lab">월 평균 ${man(th.home / 12)}</div></div>
          <div><div class="lab">법인 세전 이익</div><div class="big">${man(r.preTax)}</div><div class="lab">매출 대비 ${inflow ? Math.round(r.preTax / inflow * 100) : 0}%</div></div>
          <div><div class="lab">손익분기 가동률 (직영)</div><div class="big">${be.occ == null ? '—' : pct(be.occ)}</div><div class="lab">이 아래면 법인 적자 · 현재 ${own.length ? pct(own.reduce((s, x) => s + x.y.nights, 0) / own.reduce((s, x) => s + x.y.capNights, 0)) : '—'}</div></div>
        </div>
        <div class="lab" style="margin-top:8px">들어온 돈이 어디로 가는지 (게스트 결제 + 위탁료 ${man(inflow)})</div>
        <div class="flow">${parts.map(([l, v, c]) => `<div style="flex:${v};background:color-mix(in oklab,${c} 35%,transparent)" title="${l} ${man(v)}">${v / tot > 0.07 ? l : ''}</div>`).join('')}</div>
        <div class="legend">${parts.map(([l, v, c]) => `<span><i style="background:${c}"></i>${l} ${man(v)}</span>`).join('')}</div>
      </div>
      <div class="card"><div class="h">법인 손익</div>${pl}${ownNote}</div>
      <div class="grid2"><div class="card"><div class="h">월별 예상</div>${chart}</div><div class="card"><div class="h">세금 · 대표 수취</div>${tax}</div></div>
      ${owners}`;
  }

  function renderCompare() {
    const ids = state.props.map(p => p.id);
    const own = state.props.filter(p => p.kind === 'own').map(p => p.id);
    const ags = state.props.filter(p => p.kind === 'agency');
    const sc = [{ name: 'A. ' + state.props.filter(p => p.kind === 'own').map(p => p.name).join('·') + '만', only: own }];
    ags.forEach((a, k) => sc.push({ name: (String.fromCharCode(66 + k)) + '. + ' + ags.slice(0, k + 1).map(x => x.name).join('·') + ' 위탁', only: [...own, ...ags.slice(0, k + 1).map(x => x.id)] }));
    const rs = sc.map(s => ({ s, r: sim({ only: s.only }) }));
    const mx = Math.max(1, ...rs.map(x => x.r.th.home));
    const cards = rs.map(({ s, r }) => `<div class="cc"><div class="lab">${esc(s.name)}</div><div class="big">${man(r.th.home)}</div><div class="lab">대표 연 수취액</div>
      <div class="bar" style="width:${Math.max(4, r.th.home / mx * 100)}%"></div>
      <div class="kv"><span>법인 세전 이익</span><b>${man(r.preTax)}</b></div>
      <div class="kv"><span>법인세</span><b>${man(r.th.ct)}</b></div>
      ${r.props.filter(x => x.p.kind === 'agency').map(x => `<div class="kv"><span>${esc(x.p.name)} 위탁료 수입</span><b>${man(x.y.corpRevenue)}</b></div><div class="kv"><span>${esc(x.p.name)} 주인 실수령</span><b>${man(x.y.owner.home)}</b></div>`).join('')}
    </div>`).join('');
    const levels = [40, 50, 60, 70, 80, 90];
    const sens = ['open', 'reg'].map(ps => `<tr><td>${ps === 'open' ? '오픈 특가' : '정상가'}</td>${levels.map(l => { const r = Calc.simulate(state, { basis: 'steady', only: own, forcePrice: ps, occOverride: l }); return `<td class="${r.th.home < 0 || r.preTax < 0 ? 'neg' : ''}">${man(r.th.home)}<div class="lab">세전 ${man(r.preTax)}</div></td>`; }).join('')}</tr>`).join('');
    $('#tab-cmp').innerHTML = `<div class="cmp" style="margin-bottom:12px">${cards}</div>
      <div class="note" style="margin:-4px 0 12px">각 시나리오는 지금 입력값 그대로 · ${ui.basis === 'first' ? '첫 12개월' : '안정기 1년'} 기준 · 주인은 각각 다른 사람이라 합산하지 않아요.</div>
      <div class="card"><div class="h">가동률별 대표 수취액 (직영만, 안정기 1년, 평일·주말 같은 가동률, 계절 비율 적용)</div>
      <div class="tw"><table><tr><th>가격</th>${levels.map(l => `<th>${l}%</th>`).join('')}</tr>${sens}</table></div>
      <div class="note">같은 가격으로 1년 내내 판다고 가정한 표예요. 오픈 특가 줄은 '특가를 계속 유지하면' 얼마인지 보는 용도예요.</div></div>`;
  }

  function renderTabs() {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
    document.querySelectorAll('#basis button').forEach(b => b.classList.toggle('on', b.dataset.basis === ui.basis));
    ['in', 'res', 'cmp'].forEach(t => $('#tab-' + t).classList.toggle('hide', t !== ui.tab));
  }
  function renderAll() { renderTabs(); renderProps(); renderEditor(); renderCorp(); renderPlan(); renderOut(); }
  function renderOut() { if (ui.tab === 'res') renderResults(); if (ui.tab === 'cmp') renderCompare(); updateBadge(); }
  function updateBadge() {
    const r = sim();
    const b = $('#tabs [data-tab=res]');
    b.textContent = `② 결과 · 대표 ${man(r.th.home)}`;
  }

  // ── 이벤트 ──
  document.addEventListener('input', e => {
    const el = e.target, path = el.dataset.p; if (!path) return;
    let v = el.dataset.t === 'b' ? el.checked : el.dataset.t === 's' ? el.value : (el.value === '' ? 0 : +el.value);
    if (path.endsWith('feeVatIncluded')) v = v === 'true';
    setP(path, v); save();
    if (/\.(name|kind)$/.test(path) || path === 'corp.payout' || /agencyRate$/.test(path)) { renderProps(); if (path === 'corp.payout') renderCorp(); }
    if (/channels\.share/.test(path)) { /* 경고 갱신은 다음 렌더 */ }
    renderOut();
  });
  document.addEventListener('change', e => { if (e.target.dataset.p && /channels\.share|plan\.openMonths/.test(e.target.dataset.p)) renderEditor(); });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act],[data-tab],[data-basis],[data-pset]'); if (!t) return;
    if (t.dataset.tab) { ui.tab = t.dataset.tab; save(); renderTabs(); renderOut(); window.scrollTo({ top: 0 }); return; }
    if (t.dataset.basis) { ui.basis = t.dataset.basis; save(); renderTabs(); renderOut(); return; }
    if (t.dataset.pset) { ui.priceSet = t.dataset.pset; save(); renderEditor(); return; }
    const a = t.dataset.act, i = +t.dataset.i, j = +t.dataset.j;
    if (a === 'toggle') { e.stopPropagation(); const p = state.props.find(x => x.id === t.dataset.id); p.on = !p.on; }
    else if (a === 'sel') { ui.sel = t.dataset.id; }
    else if (a === 'addAgency') { const n = state.props.filter(p => p.kind === 'agency').length + 1; const id = 'ag' + Date.now().toString(36); const p = Defaults.onjae(id, `위탁 숙소 ${n}`, '직접 입력', true); state.props.push(p); ui.sel = id; }
    else if (a === 'delProp') { if (!confirm(state.props[i].name + ' 을(를) 삭제할까요?')) return; state.props.splice(i, 1); ui.sel = state.props[0].id; }
    else if (a === 'addRoom') { state.props[i].rooms.push({ id: 'r' + Date.now().toString(36), name: '새 객실', qty: 1, guests: 2, stay: 2, clean: 0, turnCost: 10000, wdOcc: 60, weOcc: 80, price: { open: { wd: 80000, we: 100000 }, reg: { wd: 90000, we: 110000 } } }); }
    else if (a === 'delRoom') { if (!confirm(state.props[i].rooms[j].name + ' 을(를) 삭제할까요?')) return; state.props[i].rooms.splice(j, 1); }
    else if (a === 'addTwo') { const r = getP(t.dataset.p); r.twoShare = 50; ['open', 'reg'].forEach(k => { r.price[k].wd2 = Math.round(r.price[k].wd * 1.3 / 1000) * 1000; r.price[k].we2 = Math.round(r.price[k].we * 1.3 / 1000) * 1000; }); }
    else if (a === 'addFixed') { state.props[i].fixed.push({ k: 'x' + Date.now().toString(36), label: '새 항목', amt: 0, vat: true }); }
    else if (a === 'delFixed') { state.props[i].fixed.splice(j, 1); }
    else if (a === 'abfee') { setP(t.dataset.base + '.channels.fee.ab', +t.dataset.v); }
    else if (a === 'survey') { const d = Defaults.defaults().props[0].rooms; state.props[i].rooms.forEach(r => { const m = d.find(x => x.id === r.id); if (m) r.price = JSON.parse(JSON.stringify(m.price)); }); toast('2026-11-06 시장 조사 제안가로 바꿨어요'); }
    else if (a === 'onjaeDefault') { const keep = state.props[i]; const d = Defaults.onjae(keep.id, keep.name, keep.note, keep.on); d.agencyRate = keep.agencyRate; state.props[i] = d; toast('stay-hub 실적 기본값으로 바꿨어요'); }
    else return;
    save(); renderProps(); renderEditor(); renderOut();
  });
  $('#share').onclick = async () => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(state)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const url = location.origin + location.pathname + '#s=' + s;
    try { await navigator.clipboard.writeText(url); toast('링크를 복사했어요. 다른 PC·휴대폰에서 열면 같은 값이에요'); } catch { prompt('이 링크를 복사하세요', url); }
  };
  $('#reset').onclick = () => { if (!confirm('모든 입력을 처음 값으로 되돌릴까요?')) return; state = Defaults.defaults(); save(); renderAll(); };

  renderAll();
})();
