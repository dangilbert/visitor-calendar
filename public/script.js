// Renders busy date ranges from /api/events as month grids, plus a short list
// of the next free stretches. Dates are handled as YYYY-MM-DD strings in the
// household's timezone throughout, so nothing shifts across DST or devices.

const TIME_ZONE = "Europe/Madrid";
const MONTHS_SHOWN = window.matchMedia("(max-width: 480px)").matches ? 3 : 6;
const LOOKAHEAD_DAYS = 365;
const MIN_DAYS = 3;
const OPENINGS_SHOWN = 4;

const todayYmd = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const toDate = (ymd) => new Date(`${ymd}T00:00:00Z`);
const toYmd = (d) => d.toISOString().slice(0, 10);
const addDays = (ymd, n) => {
  const d = toDate(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return toYmd(d);
};
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);

const fmtMonth = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const fmtDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmtDow = new Intl.DateTimeFormat("en-GB", { weekday: "narrow", timeZone: "UTC" });

let busy = [];
let firstMonth = todayYmd.slice(0, 7) + "-01";

const isBusy = (ymd) => busy.some((r) => ymd >= r.start && ymd <= r.end);

function renderMonths() {
  const container = document.getElementById("months");
  container.replaceChildren();

  for (let i = 0; i < MONTHS_SHOWN; i++) {
    const first = toDate(firstMonth);
    first.setUTCMonth(first.getUTCMonth() + i);
    const firstYmd = toYmd(first);

    const month = document.createElement("article");
    month.className = "month";
    const title = document.createElement("h3");
    title.textContent = fmtMonth.format(first);
    month.append(title);

    const grid = document.createElement("div");
    grid.className = "grid";
    // Weeks start on Monday. 2024-01-01 was a Monday.
    for (let d = 0; d < 7; d++) {
      const el = document.createElement("div");
      el.className = "dow";
      el.textContent = fmtDow.format(toDate(addDays("2024-01-01", d)));
      grid.append(el);
    }

    const leading = (first.getUTCDay() + 6) % 7;
    for (let k = 0; k < leading; k++) grid.append(document.createElement("div"));

    const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const ymd = addDays(firstYmd, day - 1);
      const col = (leading + day - 1) % 7;
      const el = document.createElement("div");
      const classes = ["day"];
      if (ymd < todayYmd) classes.push("past");
      if (ymd === todayYmd) classes.push("today");
      if (isBusy(ymd)) {
        classes.push("busy");
        // Round the bar where a stay begins or ends, and at row edges.
        if (!isBusy(addDays(ymd, -1)) || col === 0 || day === 1) classes.push("start");
        if (!isBusy(addDays(ymd, 1)) || col === 6 || day === daysInMonth) classes.push("end");
      }
      el.className = classes.join(" ");
      const label = document.createElement("span");
      label.textContent = day;
      el.append(label);
      el.setAttribute("aria-label", `${fmtDay.format(toDate(ymd))}: ${isBusy(ymd) ? "unavailable" : "free"}`);
      grid.append(el);
    }

    month.append(grid);
    container.append(month);
  }
}

function freeStretches() {
  const horizon = addDays(todayYmd, LOOKAHEAD_DAYS);
  const upcoming = busy.filter((r) => r.end >= todayYmd && r.start <= horizon);
  const stretches = [];
  let cursor = todayYmd;
  for (const r of upcoming) {
    if (r.start > cursor) stretches.push({ start: cursor, end: addDays(r.start, -1) });
    if (addDays(r.end, 1) > cursor) cursor = addDays(r.end, 1);
  }
  if (cursor <= horizon) stretches.push({ start: cursor, end: null });
  // A stretch with no end runs past the horizon.
  return stretches
    .map((s) => ({ ...s, nights: s.end ? daysBetween(s.start, s.end) + 1 : Infinity }))
    .filter((s) => s.nights >= MIN_DAYS)
    .slice(0, OPENINGS_SHOWN);
}

function renderOpenings() {
  const list = document.getElementById("openings");
  list.replaceChildren();
  const stretches = freeStretches();
  if (stretches.length === 0) {
    const li = document.createElement("li");
    li.textContent = "We're booked up for the next year. Ask us anyway!";
    list.append(li);
    return;
  }
  for (const s of stretches) {
    const li = document.createElement("li");
    const dates = document.createElement("div");
    dates.className = "dates";
    dates.textContent = s.end
      ? `${fmtDay.format(toDate(s.start))} – ${fmtDay.format(toDate(s.end))}`
      : `From ${fmtDay.format(toDate(s.start))}`;
    const nights = document.createElement("div");
    nights.className = "nights";
    nights.textContent = s.end ? `${s.nights} days free` : "Wide open after that";
    li.append(dates, nights);
    list.append(li);
  }
}

function shiftMonths(n) {
  const d = toDate(firstMonth);
  d.setUTCMonth(d.getUTCMonth() + n);
  firstMonth = toYmd(d);
  renderMonths();
}

document.getElementById("prev").addEventListener("click", () => shiftMonths(-MONTHS_SHOWN));
document.getElementById("next").addEventListener("click", () => shiftMonths(MONTHS_SHOWN));
document.getElementById("today").addEventListener("click", () => {
  firstMonth = todayYmd.slice(0, 7) + "-01";
  renderMonths();
});

renderMonths();

fetch("/api/events")
  .then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then((ranges) => {
    busy = ranges;
    renderMonths();
    renderOpenings();
  })
  .catch((err) => {
    console.error("Error fetching calendar:", err);
    document.getElementById("openings").replaceChildren();
    const status = document.getElementById("status");
    status.textContent = "Couldn't load our calendar just now. Please try again in a bit.";
    status.classList.add("error");
  });
