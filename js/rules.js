// Reglas del juego y funciones de cálculo.

const RULES = {
  daysPerWeek: 2,             // martes y jueves
  minBetPerPerson: 5000,      // mínimo por persona por sesión
  defaultBetTotal: 10000,     // 5.000 x 2 personas
  monthLimitTotal: 80000,     // 40.000 por persona x 2
  monthLimitPerPerson: 40000,
  extraDayThreshold: 30000,   // cada $30.000 de ganancia neta = 1 día extra
};

function todayStr() {
  return toISO(new Date());
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currentMonthKey() {
  return todayStr().slice(0, 7);
}

function monthKeyFromDateStr(s) {
  return s.slice(0, 7);
}

function parseDate(s) {
  const parts = s.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0 = domingo, 1 = lunes
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function currentWeekRange() {
  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

function sortByDate(sessions) {
  return sessions.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Estadísticas del mes: pérdidas, ganancias y balance neto.
function monthStats(sessions, monthKey) {
  const month = sessions.filter((s) => monthKeyFromDateStr(s.date) === monthKey);
  let losses = 0;
  let gains = 0;
  let net = 0;
  month.forEach((s) => {
    net += s.netResult;
    if (s.netResult >= 0) gains += s.netResult;
    else losses += Math.abs(s.netResult);
  });
  return { sessions: month, count: month.length, losses, gains, net };
}

// Días extra: 1 por cada $30.000 de ganancia neta acumulada.
function extraDaysFor(net) {
  return Math.floor(Math.max(0, net) / RULES.extraDayThreshold);
}

// Días habilitados en la semana: 2 base + extras, máximo 7.
function allowedDays(net) {
  return Math.min(7, RULES.daysPerWeek + extraDaysFor(net));
}

function limitReached(losses) {
  return losses >= RULES.monthLimitTotal;
}

function remainingBudget(losses) {
  return Math.max(0, RULES.monthLimitTotal - losses);
}
