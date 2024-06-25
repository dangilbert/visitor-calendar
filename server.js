require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");
const ical = require("ical");
const app = express();
const port = process.env.PORT || 3000;
const calendarUrl = process.env.CALENDAR_URL;

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/events", async (req, res) => {
  try {
    const response = await axios.get(calendarUrl);
    const data = response.data;

    console.log("Data", data);

    const events = [];
    const jCalData = ical.parseICS(data);
    Object.values(jCalData).filter((event) => {
      if (event.type === "VEVENT") {
        events.push({
          title: event.summary,
          start: event.start,
          end: event.end,
        });
      }
    });

    res.json(events);
  } catch (error) {
    res.status(500).send("Error fetching the calendar");
  }
});

app.listen(port, () => {
  console.log(`Proxy server running at http://localhost:${port}`);
});
