require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");
const ical = require("ical");

const app = express();
const port = process.env.PORT || 3000;
const calendarUrl = process.env.CALENDAR_URL;

// Days are reckoned in the household's timezone, so a timed event that ends at
// 01:00 Madrid time doesn't spill into a UTC "previous day".
const TIME_ZONE = "Europe/Madrid";
const CACHE_MS = 5 * 60 * 1000;
// Old trips are of no use to a visitor planning ahead.
const HISTORY_DAYS = 60;

const ymdInZone = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// ical builds all-day dates at local midnight; read them back the same way.
const ymdLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Turn an event into an inclusive [start, end] range of calendar days.
const toDayRange = (event) => {
  if (event.start.dateOnly) {
    const start = ymdLocal(event.start);
    // DTEND is exclusive for all-day events, and may be missing for one-day ones.
    const end = event.end ? addDays(ymdLocal(event.end), -1) : start;
    return { start, end: end < start ? start : end };
  }
  const start = ymdInZone.format(event.start);
  const endInstant = event.end ? new Date(event.end.getTime() - 1) : event.start;
  const end = ymdInZone.format(endInstant);
  return { start, end: end < start ? start : end };
};

// Overlapping or touching ranges become one, so the client draws one block.
const merge = (ranges) => {
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= addDays(last.end, 1)) {
      if (r.end > last.end) last.end = r.end;
    } else {
      out.push({ ...r });
    }
  }
  return out;
};

let cache = { at: 0, ranges: null };

const loadBusyRanges = async () => {
  if (cache.ranges && Date.now() - cache.at < CACHE_MS) return cache.ranges;
  const response = await axios.get(calendarUrl, { responseType: "text" });
  const cutoff = addDays(ymdInZone.format(new Date()), -HISTORY_DAYS);
  const ranges = Object.values(ical.parseICS(response.data))
    .filter((e) => e.type === "VEVENT" && e.start)
    .map(toDayRange)
    .filter((r) => r.end >= cutoff);
  cache = { at: Date.now(), ranges: merge(ranges) };
  return cache.ranges;
};

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(express.static(path.join(__dirname, "public")));

// Only busy date ranges leave the server. Event titles say who is visiting or
// where we are, and the page never shows them, so they are not sent at all.
app.get("/api/events", async (req, res) => {
  try {
    const ranges = await loadBusyRanges();
    res.set("Cache-Control", "public, max-age=300");
    res.json(ranges);
  } catch (error) {
    console.error("Calendar fetch failed:", error.message);
    res.status(502).json({ error: "Could not load the calendar" });
  }
});

app.listen(port, () => {
  console.log(`Visitor calendar listening on http://localhost:${port}`);
});
