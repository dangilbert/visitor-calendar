const transitionDay = (date, after) => {
  const startDate = new Date(date);
  startDate.setUTCHours(0, 0, 0);
  startDate.setDate(startDate.getDate() + (after ? 1 : -1));
  const endDate = new Date(startDate);
  endDate.setUTCHours(23, 59, 59);
  return {
    title: "Transition Day",
    start: startDate,
    end: endDate,
    className: "fc-transition",
  };
};

document.addEventListener("DOMContentLoaded", function () {
  var calendarEl = document.getElementById("calendar");
  var calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    timeZone: "Europe/Madrid",
    events: function (info, successCallback, failureCallback) {
      fetch("/api/events")
        .then((response) => response.json())
        .then((events) => {
          successCallback([
            ...events.map((event) => ({
              title: "Unavailable",
              start: event.start,
              end: event.end,
              className: "fc-unavailable",
            })),
            ...events.map((event) => transitionDay(event.start)),
            ...events.map((event) => transitionDay(event.end, true)),
          ]);
        })
        .catch((error) => {
          console.error("Error fetching calendar:", error);
          failureCallback(error);
        });
    },
    eventDidMount: function (info) {
      info.el.style.backgroundColor = "red";
    },
    headerToolbar: {
      left: "prev,next today",
      right: "title",
    },
    titleFormat: {
      year: "numeric",
      month: "short",
    },
    displayEventTime: false,
    firstDay: 1,
  });

  calendar.render();

  document
    .getElementById("refresh-button")
    .addEventListener("click", function () {
      calendar.refetchEvents();
    });
});
