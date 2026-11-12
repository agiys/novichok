import assert from 'node:assert/strict';
import { assess, checklistFor } from './risk.mjs';

const ago = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
const mk = (day, over = {}) => ({ hireDate: ago(day), status: 'active', buddy: 'Иванов', checkins: [], tasks: checklistFor('Склад').map(t => ({ ...t, done: true })), ...over });
const ci = (milestone, mood, extra = {}) => ({ milestone, date: ago(0), mood, tasksClear: true, conditions: true, ...extra });

// день 0: всё спокойно
assert.equal(assess(mk(0)).level, 'low');
// день 1: встреча подошла, но риск ещё низкий
assert.equal(assess(mk(1)).pending, 1);
// пропущенные встречи и нет наставника -> риск растёт
const bad = assess(mk(20, { buddy: '' }));
assert.ok(bad.score >= 3 && bad.reasons.some(r => r.text.includes('наставника')));
// низкое настроение даёт +3
const low = assess(mk(10, { checkins: [ci(1, 4), ci(3, 4), ci(7, 1)] }));
assert.ok(low.reasons.some(r => r.text.includes('Низкое настроение')));
// падение настроения
assert.ok(assess(mk(10, { checkins: [ci(1, 5), ci(3, 5), ci(7, 3)] })).reasons.some(r => r.text.includes('упало')));
// условия не совпали
assert.ok(assess(mk(8, { checkins: [ci(1, 4), ci(3, 4), ci(7, 4, { conditions: false })] })).reasons.some(r => r.text.includes('Условия')));
// льготный период 2 дня: день 8 после точки 7 ещё не просрочка
assert.ok(!assess(mk(8, { checkins: [ci(1, 4), ci(3, 4)] })).reasons.some(r => r.text.includes('Не проведена')));
// после 90 дней и после ухода — вне очереди
assert.equal(assess(mk(95)).level, 'done');
assert.equal(assess(mk(30, { status: 'left' })).level, 'left');
console.log('ok');
