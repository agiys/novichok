// Правила риска ухода в первые 90 дней. Веса — гипотеза, их надо калибровать по реальным увольнениям.
export const MILESTONES = [1, 3, 7, 14, 30, 45, 60, 90];
const DAY = 86400000;
const GRACE = 2; // дней на проведение встречи после контрольной точки

export const daysBetween = (from, to) =>
  Math.floor((Date.parse(to.toISOString().slice(0, 10)) - Date.parse(from)) / DAY);

export function checklistFor(dept) {
  const common = [
    { t: 'Оформлен, есть пропуск и доступы', due: 1 },
    { t: 'Инструктаж по ТБ и правилам', due: 2 },
    { t: 'Назначен наставник', due: 2 },
    { t: 'План на первые 30 дней согласован с новичком', due: 5 },
    { t: 'Обучение продукту и ассортименту', due: 14 },
    { t: 'Первая обратная связь от руководителя', due: 14 },
    { t: 'Итоги 30 дней обсуждены', due: 30 },
  ];
  const extra = {
    'Склад': { t: 'Допуск к технике (погрузчик, рохля)', due: 7 },
    'Магазин': { t: 'Касса и скрипты продаж', due: 7 },
    'Отдел продаж': { t: 'Доступ к CRM и базе клиентов', due: 3 },
    'Офис': { t: 'Доступы к 1С и Битрикс24', due: 3 },
  }[dept];
  return [...common, ...(extra ? [extra] : [])].map(x => ({ ...x, done: false }));
}

// Контрольная точка, по которой встречи ещё не было (самая ранняя из наступивших)
export function pendingMilestone(n, day) {
  const done = new Set(n.checkins.map(c => c.milestone));
  return MILESTONES.find(m => m <= day && !done.has(m)) ?? null;
}

export function assess(n, now = new Date()) {
  const day = daysBetween(n.hireDate, now);
  if (n.status === 'left') return { day, level: 'left', score: 0, reasons: [], pending: null };
  if (day > 90) return { day, level: 'done', score: 0, reasons: [], pending: null };

  const reasons = [];
  const add = (pts, text, action) => reasons.push({ pts, text, action });

  const done = new Set(n.checkins.map(c => c.milestone));
  const overdue = MILESTONES.filter(m => day - m >= GRACE && !done.has(m));
  if (overdue.length)
    add(Math.min(overdue.length, 3), `Не проведена встреча: ${overdue.map(m => 'день ' + m).join(', ')}`,
      'Провести встречу сегодня, 15 минут, вопросы в форме');

  const sorted = [...n.checkins].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted.at(-1), prev = sorted.at(-2);
  if (last) {
    if (last.mood <= 2) add(3, `Низкое настроение (${last.mood}/5) на встрече дня ${last.milestone}`, 'Поговорить лично, выяснить причину, договориться о следующем шаге');
    if (prev && prev.mood - last.mood >= 2) add(2, `Настроение упало с ${prev.mood} до ${last.mood}`, 'Назначить повторную встречу в течение 3 дней');
    if (last.conditions === false) add(2, 'Условия (график, оплата, нагрузка) не совпали с ожиданиями', 'Сверить с обещанным при найме, подключить HR');
    if (last.tasksClear === false) add(1, 'Новичку непонятны задачи', 'Дать письменный план на неделю');
  }
  if (!n.buddy && day >= 3) add(2, 'Нет наставника', 'Назначить наставника сегодня');

  const late = n.tasks.filter(t => !t.done && day > t.due);
  if (late.length) add(Math.min(late.length, 3), `Просрочено по чек-листу: ${late.slice(0, 2).map(t => t.t).join('; ')}${late.length > 2 ? '…' : ''}`, 'Закрыть просроченные пункты чек-листа');

  if (day >= 7 && day <= 45) add(1, 'Период повышенного риска (недели 2–6)', '');

  reasons.sort((a, b) => b.pts - a.pts);
  const score = reasons.reduce((s, r) => s + r.pts, 0);
  const level = score >= 6 ? 'high' : score >= 3 ? 'mid' : 'low';
  return { day, level, score, reasons, pending: pendingMilestone(n, day) };
}
