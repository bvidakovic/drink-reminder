export const FIRST_HOUR_GLASS_ML = 375;
export const HOURLY_DRINK_ML = 300;
export const CYCLE_MINUTES = 450;

export function buildSchedule(startTime) {
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) throw new Error("Choose a valid start time.");

  const steps = [];
  for (let cycle = 0; cycle < 2; cycle += 1) {
    const cycleStart = cycle * CYCLE_MINUTES;
    for (let glass = 1; glass <= 4; glass += 1) {
      steps.push({
        id: `${cycle + 1}-glass-${glass}`,
        cycle: cycle + 1,
        phase: "First hour",
        label: `Glass ${glass} of 4`,
        amountMl: FIRST_HOUR_GLASS_ML,
        dueAt: new Date(start.getTime() + (cycleStart + (glass - 1) * 15) * 60_000),
      });
    }
    for (let drink = 1; drink <= 5; drink += 1) {
      steps.push({
        id: `${cycle + 1}-hourly-${drink}`,
        cycle: cycle + 1,
        phase: "Hourly drinks",
        label: `Hourly drink ${drink} of 5`,
        amountMl: HOURLY_DRINK_ML,
        dueAt: new Date(start.getTime() + (cycleStart + 90 + (drink - 1) * 60) * 60_000),
      });
    }
  }
  return steps;
}

export function formatLocalInput(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function buildCalendar(startTime) {
  const stamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const created = stamp(new Date());
  const events = buildSchedule(startTime).flatMap((step) => [
    "BEGIN:VEVENT",
    `UID:water-${step.id}-${new Date(startTime).getTime()}@local`,
    `DTSTAMP:${created}`,
    `DTSTART:${stamp(step.dueAt)}`,
    `DTEND:${stamp(new Date(step.dueAt.getTime() + 5 * 60_000))}`,
    `SUMMARY:Drink ${step.amountMl} mL of water`,
    `DESCRIPTION:${step.label}\\nCheck it off in your water plan after drinking.`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:PT0S",
    `DESCRIPTION:Time to drink ${step.amountMl} mL of water`,
    "END:VALARM",
    "END:VEVENT",
  ]);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Water on time//Reminder//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR", ""].join("\r\n");
}
