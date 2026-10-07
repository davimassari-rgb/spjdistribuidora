import { describe, expect, it } from "vitest";
import { weekStart, weeksBetween } from "./week";

describe("semana (horário de Brasília)", () => {
  it.each([
    ["2026-10-05T12:00:00-03:00", "2026-10-05"], // segunda
    ["2026-10-07T12:00:00-03:00", "2026-10-05"], // quarta
    ["2026-10-11T23:59:00-03:00", "2026-10-05"], // domingo à noite
    ["2026-10-12T00:00:00-03:00", "2026-10-12"], // segunda 00h
    // 01h UTC de segunda ainda é domingo em Brasília
    ["2026-10-12T01:00:00Z", "2026-10-05"],
    ["2027-01-01T10:00:00-03:00", "2026-12-28"], // virada de ano
  ])("%s → semana de %s", (iso, expected) => {
    expect(weekStart(new Date(iso))).toBe(expected);
  });

  it("conta semanas completas", () => {
    const from = new Date("2026-09-01T10:00:00Z");
    expect(weeksBetween(from, new Date("2026-09-07T10:00:00Z"))).toBe(0);
    expect(weeksBetween(from, new Date("2026-09-08T10:00:00Z"))).toBe(1);
    expect(weeksBetween(from, new Date("2026-09-29T10:00:00Z"))).toBe(4);
    expect(weeksBetween(new Date("2026-10-01"), from)).toBe(0);
  });
});
