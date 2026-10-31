import { describe, expect, it } from "vitest";

import { parseAdminEmails } from "../convex/lib/auth";

describe("parseAdminEmails", () => {
  it("normalises case and whitespace", () => {
    const emails = parseAdminEmails(" Admin@Example.com,second@EXAMPLE.com ");
    expect([...emails].sort()).toEqual(["admin@example.com", "second@example.com"]);
  });

  it("ignores empty entries", () => {
    expect([...parseAdminEmails(",,admin@example.com,,")]).toEqual(["admin@example.com"]);
  });

  it("returns an empty set when unset or blank", () => {
    expect(parseAdminEmails(undefined).size).toBe(0);
    expect(parseAdminEmails("").size).toBe(0);
    expect(parseAdminEmails("   ").size).toBe(0);
  });
});
