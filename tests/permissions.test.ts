import { describe, expect, it } from "vitest";
import {
  canManageReport,
  canEditReport,
  canDeleteComment,
  isAdmin,
  isMunicipalityStaff,
} from "@/lib/authorization";
import { STATUS_TRANSITIONS } from "@/lib/constants";

const admin = { id: "u1", role: "ADMIN" as const, municipalityId: null };
const prishtinaStaff = { id: "u2", role: "MUNICIPALITY_EMPLOYEE" as const, municipalityId: "m1" };
const prizrenStaff = { id: "u3", role: "MUNICIPALITY_ADMIN" as const, municipalityId: "m2" };
const citizen = { id: "u4", role: "CITIZEN" as const, municipalityId: "m1" };

describe("canManageReport", () => {
  const report = { municipalityId: "m1" };

  it("lets admins manage any municipality", () => {
    expect(canManageReport(admin, report)).toBe(true);
    expect(canManageReport(admin, { municipalityId: "m2" })).toBe(true);
  });

  it("lets staff manage only their own municipality", () => {
    expect(canManageReport(prishtinaStaff, report)).toBe(true);
    expect(canManageReport(prizrenStaff, report)).toBe(false);
  });

  it("never lets citizens manage reports, even in their own municipality", () => {
    expect(canManageReport(citizen, report)).toBe(false);
  });

  it("rejects staff with no municipality assigned", () => {
    expect(
      canManageReport({ role: "MUNICIPALITY_EMPLOYEE", municipalityId: null }, report)
    ).toBe(false);
  });
});

describe("canEditReport", () => {
  it("lets the author edit only while the report is pending", () => {
    expect(canEditReport(citizen, { createdById: "u4", status: "PENDING" })).toBe(true);
    expect(canEditReport(citizen, { createdById: "u4", status: "VERIFIED" })).toBe(false);
  });

  it("never lets another citizen edit someone else's report", () => {
    expect(canEditReport(citizen, { createdById: "other", status: "PENDING" })).toBe(false);
  });

  it("lets admins edit regardless of status", () => {
    expect(canEditReport(admin, { createdById: "other", status: "COMPLETED" })).toBe(true);
  });
});

describe("canDeleteComment", () => {
  it("allows the author and admins only", () => {
    expect(canDeleteComment(citizen, { userId: "u4" })).toBe(true);
    expect(canDeleteComment(citizen, { userId: "other" })).toBe(false);
    expect(canDeleteComment(admin, { userId: "other" })).toBe(true);
  });
});

describe("role predicates", () => {
  it("classifies roles correctly", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(prishtinaStaff)).toBe(false);
    expect(isMunicipalityStaff(prishtinaStaff)).toBe(true);
    expect(isMunicipalityStaff(prizrenStaff)).toBe(true);
    expect(isMunicipalityStaff(citizen)).toBe(false);
  });
});

describe("STATUS_TRANSITIONS", () => {
  it("does not allow skipping straight from PENDING to COMPLETED", () => {
    expect(STATUS_TRANSITIONS.PENDING).not.toContain("COMPLETED");
  });

  it("allows the normal resolution path", () => {
    expect(STATUS_TRANSITIONS.PENDING).toContain("VERIFIED");
    expect(STATUS_TRANSITIONS.VERIFIED).toContain("ASSIGNED");
    expect(STATUS_TRANSITIONS.ASSIGNED).toContain("IN_PROGRESS");
    expect(STATUS_TRANSITIONS.IN_PROGRESS).toContain("COMPLETED");
  });

  it("only ever names known statuses", () => {
    const known = Object.keys(STATUS_TRANSITIONS);
    for (const targets of Object.values(STATUS_TRANSITIONS)) {
      for (const target of targets) expect(known).toContain(target);
    }
  });
});
