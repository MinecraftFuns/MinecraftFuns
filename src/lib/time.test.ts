import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  byRecency,
  compareIsoDate,
  currentYear,
  currentYearIn,
  formatDateIn,
  formatIsoDate,
  isoDate,
  parseIsoDate,
  parseTimeZone,
  SITE_TIME_ZONE,
  startOfDayIn,
  timeZone,
  wallClockAt,
} from "./time.ts";

/** Every assertion must hold no matter where the build runs. */
const HOST_ZONES = [
  "UTC",
  "America/Toronto",
  "America/Los_Angeles",
  "Asia/Shanghai",
  "Pacific/Auckland",
];

const inEachHostZone = (check: () => void): void => {
  const original = process.env.TZ;
  try {
    for (const zone of HOST_ZONES) {
      process.env.TZ = zone;
      check();
    }
  } finally {
    process.env.TZ = original;
  }
};

describe("parseTimeZone", () => {
  it("accepts canonical IANA identifiers", () => {
    for (const zone of ["America/Toronto", "UTC", "Asia/Tokyo"]) {
      assert.equal(parseTimeZone(zone).tag, "ok");
    }
  });

  it("accepts working aliases that supportedValuesOf omits", () => {
    // The reason validation is a construction attempt rather than a list lookup.
    assert.equal(parseTimeZone("US/Eastern").tag, "ok");
  });

  it("rejects identifiers the runtime cannot resolve", () => {
    for (const zone of ["", "Mars/Olympus_Mons", "America/Nowhere", "EST5EDT!"]) {
      assert.equal(parseTimeZone(zone).tag, "invalid", `expected reject: ${zone}`);
    }
  });

  it("is total — no input throws", () => {
    assert.doesNotThrow(() => parseTimeZone("nonsense"));
  });

  it("throws at the build boundary via the smart constructor", () => {
    assert.throws(() => timeZone("Mars/Olympus_Mons"), TypeError);
  });
});

describe("SITE_TIME_ZONE", () => {
  it("is America/Toronto", () => {
    assert.equal(SITE_TIME_ZONE, "America/Toronto");
  });
});

describe("parseIsoDate", () => {
  it("accepts a well-formed calendar date", () => {
    const parsed = parseIsoDate("2026-07-14");
    assert.equal(parsed.tag, "ok");
  });

  it("accepts a leap day in a leap year", () => {
    assert.equal(parseIsoDate("2024-02-29").tag, "ok");
  });

  it("rejects a leap day in a common year", () => {
    assert.equal(parseIsoDate("2025-02-29").tag, "invalid");
  });

  it("rejects days no month has", () => {
    assert.equal(parseIsoDate("2026-02-31").tag, "invalid");
    assert.equal(parseIsoDate("2026-04-31").tag, "invalid");
  });

  it("rejects out-of-range components", () => {
    assert.equal(parseIsoDate("2026-13-01").tag, "invalid");
    assert.equal(parseIsoDate("2026-00-10").tag, "invalid");
    assert.equal(parseIsoDate("2026-07-00").tag, "invalid");
  });

  it("rejects malformed shapes rather than coercing them", () => {
    for (const raw of [
      "",
      "2026-7-14",
      "26-07-14",
      "2026/07/14",
      "2026-07-14T00:00:00Z",
      "not a date",
      " 2026-07-14",
    ]) {
      assert.equal(parseIsoDate(raw).tag, "invalid", `expected reject: ${raw}`);
    }
  });

  it("explains why it rejected", () => {
    const parsed = parseIsoDate("2026-02-31");
    assert.equal(parsed.tag, "invalid");
    assert.match(parsed.tag === "invalid" ? parsed.reason : "", /calendar date/);
  });

  it("throws at the build boundary via the smart constructor", () => {
    assert.equal(isoDate("2026-01-01"), "2026-01-01");
    assert.throws(() => isoDate("2026-02-31"), TypeError);
  });
});

describe("startOfDayIn", () => {
  it("resolves midnight in the configured zone, not UTC", () => {
    // Toronto is UTC-5 in winter, so the day begins at 05:00Z.
    assert.equal(
      startOfDayIn(isoDate("2026-01-15")).toISOString(),
      "2026-01-15T05:00:00.000Z",
    );
  });

  it("tracks daylight saving time", () => {
    // Toronto is UTC-4 in summer, so the same wall-clock midnight is 04:00Z.
    assert.equal(
      startOfDayIn(isoDate("2026-07-14")).toISOString(),
      "2026-07-14T04:00:00.000Z",
    );
  });

  it("resolves the spring-forward transition day", () => {
    // DST begins 2026-03-08 at 02:00 local; midnight still exists at 05:00Z.
    assert.equal(
      startOfDayIn(isoDate("2026-03-08")).toISOString(),
      "2026-03-08T05:00:00.000Z",
    );
  });

  it("resolves the fall-back transition day", () => {
    // DST ends 2026-11-01 at 02:00 local; midnight is still EDT at 04:00Z.
    assert.equal(
      startOfDayIn(isoDate("2026-11-01")).toISOString(),
      "2026-11-01T04:00:00.000Z",
    );
  });

  it("honours an explicitly supplied zone", () => {
    assert.equal(
      startOfDayIn(isoDate("2026-07-14"), timeZone("UTC")).toISOString(),
      "2026-07-14T00:00:00.000Z",
    );
    assert.equal(
      startOfDayIn(isoDate("2026-07-14"), timeZone("Asia/Tokyo")).toISOString(),
      "2026-07-13T15:00:00.000Z",
    );
  });

  it("does not depend on the host zone", () => {
    inEachHostZone(() => {
      assert.equal(
        startOfDayIn(isoDate("2026-07-14")).toISOString(),
        "2026-07-14T04:00:00.000Z",
      );
    });
  });
});

describe("formatIsoDate", () => {
  /*
   * The regression this module exists for. Before it, these rendered a day
   * early anywhere west of Greenwich, because the calendar date became an
   * instant and was then read back in the host's zone.
   */
  it("renders the authored day regardless of host zone", () => {
    inEachHostZone(() => {
      assert.equal(formatIsoDate(isoDate("2026-07-14")), "Jul 14, 2026");
      assert.equal(formatIsoDate(isoDate("2026-01-01")), "Jan 1, 2026");
    });
  });

  it("round-trips every day across a full year of transitions", () => {
    // Exhaustive rather than sampled: DST boundaries are exactly where an
    // off-by-one-day error hides.
    const start = Date.UTC(2026, 0, 1);
    for (let offset = 0; offset < 365; offset += 1) {
      const day = new Date(start + offset * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const date = isoDate(day);
      const [, month, dayOfMonth] = day.split("-");
      const rendered = formatDateIn(date);
      assert.match(
        rendered,
        new RegExp(`\\b${Number(dayOfMonth)}, 2026$`),
        `${day} rendered as ${rendered}`,
      );
      assert.ok(month !== undefined);
    }
  });

  it("honours an explicitly supplied zone", () => {
    // Same calendar date, formatted as that date in any zone — the date is the
    // unit of meaning, so it does not shift.
    assert.equal(
      formatDateIn(isoDate("2026-07-14"), timeZone("Asia/Tokyo")),
      "Jul 14, 2026",
    );
  });
});

describe("wallClockAt", () => {
  it("reads the wall clock in the requested zone", () => {
    const instant = new Date("2026-07-14T16:30:00Z");
    assert.deepEqual(wallClockAt(instant, SITE_TIME_ZONE), {
      year: 2026,
      month: 7,
      day: 14,
      hour: 12,
      minute: 30,
      second: 0,
    });
  });

  it("uses a 24-hour cycle, so midnight is hour 0 rather than 24", () => {
    const instant = new Date("2026-07-14T04:00:00Z");
    assert.equal(wallClockAt(instant, SITE_TIME_ZONE).hour, 0);
  });
});

describe("currentYear", () => {
  it("returns a plausible four-digit year", () => {
    const year = currentYear();
    assert.ok(Number.isInteger(year) && year >= 2024 && year <= 2100);
  });

  it("reads the clock in the configured zone, not the host's", () => {
    // On 1 January 02:00 UTC it is still 31 December in Toronto, so a UTC
    // clock read would print next year's copyright.
    inEachHostZone(() => {
      assert.equal(currentYearIn(SITE_TIME_ZONE), currentYear());
    });
  });
});

describe("compareIsoDate", () => {
  it("orders chronologically", () => {
    assert.ok(compareIsoDate(isoDate("2025-01-01"), isoDate("2026-01-01")) < 0);
    assert.ok(compareIsoDate(isoDate("2026-12-31"), isoDate("2026-01-01")) > 0);
  });

  it("is reflexive and antisymmetric", () => {
    const a = isoDate("2024-03-09");
    const b = isoDate("2026-11-30");
    assert.equal(compareIsoDate(a, a), 0);
    assert.equal(Math.sign(compareIsoDate(a, b)), -Math.sign(compareIsoDate(b, a)));
  });
});

describe("byRecency", () => {
  const item = (date: string) => ({ date: isoDate(date) });

  it("sorts newest first", () => {
    const sorted = byRecency([
      item("2024-01-01"),
      item("2026-01-01"),
      item("2025-06-15"),
    ]);
    assert.deepEqual(
      sorted.map((entry) => entry.date),
      ["2026-01-01", "2025-06-15", "2024-01-01"],
    );
  });

  it("does not mutate its input", () => {
    const input = [item("2024-01-01"), item("2026-01-01")];
    const snapshot = input.map((entry) => entry.date);
    byRecency(input);
    assert.deepEqual(
      input.map((entry) => entry.date),
      snapshot,
    );
  });

  it("handles empty and singleton inputs", () => {
    assert.deepEqual(byRecency([]), []);
    assert.equal(byRecency([item("2026-01-01")]).length, 1);
  });
});
