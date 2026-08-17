(function () {
  let sessions = [];
  let chart = null;
  let editingId = null;
  let monthPickerValue = currentMonthKey();

  const $ = (id) => document.getElementById(id);

  const els = {
    monthPicker: $("monthPicker"),
    storageBadge: $("storageBadge"),
    footer: $("footer"),
    lossesValue: $("lossesValue"),
    limitBar: $("limitBar"),
    limitText: $("limitText"),
    netValue: $("netValue"),
    netPerPerson: $("netPerPerson"),
    daysValue: $("daysValue"),
    daysExtra: $("daysExtra"),
    daysPlayed: $("daysPlayed"),
    statusTitle: $("statusTitle"),
    statusDetail: $("statusDetail"),
    form: $("sessionForm"),
    formAlert: $("formAlert"),
    sessionId: $("sessionId"),
    sessionDate: $("sessionDate"),
    netAmount: $("netAmount"),
    netLabelText: $("netLabelText"),
    betAmount: $("betAmount"),
    betLabel: $("betLabel"),
    note: $("note"),
    saveBtn: $("saveBtn"),
    cancelEdit: $("cancelEdit"),
    chart: $("chart"),
    chartEmpty: $("chartEmpty"),
    historyBody: $("historyBody"),
    historyMonth: $("historyMonth"),
    emptyHistory: $("emptyHistory"),
    seedBtn: $("seedBtn"),
  };

  // ---------- Formato ----------

  function fmt(n) {
    const sign = n < 0 ? "-" : "";
    return sign + "$" + Math.abs(Math.round(n)).toLocaleString("es-AR");
  }

  function fmtSigned(n) {
    return (n > 0 ? "+" : "") + fmt(n);
  }

  function fmtDate(s) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }

  // ---------- Carga y render ----------

  function loadAndRender() {
    DataService.getSessions()
      .then((list) => {
        sessions = list;
        renderAll();
      })
      .catch((err) => {
        els.statusTitle.textContent = "Error de datos";
        els.statusDetail.textContent = err.message || String(err);
        els.statusTitle.className = "big status-danger";
      });
  }

  function renderAll() {
    const monthKey = monthPickerValue;
    const stats = monthStats(sessions, monthKey);
    const isCurrentMonth = monthKey === currentMonthKey();

    renderLossCard(stats);
    renderNetCard(stats);
    renderDaysCard(stats, isCurrentMonth);
    renderStatus(stats, isCurrentMonth);
    applyFormBlock(stats, isCurrentMonth);
    renderHistory(stats, monthKey);
    renderChart(stats);
    updateSeedButton();
  }

  function renderLossCard(stats) {
    const pct = Math.min(100, (stats.losses / RULES.monthLimitTotal) * 100);
    els.lossesValue.textContent = fmt(stats.losses);
    els.limitBar.style.width = pct + "%";
    els.limitBar.classList.toggle("danger", limitReached(stats.losses));
    els.limitText.textContent =
      `Límite ${fmt(RULES.monthLimitTotal)} (${fmt(RULES.monthLimitPerPerson)} c/u)`;
  }

  function renderNetCard(stats) {
    els.netValue.textContent = fmtSigned(stats.net);
    els.netValue.className = "big " + (stats.net >= 0 ? "positive" : "negative");
    els.netPerPerson.textContent = `${fmtSigned(stats.gains)} ganados − ${fmt(stats.losses)} perdidos`;
  }

  function renderDaysCard(stats, isCurrentMonth) {
    if (!isCurrentMonth) {
      els.daysValue.textContent = "-";
      els.daysExtra.textContent = "Solo aplica al mes actual";
      els.daysPlayed.textContent = "";
      return;
    }
    const wNet = weekNet(sessions);
    const extra = extraDaysForWeekly(wNet);
    const allowed = allowedDays(wNet);
    const played = daysPlayedThisWeek();
    els.daysValue.textContent = `${played} / ${allowed}`;
    els.daysExtra.textContent =
      extra > 0
        ? `Días extra: +${extra} (esta semana: ${fmtSigned(wNet)} neta)`
        : "Sin días extra aún";
    els.daysPlayed.textContent = "Jugados esta semana: " + played;
  }

  function renderStatus(stats, isCurrentMonth) {
    if (!isCurrentMonth) {
      setStatus("Mes anterior", "El estado de hoy solo aplica al mes actual.", "neutral");
      return;
    }
    const played = daysPlayedThisWeek();
    const wNet = weekNet(sessions);
    const allowed = allowedDays(wNet);
    const daysLeft = allowed - played;
    const budget = remainingBudget(stats.losses);

    if (limitReached(stats.losses)) {
      setStatus(
        "Límite alcanzado",
        `Ya perdieron ${fmt(RULES.monthLimitTotal)}. No pueden jugar más este mes.`,
        "danger"
      );
    } else if (daysLeft <= 0) {
      setStatus(
        "No pueden jugar hoy",
        `Usaron los ${allowed} días habilitados de esta semana. Ganando más plata se habilita otro día.`,
        "warn"
      );
    } else {
      setStatus(
        "Pueden jugar hoy",
        `Les quedan ${daysLeft} día(s) esta semana y ${fmt(budget)} de presupuesto para perder.`,
        "ok"
      );
    }
  }

  function setStatus(title, detail, kind) {
    els.statusTitle.textContent = title;
    els.statusTitle.className = "big status-" + kind;
    els.statusDetail.textContent = detail;
  }

  function daysPlayedThisWeek() {
    const { start, end } = currentWeekRange();
    const startKey = toISO(start);
    const endKey = toISO(end);
    return sessions.filter((s) => s.date >= startKey && s.date <= endKey).length;
  }

  // Bloquea el formulario cuando no se puede registrar una sesión nueva
  // (mes no vigente, límite alcanzado o sin días disponibles esta semana).
  function canRegisterToday(stats, isCurrentMonth) {
    if (!isCurrentMonth) {
      return { allowed: false, reason: "El registro de sesiones es para el mes actual. Cambiá el mes arriba para ver el histórico." };
    }
    if (limitReached(stats.losses)) {
      return { allowed: false, reason: `Límite mensual alcanzado (${fmt(RULES.monthLimitTotal)} perdidos). No pueden jugar más este mes.` };
    }
    const played = daysPlayedThisWeek();
    const wNet = weekNet(sessions);
    const allowed = allowedDays(wNet);
    if (played >= allowed) {
      return { allowed: false, reason: `Sin días disponibles esta semana: jugaron ${played} de ${allowed} habilitados. Ganando más plata se habilita otro día.` };
    }
    return { allowed: true, reason: "" };
  }

  function applyFormBlock(stats, isCurrentMonth) {
    if (editingId) {
      unblockForm();
      return;
    }
    const res = canRegisterToday(stats, isCurrentMonth);
    if (res.allowed) {
      unblockForm();
      return;
    }
    blockForm(res.reason);
  }

  function blockForm(reason) {
    els.formAlert.textContent = reason;
    els.formAlert.classList.remove("hidden");
    els.form.querySelectorAll("input, button").forEach((el) => {
      if (el !== els.cancelEdit) el.disabled = true;
    });
  }

  function unblockForm() {
    els.formAlert.classList.add("hidden");
    els.form.querySelectorAll("input, button").forEach((el) => {
      el.disabled = false;
    });
  }

  // ---------- Historial ----------

  function renderHistory(stats, monthKey) {
    els.historyMonth.textContent = monthKey;
    const sorted = sortByDate(stats.sessions);
    els.emptyHistory.classList.toggle("hidden", sorted.length > 0);

    els.historyBody.innerHTML = sorted
      .map((s) => {
        const cls = s.netResult >= 0 ? "positive" : "negative";
        return `<tr>
          <td data-label="Fecha">${fmtDate(s.date)}</td>
          <td data-label="Apuesta" class="num">${fmt(s.bet || 0)}</td>
          <td data-label="Resultado neto" class="num ${cls}">${fmtSigned(s.netResult)}</td>
          <td data-label="Nota">${escapeHtml(s.note || "")}</td>
          <td data-label="" class="actions">
            <button class="btn-danger" data-act="edit" data-id="${s.id}">Editar</button>
            <button class="btn-danger" data-act="del" data-id="${s.id}">Borrar</button>
          </td>
        </tr>`;
      })
      .join("");
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- Gráfico ----------

  function renderChart(stats) {
    const sorted = sortByDate(stats.sessions);
    els.chartEmpty.classList.toggle("hidden", sorted.length > 0);
    els.chart.classList.toggle("hidden", sorted.length === 0);

    if (sorted.length === 0) {
      if (chart) {
        chart.destroy();
        chart = null;
      }
      return;
    }

    const labels = [];
    const data = [];
    let acc = 0;
    sorted.forEach((s) => {
      acc += s.netResult;
      const [, m, d] = s.date.split("-");
      labels.push(`${d}/${m}`);
      data.push(acc);
    });

    if (chart) chart.destroy();
    chart = new Chart(els.chart, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Balance acumulado",
            data,
            borderColor: "#22c55e",
            backgroundColor: "rgba(34, 197, 94, 0.15)",
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "#22c55e",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => "Balance: " + fmtSigned(ctx.parsed.y),
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#94a3b8" },
            grid: { color: "rgba(255,255,255,0.05)" },
          },
          y: {
            ticks: { color: "#94a3b8", callback: (v) => fmt(v) },
            grid: { color: "rgba(255,255,255,0.05)" },
          },
        },
      },
    });
  }

  // ---------- Formulario ----------

  function currentResultIsGain() {
    return (
      document.querySelector('input[name="result"]:checked').value === "gain"
    );
  }

  function updateNetLabel() {
    const isGain = currentResultIsGain();
    els.netLabelText.textContent = isGain ? "Ganancia bruta" : "Monto perdido (total)";
    els.betLabel.style.display = isGain ? "" : "none";
    els.betAmount.required = isGain;
  }

  function resetForm() {
    editingId = null;
    els.form.reset();
    els.sessionDate.value = todayStr();
    els.saveBtn.textContent = "Guardar sesión";
    els.cancelEdit.classList.add("hidden");
    updateNetLabel();
  }

  function startEdit(session) {
    editingId = session.id;
    unblockForm();
    els.sessionId.value = session.id;
    els.sessionDate.value = session.date;
    els.note.value = session.note || "";
    const gain = session.netResult >= 0;
    document.querySelector('input[name="result"][value="' + (gain ? "gain" : "loss") + '"]').checked = true;
    if (gain) {
      const gross = session.netResult + (session.bet || 0);
      els.netAmount.value = gross;
      els.betAmount.value = session.bet || 0;
    } else {
      els.netAmount.value = 0;
      els.betAmount.value = Math.abs(session.netResult);
    }
    updateNetLabel();
    els.saveBtn.textContent = "Actualizar sesión";
    els.cancelEdit.classList.remove("hidden");
    els.sessionDate.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const date = els.sessionDate.value;
    const gain = currentResultIsGain();
    const amount = Number(els.netAmount.value) || 0;
    const bet = gain ? (Number(els.betAmount.value) || 0) : amount;
    const netResult = gain ? amount - bet : -amount;
    const note = els.note.value.trim();

    if (amount <= 0) {
      alert("Ingresá un monto mayor a cero.");
      return;
    }
    if (gain && bet <= 0) {
      alert("Ingresá la apuesta realizada mayor a cero.");
      return;
    }
    if (gain && amount < bet) {
      alert("La ganancia bruta no puede ser menor a la apuesta.");
      return;
    }

    const session = { date, netResult, bet, note };

    try {
      if (editingId) {
        await DataService.updateSession(editingId, session);
      } else {
        await DataService.addSession(session);
      }
      resetForm();
      loadAndRender();
    } catch (err) {
      alert("No se pudo guardar: " + (err.message || err));
    }
  }

  async function handleHistoryClick(e) {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.act === "del") {
      if (!confirm("¿Borrar esta sesión?")) return;
      try {
        await DataService.deleteSession(id);
        if (editingId === id) resetForm();
        loadAndRender();
      } catch (err) {
        alert("No se pudo borrar: " + (err.message || err));
      }
    } else if (btn.dataset.act === "edit") {
      const session = sessions.find((s) => s.id === id);
      if (session) startEdit(session);
    }
  }

  // ---------- Datos de ejemplo (solo modo demo) ----------

  function updateSeedButton() {
    const demoMode = !DataService.firebaseReady();
    const isCurrentMonth = monthPickerValue === currentMonthKey();
    const hasData = sessions.some((s) => monthKeyFromDateStr(s.date) === monthPickerValue);
    els.seedBtn.classList.toggle("hidden", !(demoMode && isCurrentMonth && !hasData));
  }

  function seedDemoData() {
    const base = new Date();
    const addDays = (n) => {
      const d = new Date(base);
      d.setDate(d.getDate() + n);
      return toISO(d);
    };
    const demo = [
      { date: addDays(-8), netResult: -20000, bet: 20000, note: "Perdimos todo" },
      { date: addDays(-6), netResult: 10000, bet: 20000, note: "Buena racha", grossGain: 30000 },
      { date: addDays(-4), netResult: -10000, bet: 10000, note: "Perdimos parte" },
      { date: addDays(-2), netResult: 5000, bet: 20000, note: "Ganamos", grossGain: 25000 },
      { date: addDays(0), netResult: 15000, bet: 10000, note: "Hoy ganamos", grossGain: 25000 },
    ];
    Promise.all(demo.map((d) => DataService.addSession(d)))
      .then(loadAndRender)
      .catch((err) => alert("No se pudieron cargar: " + err.message));
  }

  // ---------- Init ----------

  function init() {
    DataService.init();
    const ready = DataService.firebaseReady();
    els.storageBadge.textContent = ready ? "Firebase conectado" : "Modo demo";
    els.storageBadge.className = "badge " + (ready ? "badge-firebase" : "badge-demo");
    els.footer.textContent = ready
      ? "Los datos se guardan en Firebase Firestore."
      : "Modo demo: los datos se guardan en este navegador (localStorage). Configurá Firebase en js/firebase-config.js para guardar en la nube.";

    els.monthPicker.value = monthPickerValue;
    els.monthPicker.addEventListener("change", () => {
      monthPickerValue = els.monthPicker.value;
      renderAll();
    });

    els.sessionDate.value = todayStr();
    els.form.addEventListener("submit", handleSubmit);
    els.historyBody.addEventListener("click", handleHistoryClick);
    els.cancelEdit.addEventListener("click", () => {
      resetForm();
      renderAll();
    });
    document.querySelectorAll('input[name="result"]').forEach((r) =>
      r.addEventListener("change", updateNetLabel)
    );
    els.seedBtn.addEventListener("click", seedDemoData);

    loadAndRender();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
