const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LV = { high: 'Высокий', mid: 'Средний', low: 'Низкий', done: 'Прошёл 90 дней', left: 'Ушёл' };
let managers = [], all = [], tab = 'today';

const api = async (url, method = 'GET', data) => {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
  const j = await r.json(); if (!r.ok) throw new Error(j.error); return j;
};
const me = () => $('#who').value;
const mine = () => all.filter(n => me() === 'hr' || n.managerId === me());

async function load() { all = await api('/api/novices'); render(); }

function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  $('#main').innerHTML = { today, list, sum }[tab]();
}

function today() {
  const q = mine().filter(n => n.status === 'active' && n.a.level !== 'done' &&
    (n.a.level !== 'low' || (n.a.pending != null)))
    .sort((a, b) => b.a.score - a.a.score || b.a.day - a.a.day);
  if (!q.length) return '<p>На сегодня срочных дел нет.</p>';
  return `<p class="mut">Кому уделить внимание сегодня: ${q.length}. Сверху самые рискованные.</p>` + q.map(n => {
    const r = n.a.reasons.find(x => x.action) || n.a.reasons[0];
    const why = n.a.pending != null && !n.a.reasons.length ? `Подошла встреча дня ${n.a.pending}` : (r ? esc(r.text) : '');
    const act = r?.action || (n.a.pending != null ? 'Провести плановую встречу' : '');
    return `<div class="row ${n.a.level}">
      <div class="grow"><b><a href="#" onclick="card('${n.id}');return false">${esc(n.name)}</a></b>
      <span class="pill ${n.a.level}">${LV[n.a.level]} · ${n.a.score}</span><br>
      <span class="mut">${esc(n.role)} · ${esc(n.site)} · день ${n.a.day}</span><br>${why}<br><i>${esc(act)}</i></div>
      ${n.a.pending != null ? `<button class="pri" onclick="checkin('${n.id}')">Записать встречу</button>` : ''}</div>`;
  }).join('');
}

function list() {
  const rows = mine().sort((a, b) => b.a.score - a.a.score);
  return `<table><thead><tr><th>Имя</th><th>Роль</th><th>День</th><th>Риск</th><th>Наставник</th></tr></thead><tbody>` +
    rows.map(n => `<tr onclick="card('${n.id}')"><td>${esc(n.name)}</td><td>${esc(n.role)}<br><span class="mut">${esc(n.site)}</span></td>
    <td>${n.a.day}</td><td><span class="pill ${n.a.level}">${LV[n.a.level]}</span></td><td>${esc(n.buddy) || '—'}</td></tr>`).join('') + '</tbody></table>';
}

function sum() {
  const set = mine(), act = set.filter(n => n.status === 'active' && n.a.level !== 'done'), left = set.filter(n => n.status === 'left');
  const c = l => act.filter(n => n.a.level === l).length;
  const depts = [...new Set(set.map(n => n.dept))];
  const wk = Array.from({ length: 13 }, (_, i) => act.filter(n => Math.floor(n.a.day / 7) === i && n.a.level !== 'low').length);
  const mx = Math.max(1, ...wk);
  const reasons = {}; left.forEach(n => reasons[n.leftReason] = (reasons[n.leftReason] || 0) + 1);
  return `<div class="kpis">
    <div class="kpi"><b>${act.length}</b>на адаптации</div>
    <div class="kpi"><b style="color:var(--hi)">${c('high')}</b>высокий риск</div>
    <div class="kpi"><b style="color:var(--mid)">${c('mid')}</b>средний</div>
    <div class="kpi"><b>${left.length}</b>ушло (в этой выборке)</div></div>
  <h3>По подразделениям</h3><table><thead><tr><th>Подразделение</th><th>Активных</th><th>Риск выс.+сред.</th><th>Ушло</th></tr></thead><tbody>` +
    depts.map(d => { const a = act.filter(n => n.dept === d); return `<tr style="cursor:default"><td>${esc(d)}</td><td>${a.length}</td><td>${a.filter(n => n.a.level === 'high' || n.a.level === 'mid').length}</td><td>${left.filter(n => n.dept === d).length}</td></tr>`; }).join('') + `</tbody></table>
  <h3>Рисковые по неделям стажа</h3>` + wk.map((v, i) => `<div style="display:flex;gap:8px;align-items:center"><span class="mut" style="width:80px">нед. ${i + 1}</span><div class="bar" style="width:${v / mx * 70}%"></div>${v}</div>`).join('') +
    `<h3>Причины ухода</h3>` + (left.length ? '<ul>' + Object.entries(reasons).map(([k, v]) => `<li>${esc(k)}: ${v}</li>`).join('') + '</ul>' : '<p class="mut">Нет данных</p>');
}

window.card = id => {
  const n = all.find(x => x.id === id), tl = [...n.checkins].sort((a, b) => a.date.localeCompare(b.date));
  $('#dlg').innerHTML = `<h2 style="margin-top:0">${esc(n.name)}</h2>
  <p class="mut">${esc(n.role)} · ${esc(n.site)} · принят ${esc(n.hireDate)} (день ${n.a.day}) · <span class="pill ${n.a.level}">${LV[n.a.level]}</span></p>
  ${n.status === 'left' ? `<p>Ушёл на ${n.leftDay} день. Причина: ${esc(n.leftReason)}</p>` : ''}
  ${n.a.reasons.length ? '<b>Почему такой риск</b><ul>' + n.a.reasons.map(r => `<li>${esc(r.text)} (+${r.pts})</li>`).join('') + '</ul>' : ''}
  <b>Наставник:</b> <input id="buddy" value="${esc(n.buddy)}" placeholder="ФИО"> <button onclick="saveBuddy('${n.id}')">Сохранить</button>
  <h4>Чек-лист</h4>${n.tasks.map((t, i) => `<label style="display:block"><input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggle('${n.id}',${i})"> ${esc(t.t)} <span class="mut">(до дня ${t.due})</span></label>`).join('')}
  <h4>Встречи</h4>${tl.length ? '<ul class="tl">' + tl.map(c => `<li>День ${c.milestone}, ${esc(c.date)}: настроение ${c.mood}/5${c.conditions === false ? ', условия не совпали' : ''}${c.tasksClear === false ? ', задачи непонятны' : ''}${c.note ? ' — ' + esc(c.note) : ''}</li>`).join('') + '</ul>' : '<p class="mut">Встреч не было</p>'}
  <div style="display:flex;gap:8px;justify-content:space-between;margin-top:14px">
    <span>${n.status === 'active' && n.a.level !== 'done' ? `<button onclick="left('${n.id}')">Отметить уход</button>` : ''}</span>
    <span>${n.a.pending != null && n.status === 'active' ? `<button class="pri" onclick="checkin('${n.id}')">Записать встречу</button>` : ''}
    <button onclick="$('#dlg').close()">Закрыть</button></span></div>`;
  $('#dlg').showModal();
};

let form;
window.checkin = id => {
  const n = all.find(x => x.id === id); form = { mood: 0, tasksClear: true, conditions: true };
  const yn = (k, q) => `<div class="yn"><span>${q}</span><span><button data-k="${k}" data-v="1" class="sel">Да</button> <button data-k="${k}" data-v="0">Нет</button></span></div>`;
  $('#dlg').innerHTML = `<h3 style="margin-top:0">Встреча дня ${n.a.pending}: ${esc(n.name)}</h3>
  <p class="mut">Спросите лично, 10–15 минут. Занесите ответы.</p>
  <b>Как настроение, как идёт?</b><div class="moods">${[1, 2, 3, 4, 5].map(i => `<button data-mood="${i}">${i}</button>`).join('')}</div>
  ${yn('tasksClear', 'Понятно, что нужно делать на этой неделе?')}${yn('conditions', 'График, оплата и нагрузка совпали с тем, что обещали?')}
  <textarea id="note" rows="3" style="width:100%;margin-top:8px" placeholder="Заметка (по желанию)"></textarea>
  <p id="err" style="color:var(--hi)"></p>
  <div style="text-align:right"><button onclick="$('#dlg').close()">Отмена</button> <button class="pri" id="save">Сохранить</button></div>`;
  $('#dlg').showModal();
  $('#dlg').onclick = e => {
    const t = e.target;
    if (t.dataset.mood) { form.mood = +t.dataset.mood; document.querySelectorAll('[data-mood]').forEach(b => b.classList.toggle('sel', b === t)); }
    if (t.dataset.k) { form[t.dataset.k] = t.dataset.v === '1'; document.querySelectorAll(`[data-k="${t.dataset.k}"]`).forEach(b => b.classList.toggle('sel', b === t)); }
  };
  $('#save').onclick = async () => {
    if (!form.mood) return ($('#err').textContent = 'Выберите настроение 1–5');
    try { await api(`/api/novices/${id}/checkins`, 'POST', { ...form, note: $('#note').value }); $('#dlg').close(); await load(); }
    catch (e) { $('#err').textContent = e.message; }
  };
};
window.toggle = async (id, i) => { await api(`/api/novices/${id}/tasks/${i}`, 'POST'); await load(); card(id); };
window.saveBuddy = async id => { await api(`/api/novices/${id}/buddy`, 'POST', { buddy: $('#buddy').value }); await load(); card(id); };
window.left = async id => {
  const reason = prompt('Причина ухода (например: график, зарплата, нашёл другую работу)'); if (reason === null) return;
  await api(`/api/novices/${id}/left`, 'POST', { reason }); $('#dlg').close(); await load();
};

(async () => {
  managers = await api('/api/managers');
  $('#who').innerHTML = '<option value="hr">HR (все)</option>' + managers.map(m => `<option value="${m.id}">${esc(m.name)} — ${esc(m.site)}</option>`).join('');
  $('#who').value = managers[0].id; $('#who').onchange = render;
  $('#tabs').onclick = e => { if (e.target.dataset.t) { tab = e.target.dataset.t; render(); } };
  load();
})();
