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
    sessionId: $("sessionId"),
    sessionDate: $("sessionDate"),
    betTotal: $("betTotal"),
    netAmount: $("netAmount"),
    netLabel: $("netLabel"),
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
    els.netPerPerson.textContent = `${fmtSigned(stats.net / 2)} por persona`;
  }

  function renderDaysCard(stats, isCurrentMonth) {
    if (!isCurrentMonth) {
      els.daysValue.textContent = "-";
      els.daysExtra.textContent = "Solo aplica al mes actual";
      els.daysPlayed.textContent = "";
      return;
    }
    const extra = extraDaysFor(stats.net);
    const allowed = allowedDays(stats.net);
    const played = daysPlayedThisWeek();
    els.daysValue.textContent = `${played} / ${allowed}`;
    els.daysExtra.textContent =
      extra > 0
        ? `Días extra: +${extra} (cada ${fmt(RULES.extraDayThreshold)} de ganancia)`
        : "Sin días extra aún";
    els.daysPlayed.textContent = "Jugados esta semana: " + played;
  }

  function renderStatus(stats, isCurrentMonth) {
    if (!isCurrentMonth) {
      setStatus("Mes anterior", "El estado de hoy solo aplica al mes actual.", "neutral");
      return;
    }
    const played = daysPlayedThisWeek();
    const allowed = allowedDays(stats.net);
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

  // ---------- Historial ----------

  function renderHistory(stats, monthKey) {
    els.historyMonth.textContent = monthKey;
    const sorted = sortByDate(stats.sessions);
    els.emptyHistory.classList.toggle("hidden", sorted.length > 0);

    els.historyBody.innerHTML = sorted
      .map((s) => {
        const cls = s.netResult >= 0 ? "positive" : "negative";
        return `<tr>
          <td>${fmtDate(s.date)}</td>
          <td class="num">${fmt(s.betTotal)}</td>
          <td class="num ${cls}">${fmtSigned(s.netResult)}</td>
          <td class="num">${fmt(s.netResult / 2)}</td>
          <td>${escapeHtml(s.note || "")}</td>
          <td>
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
    els.netLabel.textContent = currentResultIsGain()
      ? "Monto ganado (neto, total)"
      : "Monto perdido (total)";
  }

  // Si perdieron, la pérdida máxima es lo apostado: la completa sola
  // con la apuesta (queda editable por si perdieron solo parte).
  function syncLossToBet(force) {
    if (currentResultIsGain()) return;
    const bet = els.betTotal.value;
    const current = els.netAmount.value;
    if (force || current === "" || Number(current) === 0) {
      els.netAmount.value = bet;
    }
  }

  function resetForm() {
    editingId = null;
    els.form.reset();
    els.sessionDate.value = todayStr();
    els.betTotal.value = RULES.defaultBetTotal;
    els.saveBtn.textContent = "Guardar sesión";
    els.cancelEdit.classList.add("hidden");
    updateNetLabel();
  }

  function startEdit(session) {
    editingId = session.id;
    els.sessionId.value = session.id;
    els.sessionDate.value = session.date;
    els.betTotal.value = session.betTotal;
    els.netAmount.value = Math.abs(session.netResult);
    els.note.value = session.note || "";
    const gain = session.netResult >= 0;
    document.querySelector('input[name="result"][value="' + (gain ? "gain" : "loss") + '"]').checked = true;
    updateNetLabel();
    els.saveBtn.textContent = "Actualizar sesión";
    els.cancelEdit.classList.remove("hidden");
    els.sessionDate.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const date = els.sessionDate.value;
    const betTotal = Number(els.betTotal.value) || 0;
    const amount = Number(els.netAmount.value) || 0;
    const gain = currentResultIsGain();
    const netResult = gain ? amount : -amount;
    const note = els.note.value.trim();

    if (amount <= 0) {
      alert("Ingresá un monto mayor a cero.");
      return;
    }

    if (!gain && amount > betTotal) {
      alert(
        "No se puede perder más de lo apostado. Si perdieron todo, el monto perdido es la apuesta (" +
          fmt(betTotal) +
          ")."
      );
      return;
    }

    const session = { date, betTotal, netResult, note };

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
      { date: addDays(-8), betTotal: 20000, netResult: -20000, note: "Perdimos todo" },
      { date: addDays(-6), betTotal: 10000, netResult: 30000, note: "Buena racha" },
      { date: addDays(-4), betTotal: 15000, netResult: -10000, note: "Perdimos parte" },
      { date: addDays(-2), betTotal: 10000, netResult: 25000, note: "Ganamos" },
      { date: addDays(0), betTotal: 20000, netResult: 15000, note: "Hoy ganamos" },
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
    els.cancelEdit.addEventListener("click", resetForm);
    els.betTotal.addEventListener("input", () => syncLossToBet(false));
    document.querySelectorAll('input[name="result"]').forEach((r) =>
      r.addEventListener("change", () => {
        updateNetLabel();
        syncLossToBet(true);
      })
    );
    els.seedBtn.addEventListener("click", seedDemoData);

    loadAndRender();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
