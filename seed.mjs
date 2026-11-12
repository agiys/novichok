import { MILESTONES, checklistFor } from './risk.mjs';

let s = 42;
const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = a => a[Math.floor(rnd() * a.length)];
const iso = d => d.toISOString().slice(0, 10);
const ago = n => iso(new Date(Date.now() - n * 86400000));

export const MANAGERS = [
  { id: 'm1', name: 'Орлов Сергей', dept: 'Склад', site: 'Склад Подольск' },
  { id: 'm2', name: 'Белова Марина', dept: 'Магазин', site: 'Магазин ТЦ «Мега»' },
  { id: 'm3', name: 'Крылов Денис', dept: 'Магазин', site: 'Магазин на Ленина' },
  { id: 'm4', name: 'Зайцева Ирина', dept: 'Отдел продаж', site: 'Опт, Москва' },
  { id: 'm5', name: 'Громов Павел', dept: 'Офис', site: 'Головной офис' },
];
const FIRST = ['Алексей', 'Дмитрий', 'Иван', 'Максим', 'Артём', 'Никита', 'Анна', 'Мария', 'Екатерина', 'Ольга', 'Егор', 'Кирилл', 'Полина', 'Юлия', 'Роман', 'Тимур'];
const LAST = ['Смирнов', 'Попов', 'Лебедев', 'Козлов', 'Новиков', 'Морозов', 'Волков', 'Соловьёв', 'Васильев', 'Зуев', 'Фёдоров', 'Михайлов', 'Беляев', 'Тарасов', 'Ильин', 'Сорокин'];
const ROLES = { 'Склад': ['Комплектовщик', 'Грузчик', 'Кладовщик'], 'Магазин': ['Продавец-консультант', 'Кассир'], 'Отдел продаж': ['Менеджер по продажам'], 'Офис': ['Бухгалтер', 'Специалист по закупкам'] };
const LEAVE_REASONS = ['Не устроила зарплата', 'График', 'Тяжёлая нагрузка', 'Не сложились отношения в команде', 'Нашёл другую работу', 'Задачи не совпали с ожиданиями'];

export function seed() {
  const novices = [];
  for (let i = 0; i < 38; i++) {
    const m = MANAGERS[i % MANAGERS.length];
    const hireAgo = Math.floor(rnd() * 88) + (i < 4 ? 0 : 1);
    const n = {
      id: 'n' + (i + 1),
      name: `${pick(LAST)} ${pick(FIRST)}`,
      role: pick(ROLES[m.dept]), dept: m.dept, site: m.site, managerId: m.id,
      buddy: rnd() < 0.8 ? `${pick(LAST)} ${pick(FIRST)}` : '',
      hireDate: ago(hireAgo), status: 'active', checkins: [], tasks: checklistFor(m.dept),
    };
    let mood = 3 + Math.floor(rnd() * 3);
    for (const ms of MILESTONES) {
      if (ms > hireAgo - 1) break;
      if (rnd() < 0.92) {
        mood = Math.max(1, Math.min(5, mood + pick([-2, -1, 0, 0, 1])));
        n.checkins.push({ milestone: ms, date: ago(hireAgo - ms), mood, tasksClear: rnd() > 0.15, conditions: rnd() > 0.15, note: '' });
      }
    }
    n.tasks.forEach(t => { t.done = hireAgo > t.due && rnd() < 0.94; });
    novices.push(n);
  }
  // Ушедшие — для сводки (вымышленные)
  for (let i = 0; i < 7; i++) {
    const m = MANAGERS[i % MANAGERS.length];
    const left = 10 + Math.floor(rnd() * 80);
    novices.push({
      id: 'l' + (i + 1), name: `${pick(LAST)} ${pick(FIRST)}`, role: pick(ROLES[m.dept]), dept: m.dept, site: m.site,
      managerId: m.id, buddy: '', hireDate: ago(left + 20), status: 'left', leftDay: left, leftReason: pick(LEAVE_REASONS),
      checkins: [], tasks: checklistFor(m.dept),
    });
  }
  return novices;
}
