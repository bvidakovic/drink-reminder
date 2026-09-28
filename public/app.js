import { buildSchedule, buildCalendar, formatLocalInput } from "./schedule.js";

const STORAGE_KEY = "water-on-time-v1";
const SYNC_STORAGE_KEY = "water-on-time-sync-v1";
const startInput = document.querySelector("#start-time");
const startButton = document.querySelector("#start-button");
const errorText = document.querySelector("#setup-error");
const plan = document.querySelector("#plan");
const rounds = document.querySelector("#rounds");
const notifyButton = document.querySelector("#notify-button");
const syncKeyInput = document.querySelector("#sync-key");
const syncStatus = document.querySelector("#sync-status");

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved.startTime === "string") {
      buildSchedule(saved.startTime);
      const validIds = new Set(buildSchedule(saved.startTime).map((step) => step.id));
      return {
        startTime: saved.startTime,
        completed: Array.isArray(saved.completed) ? [...new Set(saved.completed.filter((id) => validIds.has(id)))] : [],
        notified: Array.isArray(saved.notified) ? [...new Set(saved.notified.filter((id) => validIds.has(id)))] : [],
      };
    }
  } catch { /* Ignore invalid saved data. */ }
  return { startTime: null, completed: [], notified: [] };
}

let state = loadState();
let steps = state.startTime ? buildSchedule(state.startTime) : [];
let lastTick = Date.now();

function loadSyncSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY));
    return {
      key: typeof saved?.key === "string" ? saved.key : "",
      pending: Array.isArray(saved?.pending) ? saved.pending : [],
    };
  } catch { return { key: "", pending: [] }; }
}

let syncSettings = loadSyncSettings();
let syncing = null;
function saveSyncSettings() { localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(syncSettings)); }
function setSyncStatus(message, isError = false) {
  syncStatus.textContent = message;
  syncStatus.classList.toggle("error", isError);
}
function renderSyncControls() {
  const connected = Boolean(syncSettings.key);
  document.querySelector("#sync-disconnected").hidden = connected;
  document.querySelector("#sync-connected").hidden = !connected;
}

async function syncRequest(key, method = "GET", body) {
  let response;
  try {
    response = await fetch("/api/sync", {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch { throw new Error("No connection. Your changes are saved on this device."); }
  if (response.status === 404) throw new Error("Sync is available after deployment to Vercel.");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not sync progress.");
  return data;
}

function applyRemotePlan(remote) {
  if (!remote) return;
  const nextStart = remote.startTime ?? null;
  const changedStart = state.startTime !== nextStart;
  state = {
    startTime: nextStart,
    completed: Array.isArray(remote.completed) ? remote.completed : [],
    notified: changedStart ? [] : state.notified,
  };
  steps = state.startTime ? buildSchedule(state.startTime) : [];
  if (state.startTime) startInput.value = formatLocalInput(new Date(state.startTime));
  save();
  render();
  sendDueNotifications();
}

function requestSync() {
  if (!syncSettings.key) return Promise.resolve();
  if (syncing) return syncing;
  const key = syncSettings.key;
  syncing = (async () => {
    setSyncStatus("Syncing…");
    while (true) {
      if (syncSettings.key !== key) return;
      while (syncSettings.pending.length) {
        const operation = syncSettings.pending[0];
        await syncRequest(key, "POST", operation);
        if (syncSettings.key !== key) return;
        syncSettings.pending.shift();
        saveSyncSettings();
      }
      const result = await syncRequest(key);
      if (syncSettings.key !== key) return;
      if (syncSettings.pending.length) continue;
      applyRemotePlan(result.state);
      setSyncStatus("Up to date on this device.");
      return;
    }
  })().catch((error) => {
    if (syncSettings.key !== key) return;
    const waiting = syncSettings.pending.length ? ` ${syncSettings.pending.length} change(s) waiting to sync.` : "";
    setSyncStatus(error.message + waiting, true);
  }).finally(() => { syncing = null; });
  return syncing;
}

function queueSync(operation) {
  if (!syncSettings.key) return;
  syncSettings.pending.push(operation);
  saveSyncSettings();
  void requestSync();
}

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
function formatDue(date) { return `${dayFormat.format(date)} · ${timeFormat.format(date)}`; }
function statusFor(step, now) {
  if (state.completed.includes(step.id)) return "complete";
  if (step.dueAt.getTime() <= now) return "due";
  return "upcoming";
}

function renderRound(cycle, now) {
  const cycleSteps = steps.filter((step) => step.cycle === cycle);
  const completed = cycleSteps.filter((step) => state.completed.includes(step.id)).length;
  const firstDue = cycleSteps[0].dueAt;
  const lastDue = cycleSteps.at(-1).dueAt;
  const rows = cycleSteps.map((step) => {
    const status = statusFor(step, now);
    const statusLabel = status === "complete" ? "Done" : status === "due" ? "Due now" : "Upcoming";
    return `<label class="drink-row ${status}">
      <input type="checkbox" data-step-id="${step.id}" ${status === "complete" ? "checked" : ""} />
      <span class="custom-check" aria-hidden="true">✓</span>
      <span class="drink-copy"><strong>${step.label}</strong><small>${step.phase}</small></span>
      <span class="drink-amount">${step.amountMl} <small>mL</small></span>
      <span class="drink-due"><strong>${timeFormat.format(step.dueAt)}</strong><small>${dayFormat.format(step.dueAt)}</small></span>
      <span class="status-pill">${statusLabel}</span>
    </label>`;
  });
  return `<section class="round-card" aria-labelledby="round-${cycle}-title">
    <div class="round-heading"><div><span class="round-number">ROUND 0${cycle}</span><h3 id="round-${cycle}-title">${cycle === 1 ? "Find your rhythm" : "Keep it flowing"}</h3><p>${formatDue(firstDue)} – ${formatDue(lastDue)}</p></div><span class="round-count">${completed} / 9 done</span></div>
    <div class="table-heading"><span>DRINK</span><span>AMOUNT</span><span>TIME</span><span>STATUS</span></div>
    <div class="drink-list">${rows.slice(0, 4).join("")}</div>
    <div class="break-strip"><span>☕</span><strong>30 minute break</strong><small>Then begin hourly drinks</small></div>
    <div class="drink-list">${rows.slice(4).join("")}</div>
    ${cycle === 1 ? '<div class="break-strip long-break"><span>☾</span><strong>1 hour break</strong><small>Round 2 starts after this pause</small></div>' : ""}
  </section>`;
}

function render() {
  if (!state.startTime) {
    plan.hidden = true;
    startButton.innerHTML = 'Create my schedule <span aria-hidden="true">↗</span>';
    return;
  }
  const now = Date.now();
  plan.hidden = false;
  startButton.innerHTML = 'Update start time <span aria-hidden="true">↗</span>';
  rounds.innerHTML = renderRound(1, now) + renderRound(2, now);
  const count = state.completed.length;
  const volume = steps.filter((step) => state.completed.includes(step.id)).reduce((sum, step) => sum + step.amountMl, 0);
  const percent = Math.round((count / steps.length) * 100);
  document.querySelector("#progress-percent").textContent = `${percent}%`;
  document.querySelector("#progress-count").textContent = `${count} of ${steps.length} completed`;
  document.querySelector("#progress-volume").textContent = `${volume.toLocaleString()} mL of 6,000 mL`;
  document.querySelector("#progress-fill").style.width = `${percent}%`;
  document.querySelector("[role='progressbar']").setAttribute("aria-valuenow", String(count));

  const next = steps.find((step) => !state.completed.includes(step.id));
  document.querySelector("#next-label").textContent = next ? `${next.amountMl} mL · ${next.label}` : "All done!";
  document.querySelector("#next-time").textContent = next ? formatDue(next.dueAt) : "Every drink checked off";
  document.querySelector("#next-detail").textContent = next && next.dueAt.getTime() <= now ? "This drink is due. Check it off after drinking." : "Check off each drink when finished.";
  const overdue = steps.filter((step) => statusFor(step, now) === "due");
  const banner = document.querySelector("#reminder-banner");
  banner.hidden = overdue.length === 0;
  banner.textContent = overdue.length === 1
    ? `${overdue[0].amountMl} mL is due — mark it complete once you've had it.`
    : `${overdue.length} drinks are due — mark each one complete after drinking.`;
  document.title = overdue.length ? `(${overdue.length}) Water, on time` : "Water, on time";
  updateNotificationButton();
}

function updateNotificationButton() {
  if (!("Notification" in window)) {
    notifyButton.textContent = "Notifications unavailable";
    notifyButton.disabled = true;
  } else if (Notification.permission === "granted") {
    notifyButton.textContent = "Notifications enabled ✓";
    notifyButton.disabled = true;
  } else if (Notification.permission === "denied") {
    notifyButton.textContent = "Notifications blocked in browser";
    notifyButton.disabled = true;
  }
}

function sendDueNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = Date.now();
  const due = steps.filter((step) => step.dueAt.getTime() <= now && !state.completed.includes(step.id) && !state.notified.includes(step.id));
  if (!due.length) return;
  const title = due.length === 1 ? "Time for water" : `${due.length} drinks need checking`;
  const body = due.length === 1
    ? `${due[0].amountMl} mL · ${due[0].label}. Check it off after you drink.`
    : "Open your water plan and check off each drink after drinking.";
  try {
    new Notification(title, { body, tag: "water-reminder" });
    state.notified.push(...due.map((step) => step.id));
    save();
  } catch { /* The in-page reminder remains available. */ }
}

function exportChecklist() {
  const lines = ["# Water drinking checklist", "", `Start: ${formatDue(new Date(state.startTime))}`, ""];
  for (let cycle = 1; cycle <= 2; cycle += 1) {
    lines.push(`## Round ${cycle}`, "");
    for (const step of steps.filter((item) => item.cycle === cycle)) {
      if (step.id.endsWith("hourly-1")) lines.push("*30 minute break*", "");
      lines.push(`- [${state.completed.includes(step.id) ? "x" : " "}] ${dayFormat.format(step.dueAt)}, ${timeFormat.format(step.dueAt)} — ${step.amountMl} mL (${step.label})`);
    }
    if (cycle === 1) lines.push("", "*1 hour break, then repeat*", "");
  }
  downloadFile(lines.join("\n") + "\n", "text/markdown;charset=utf-8", `water-checklist-${formatLocalInput(new Date(state.startTime)).slice(0, 10)}.md`);
}

function downloadFile(contents, type, filename) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

startButton.addEventListener("click", () => {
  errorText.hidden = true;
  const selected = startInput.value;
  if (!selected || Number.isNaN(new Date(selected).getTime())) {
    errorText.textContent = "Choose a valid start date and time.";
    errorText.hidden = false;
    startInput.focus();
    return;
  }
  const nextStart = new Date(selected).toISOString();
  if (state.startTime && state.startTime !== nextStart && state.completed.length > 0 && !window.confirm("Changing the start time will clear your checked drinks. Continue?")) return;
  const changedStart = state.startTime !== nextStart;
  if (changedStart) state = { startTime: nextStart, completed: [], notified: [] };
  steps = buildSchedule(state.startTime);
  save();
  render();
  sendDueNotifications();
  if (changedStart) queueSync({ type: "start", startTime: nextStart });
  plan.scrollIntoView({ behavior: "smooth", block: "start" });
});

rounds.addEventListener("change", (event) => {
  const checkbox = event.target.closest("input[data-step-id]");
  if (!checkbox) return;
  const id = checkbox.dataset.stepId;
  state.completed = checkbox.checked ? [...state.completed, id] : state.completed.filter((item) => item !== id);
  save();
  render();
  queueSync({ type: "check", startTime: state.startTime, id, checked: checkbox.checked });
});

document.querySelector("#sync-connect").addEventListener("click", async (event) => {
  const key = syncKeyInput.value.trim();
  if (key.length < 32) { setSyncStatus("Enter the full private sync code.", true); return; }
  const button = event.currentTarget;
  button.disabled = true;
  setSyncStatus("Connecting…");
  try {
    let { state: remote } = await syncRequest(key);
    if (remote && state.startTime && JSON.stringify({ startTime: state.startTime, completed: state.completed }) !== JSON.stringify(remote)
      && !window.confirm("This device has a different checklist. Replace it with the synced checklist?")) {
      setSyncStatus("Connection cancelled. Your local checklist is unchanged.");
      return;
    }
    if (!remote) {
      const result = await syncRequest(key, "POST", { type: "initialize", state: { startTime: state.startTime, completed: state.completed } });
      remote = result.state;
    }
    syncSettings = { key, pending: [] };
    saveSyncSettings();
    syncKeyInput.value = "";
    applyRemotePlan(remote);
    renderSyncControls();
    setSyncStatus("Connected. Use this same code on your other device.");
  } catch (error) { setSyncStatus(error.message, true); }
  finally { button.disabled = false; }
});

document.querySelector("#sync-now").addEventListener("click", () => { void requestSync(); });
document.querySelector("#sync-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(syncSettings.key);
    setSyncStatus("Code copied. Keep it private and enter it on your other device.");
  } catch { setSyncStatus("Could not copy the code. Check your browser permissions.", true); }
});
document.querySelector("#sync-disconnect").addEventListener("click", () => {
  if (syncSettings.pending.length && !window.confirm("Some changes have not synced. Disconnect anyway?")) return;
  syncSettings = { key: "", pending: [] };
  saveSyncSettings();
  renderSyncControls();
  setSyncStatus("Disconnected. Your checklist remains on this device.");
});

notifyButton.addEventListener("click", async () => {
  if (!("Notification" in window)) return;
  await Notification.requestPermission();
  updateNotificationButton();
  sendDueNotifications();
});

document.querySelector("#export-button").addEventListener("click", exportChecklist);
document.querySelector("#calendar-button").addEventListener("click", () => {
  downloadFile(buildCalendar(state.startTime), "text/calendar;charset=utf-8", `water-alerts-${formatLocalInput(new Date(state.startTime)).slice(0, 10)}.ics`);
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { render(); sendDueNotifications(); void requestSync(); }
});
window.addEventListener("online", () => { void requestSync(); });
setInterval(() => { if (!document.hidden) void requestSync(); }, 5 * 60_000);

setInterval(() => {
  const now = Date.now();
  if (Math.floor(now / 60_000) !== Math.floor(lastTick / 60_000)) { render(); sendDueNotifications(); }
  lastTick = now;
}, 10_000);

const initial = new Date();
initial.setMinutes(Math.ceil(initial.getMinutes() / 15) * 15, 0, 0);
startInput.value = state.startTime ? formatLocalInput(new Date(state.startTime)) : formatLocalInput(initial);
renderSyncControls();
if (syncSettings.key) void requestSync();
else setSyncStatus("Sync becomes available after deploying the app and adding private Vercel Blob storage.");
render();
sendDueNotifications();
