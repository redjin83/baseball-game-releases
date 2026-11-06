'use strict';
/* 하루메모 — 메모 + 일정 (오프라인 PWA) */

const APP_VERSION = '0.1.0';
const STORE_KEY = 'harumemo:v1';
const COLORS = ['#e08a1e', '#d6453d', '#3d7be0', '#2e9e6a', '#8a5cd6', '#7a7873'];
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

/* ---------- 저장소 ---------- */
const store = {
  data: { memos: [], events: [] },
  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        this.data = { memos: Array.isArray(d.memos) ? d.memos : [], events: Array.isArray(d.events) ? d.events : [] };
      }
    } catch (e) { console.warn('load failed', e); }
  },
  save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); }
    catch (e) { toast('저장 공간이 부족해 저장하지 못했어요.'); }
  },
};

/* ---------- 유틸 ---------- */
const $ = (s) => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayStr = () => ymd(new Date());

function fmtDateTime(ts) {
  const d = new Date(ts), now = new Date();
  if (ymd(d) === ymd(now)) return `오늘 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (ymd(d) === ymd(y)) return '어제';
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}
function fmtDay(s) {
  const d = parseYmd(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(m)}`;
}
function highlight(text, q) {
  const safe = esc(text);
  if (!q) return safe;
  const re = new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return safe.replace(re, (m) => `<mark>${m}</mark>`);
}
let toastTimer;
function toast(msg, action) {
  const el = $('#toast');
  el.innerHTML = esc(msg);
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.onclick = () => { el.hidden = true; action.run(); };
    el.appendChild(b);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 6000 : 2400);
}

/* ---------- 탭 ---------- */
let currentTab = 'memo';
function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.dataset.view !== tab; });
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  $('#fab').hidden = tab === 'settings';
  if (tab === 'memo') renderMemos();
  if (tab === 'cal') renderCalendar();
  if (tab === 'settings') renderSettings();
  window.scrollTo(0, 0);
}

/* ---------- 메모 ---------- */
let editingMemo = null;

function renderMemos() {
  const q = $('#memo-search').value.trim().toLowerCase();
  const list = $('#memo-list');
  const memos = store.data.memos
    .filter((m) => !q || (m.title + '\n' + m.body).toLowerCase().includes(q))
    .sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
  $('#memo-count').textContent = store.data.memos.length ? `${store.data.memos.length}개` : '';
  $('#memo-empty').hidden = store.data.memos.length > 0;

  let html = '';
  const pinned = memos.filter((m) => m.pinned);
  const rest = memos.filter((m) => !m.pinned);
  const item = (m) => {
    const title = m.title.trim() || m.body.trim().split('\n')[0] || '새로운 메모';
    const preview = m.title.trim() ? m.body.trim() : m.body.trim().split('\n').slice(1).join('\n');
    return `<li class="memo-item" data-id="${m.id}">
      <div class="t">${m.pinned ? '<span class="pin">📌</span>' : ''}${highlight(title, q)}</div>
      ${preview ? `<div class="p">${highlight(preview.slice(0, 200), q)}</div>` : ''}
      <div class="d">${fmtDateTime(m.updatedAt)}</div></li>`;
  };
  if (pinned.length) html += `<li class="section-label">고정됨</li>` + pinned.map(item).join('');
  if (pinned.length && rest.length) html += `<li class="section-label">메모</li>`;
  html += rest.map(item).join('');
  if (q && !memos.length) html = `<li class="empty small">“${esc(q)}” 검색 결과가 없어요.</li>`;
  list.innerHTML = html;
}

function openMemo(id) {
  const m = id ? store.data.memos.find((x) => x.id === id) : null;
  editingMemo = m ? { ...m } : { id: uid(), title: '', body: '', pinned: false, createdAt: Date.now(), updatedAt: Date.now(), isNew: true };
  $('#memo-title').value = editingMemo.title;
  $('#memo-body').value = editingMemo.body;
  $('#memo-pin').classList.toggle('on', !!editingMemo.pinned);
  $('#memo-meta').textContent = m ? fmtDateTime(m.updatedAt) : '새 메모';
  $('#memo-sheet').hidden = false;
  if (!m) setTimeout(() => $('#memo-body').focus(), 60);
}

function persistMemo() {
  if (!editingMemo) return;
  const title = $('#memo-title').value;
  const body = $('#memo-body').value;
  const idx = store.data.memos.findIndex((x) => x.id === editingMemo.id);
  if (!title.trim() && !body.trim()) {
    if (idx >= 0) { store.data.memos.splice(idx, 1); store.save(); }
    return;
  }
  const changed = idx < 0 || store.data.memos[idx].title !== title || store.data.memos[idx].body !== body || store.data.memos[idx].pinned !== editingMemo.pinned;
  if (!changed) return;
  const memo = { id: editingMemo.id, title, body, pinned: !!editingMemo.pinned, createdAt: editingMemo.createdAt, updatedAt: Date.now() };
  if (idx >= 0) store.data.memos[idx] = memo; else store.data.memos.push(memo);
  store.save();
}

function closeMemo() {
  persistMemo();
  editingMemo = null;
  $('#memo-sheet').hidden = true;
  document.activeElement && document.activeElement.blur();
  renderMemos();
}

let memoSaveTimer;
function scheduleMemoSave() {
  clearTimeout(memoSaveTimer);
  memoSaveTimer = setTimeout(persistMemo, 500);
}

function deleteMemo() {
  if (!editingMemo) return;
  const idx = store.data.memos.findIndex((x) => x.id === editingMemo.id);
  const removed = idx >= 0 ? store.data.memos.splice(idx, 1)[0] : null;
  store.save();
  editingMemo = null;
  $('#memo-sheet').hidden = true;
  renderMemos();
  if (removed) toast('메모를 삭제했어요.', { label: '되돌리기', run: () => { store.data.memos.push(removed); store.save(); renderMemos(); } });
}

/* ---------- 일정 ---------- */
const cal = { year: 0, month: 0, selected: todayStr() };
let editingEvent = null;
let pickedColor = COLORS[0];

function eventsOn(day) {
  return store.data.events
    .filter((e) => e.date === day)
    .sort((a, b) => (a.allDay ? -1 : 0) - (b.allDay ? -1 : 0) || (a.start || '').localeCompare(b.start || ''));
}

function renderCalendar() {
  const { year, month } = cal;
  $('#cal-title').textContent = `${year}년 ${month + 1}월`;
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const weeks = Math.ceil((first.getDay() + new Date(year, month + 1, 0).getDate()) / 7);
  const byDay = {};
  for (const e of store.data.events) (byDay[e.date] = byDay[e.date] || []).push(e);
  const today = todayStr();
  let html = '';
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = ymd(d);
    const evs = byDay[key] || [];
    const cls = ['day'];
    if (d.getMonth() !== month) cls.push('other');
    if (d.getDay() === 0) cls.push('sun');
    if (d.getDay() === 6) cls.push('sat');
    if (key === today) cls.push('today');
    if (key === cal.selected) cls.push('selected');
    const dots = evs.slice(0, 3).map((e) => `<i style="background:${esc(e.color || COLORS[0])};${e.done ? 'opacity:.35' : ''}"></i>`).join('');
    html += `<button class="${cls.join(' ')}" data-day="${key}" aria-label="${fmtDay(key)}${evs.length ? `, 일정 ${evs.length}개` : ''}"><span class="num">${d.getDate()}</span><span class="dots">${dots}</span></button>`;
  }
  $('#cal-grid').innerHTML = html;
  renderDay();
}

function eventItem(e, showDate) {
  const time = e.allDay ? '하루 종일' : [fmtTime(e.start), e.end ? `– ${fmtTime(e.end)}` : ''].filter(Boolean).join(' ') || '시간 미정';
  const sub = (showDate ? fmtDay(e.date) + ' · ' : '') + time + (e.note ? ' · ' + e.note.split('\n')[0] : '');
  return `<li class="event ${e.done ? 'done' : ''}" data-id="${e.id}">
    <button class="check" data-check="${e.id}" aria-label="${e.done ? '완료 취소' : '완료로 표시'}">${e.done ? '✓' : ''}</button>
    <div class="body"><div class="title">${esc(e.title)}</div><div class="sub">${esc(sub)}</div></div>
    <span class="bar" style="background:${esc(e.color || COLORS[0])}"></span></li>`;
}

function renderDay() {
  const evs = eventsOn(cal.selected);
  $('#day-title').textContent = fmtDay(cal.selected) + (cal.selected === todayStr() ? ' · 오늘' : '');
  $('#day-events').innerHTML = evs.map((e) => eventItem(e, false)).join('');
  $('#day-empty').hidden = evs.length > 0;
  const today = todayStr();
  const upcoming = store.data.events
    .filter((e) => e.date > today && !e.done)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''))
    .slice(0, 8);
  $('#upcoming-events').innerHTML = upcoming.map((e) => eventItem(e, true)).join('');
  $('#upcoming-empty').hidden = upcoming.length > 0;
}

function setMonth(y, m) {
  const d = new Date(y, m, 1);
  cal.year = d.getFullYear();
  cal.month = d.getMonth();
  renderCalendar();
}

function openEvent(id, date) {
  const e = id ? store.data.events.find((x) => x.id === id) : null;
  editingEvent = e ? { ...e } : null;
  $('#event-heading').textContent = e ? '일정 수정' : '새 일정';
  $('#ev-title').value = e ? e.title : '';
  $('#ev-date').value = e ? e.date : (date || cal.selected);
  $('#ev-allday').checked = e ? !!e.allDay : false;
  $('#ev-start').value = e ? (e.start || '') : '';
  $('#ev-end').value = e ? (e.end || '') : '';
  $('#ev-note').value = e ? (e.note || '') : '';
  pickedColor = e ? (e.color || COLORS[0]) : COLORS[0];
  renderSwatches();
  $('#ev-time-row').hidden = $('#ev-allday').checked;
  $('#event-delete').hidden = !e;
  $('#event-sheet').hidden = false;
  if (!e) setTimeout(() => $('#ev-title').focus(), 60);
}

function renderSwatches() {
  $('#ev-colors').innerHTML = COLORS.map((c) => `<button type="button" class="swatch ${c === pickedColor ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="색상"></button>`).join('');
}

function closeEvent() {
  editingEvent = null;
  $('#event-sheet').hidden = true;
  document.activeElement && document.activeElement.blur();
}

function saveEvent() {
  const title = $('#ev-title').value.trim();
  const date = $('#ev-date').value;
  if (!title) { toast('일정 제목을 입력해 주세요.'); $('#ev-title').focus(); return; }
  if (!date) { toast('날짜를 선택해 주세요.'); return; }
  const allDay = $('#ev-allday').checked;
  let start = allDay ? '' : $('#ev-start').value;
  let end = allDay ? '' : $('#ev-end').value;
  if (start && end && end < start) { toast('종료 시간이 시작 시간보다 빨라요.'); return; }
  const ev = {
    id: editingEvent ? editingEvent.id : uid(),
    title, date, allDay, start, end,
    note: $('#ev-note').value.trim(),
    color: pickedColor,
    done: editingEvent ? !!editingEvent.done : false,
    createdAt: editingEvent ? editingEvent.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
  const idx = store.data.events.findIndex((x) => x.id === ev.id);
  if (idx >= 0) store.data.events[idx] = ev; else store.data.events.push(ev);
  store.save();
  closeEvent();
  cal.selected = date;
  const d = parseYmd(date);
  setMonth(d.getFullYear(), d.getMonth());
}

function deleteEvent() {
  if (!editingEvent) return;
  const idx = store.data.events.findIndex((x) => x.id === editingEvent.id);
  const removed = idx >= 0 ? store.data.events.splice(idx, 1)[0] : null;
  store.save();
  closeEvent();
  renderCalendar();
  if (removed) toast('일정을 삭제했어요.', { label: '되돌리기', run: () => { store.data.events.push(removed); store.save(); renderCalendar(); } });
}

function toggleDone(id) {
  const e = store.data.events.find((x) => x.id === id);
  if (!e) return;
  e.done = !e.done;
  e.updatedAt = Date.now();
  store.save();
  renderCalendar();
}

/* ---------- 설정 / 백업 ---------- */
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function renderSettings() {
  $('#app-version').textContent = 'v' + APP_VERSION;
  $('#stat-memos').textContent = store.data.memos.length;
  $('#stat-events').textContent = store.data.events.length;
  $('#install-status').innerHTML = isStandalone()
    ? '홈 화면 앱으로 실행 중이에요. 인터넷 없이도 사용할 수 있어요.'
    : 'Safari 하단의 <b>공유 버튼(□↑)</b> → <b>홈 화면에 추가</b>를 누르면 앱처럼 설치돼요. 설치하면 데이터가 더 안정적으로 보관돼요.';
}

async function exportBackup() {
  const payload = JSON.stringify({ app: 'harumemo', version: 1, exportedAt: new Date().toISOString(), ...store.data }, null, 2);
  const name = `harumemo-backup-${todayStr()}.json`;
  const file = new File([payload], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: '하루메모 백업' });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!Array.isArray(d.memos) || !Array.isArray(d.events)) throw new Error('format');
      const memoIds = new Set(store.data.memos.map((m) => m.id));
      const eventIds = new Set(store.data.events.map((e) => e.id));
      const newMemos = d.memos.filter((m) => m && m.id && !memoIds.has(m.id));
      const newEvents = d.events.filter((e) => e && e.id && e.date && !eventIds.has(e.id));
      store.data.memos.push(...newMemos);
      store.data.events.push(...newEvents);
      store.save();
      renderSettings();
      toast(`메모 ${newMemos.length}개, 일정 ${newEvents.length}개를 불러왔어요.`);
    } catch (e) {
      toast('하루메모 백업 파일이 아니에요.');
    }
  };
  reader.readAsText(file);
}

/* ---------- 이벤트 연결 ---------- */
function bind() {
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
  $('#fab').addEventListener('click', () => (currentTab === 'cal' ? openEvent(null, cal.selected) : openMemo(null)));

  $('#memo-search').addEventListener('input', renderMemos);
  $('#memo-list').addEventListener('click', (e) => {
    const li = e.target.closest('.memo-item');
    if (li) openMemo(li.dataset.id);
  });
  $('#memo-title').addEventListener('input', scheduleMemoSave);
  $('#memo-body').addEventListener('input', scheduleMemoSave);
  $('#memo-done').addEventListener('click', closeMemo);
  $('#memo-delete').addEventListener('click', deleteMemo);
  $('#memo-pin').addEventListener('click', () => {
    editingMemo.pinned = !editingMemo.pinned;
    $('#memo-pin').classList.toggle('on', editingMemo.pinned);
    persistMemo();
  });

  $('#cal-prev').addEventListener('click', () => setMonth(cal.year, cal.month - 1));
  $('#cal-next').addEventListener('click', () => setMonth(cal.year, cal.month + 1));
  $('#cal-today').addEventListener('click', () => { cal.selected = todayStr(); const n = new Date(); setMonth(n.getFullYear(), n.getMonth()); });
  $('#cal-grid').addEventListener('click', (e) => {
    const b = e.target.closest('.day');
    if (!b) return;
    const key = b.dataset.day;
    if (key === cal.selected) { openEvent(null, key); return; }
    cal.selected = key;
    const d = parseYmd(key);
    if (d.getMonth() !== cal.month) setMonth(d.getFullYear(), d.getMonth()); else renderCalendar();
  });
  // 좌우 스와이프로 달 이동
  let sx = null, sy = null;
  $('#cal-grid').addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  $('#cal-grid').addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) setMonth(cal.year, cal.month + (dx < 0 ? 1 : -1));
    sx = null;
  });
  const onEventList = (e) => {
    const c = e.target.closest('[data-check]');
    if (c) { toggleDone(c.dataset.check); return; }
    const li = e.target.closest('.event');
    if (li) openEvent(li.dataset.id);
  };
  $('#day-events').addEventListener('click', onEventList);
  $('#upcoming-events').addEventListener('click', onEventList);

  $('#event-cancel').addEventListener('click', closeEvent);
  $('#event-save').addEventListener('click', saveEvent);
  $('#event-form').addEventListener('submit', (e) => { e.preventDefault(); saveEvent(); });
  $('#event-delete').addEventListener('click', deleteEvent);
  $('#ev-allday').addEventListener('change', () => { $('#ev-time-row').hidden = $('#ev-allday').checked; });
  $('#ev-colors').addEventListener('click', (e) => {
    const s = e.target.closest('.swatch');
    if (s) { pickedColor = s.dataset.color; renderSwatches(); }
  });
  $('#event-sheet').addEventListener('click', (e) => { if (e.target.id === 'event-sheet') closeEvent(); });

  $('#btn-export').addEventListener('click', exportBackup);
  $('#import-file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importBackup(f); e.target.value = ''; });
  $('#btn-wipe').addEventListener('click', () => {
    if (!confirm('메모와 일정을 모두 지울까요? 되돌릴 수 없어요.')) return;
    store.data = { memos: [], events: [] };
    store.save();
    renderSettings();
    toast('모든 데이터를 지웠어요.');
  });

  // 앱을 백그라운드로 보낼 때 편집 중인 메모 즉시 저장
  document.addEventListener('visibilitychange', () => { if (document.hidden) persistMemo(); });
  window.addEventListener('pagehide', persistMemo);
}

/* ---------- 서비스 워커 (오프라인 + 업데이트) ---------- */
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('새 버전이 있어요.', { label: '업데이트', run: () => nw.postMessage('skipWaiting') });
        }
      });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

/* ---------- 시작 ---------- */
store.load();
const now = new Date();
cal.year = now.getFullYear();
cal.month = now.getMonth();
bind();
showTab('memo');
registerSW();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
