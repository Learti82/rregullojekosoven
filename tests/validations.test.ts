import { describe, expect, it } from "vitest";
import { registerSchema, loginSchema, changePasswordSchema } from "@/validations/auth";
import { createReportSchema, updateStatusSchema, commentSchema } from "@/validations/report";

const validRegistration = {
  name: "Arta Krasniqi",
  username: "arta_k",
  email: "Arta@Shembull.com",
  password: "Sigurt123",
  confirmPassword: "Sigurt123",
  acceptTerms: true as const,
};

describe("registerSchema", () => {
  it("accepts a valid registration and normalises the email", () => {
    const result = registerSchema.safeParse(validRegistration);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("arta@shembull.com");
  });

  it("requires the password confirmation to match", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      confirmPassword: "Different123",
    });
    expect(result.success).toBe(false);
  });

  it("enforces password complexity", () => {
    for (const password of ["short1A", "alllowercase1", "ALLUPPERCASE1", "NoDigitsHere"]) {
      const result = registerSchema.safeParse({
        ...validRegistration,
        password,
        confirmPassword: password,
      });
      expect(result.success, `expected ${password} to be rejected`).toBe(false);
    }
  });

  it("rejects passwords beyond bcrypt's 72-byte limit", () => {
    const password = `A1${"a".repeat(80)}`;
    const result = registerSchema.safeParse({
      ...validRegistration,
      password,
      confirmPassword: password,
    });
    expect(result.success).toBe(false);
  });

  it("rejects usernames with unsupported characters", () => {
    for (const username of ["ab", "with space", "email@x", "a".repeat(30)]) {
      expect(
        registerSchema.safeParse({ ...validRegistration, username }).success,
        `expected ${username} to be rejected`
      ).toBe(false);
    }
  });

  it("normalises mixed-case usernames rather than rejecting them", () => {
    const result = registerSchema.safeParse({ ...validRegistration, username: "ArtaK" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.username).toBe("artak");
  });

  it("requires the terms checkbox", () => {
    const result = registerSchema.safeParse({ ...validRegistration, acceptTerms: false });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("rejects malformed emails", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("rejects reusing the current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "Sigurt123",
      newPassword: "Sigurt123",
      confirmPassword: "Sigurt123",
    });
    expect(result.success).toBe(false);
  });
});

const validReport = {
  title: "Gropë e madhe në rrugën kryesore",
  description: "Kjo gropë ekziston prej dy muajsh dhe rrezikon automjetet që kalojnë.",
  categoryId: "clx0000000000000000000000",
  municipalityId: "clx0000000000000000000001",
  latitude: 42.6629,
  longitude: 21.1655,
  priority: "MEDIUM" as const,
  isAnonymous: false,
  images: [],
};

describe("createReportSchema", () => {
  it("accepts a well-formed report", () => {
    expect(createReportSchema.safeParse(validReport).success).toBe(true);
  });

  it("rejects coordinates outside Kosovo", () => {
    expect(
      createReportSchema.safeParse({ ...validReport, latitude: 48.85, longitude: 2.35 }).success
    ).toBe(false);
  });

  it("enforces minimum title and description lengths", () => {
    expect(createReportSchema.safeParse({ ...validReport, title: "Gropë" }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...validReport, description: "Shkurt" }).success).toBe(
      false
    );
  });

  it("caps the number of attached images", () => {
    const image = {
      url: "https://cdn.example.com/a.jpg",
      key: "reports/2026/01/a.jpg",
      sizeBytes: 1000,
      mimeType: "image/jpeg" as const,
    };
    const result = createReportSchema.safeParse({
      ...validReport,
      images: Array.from({ length: 10 }, () => image),
    });
    expect(result.success).toBe(false);
  });

  it("rejects image types outside the allow-list", () => {
    const result = createReportSchema.safeParse({
      ...validReport,
      images: [
        {
          url: "https://cdn.example.com/a.svg",
          key: "reports/a.svg",
          sizeBytes: 100,
          mimeType: "image/svg+xml",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateStatusSchema", () => {
  const base = { reportId: "clx0000000000000000000000", images: [] };

  it("requires a reason when rejecting", () => {
    expect(updateStatusSchema.safeParse({ ...base, status: "REJECTED", note: "" }).success).toBe(
      false
    );
    expect(
      updateStatusSchema.safeParse({ ...base, status: "REJECTED", note: "Jashtë juridiksionit." })
        .success
    ).toBe(true);
  });

  it("requires the original report when marking a duplicate", () => {
    expect(updateStatusSchema.safeParse({ ...base, status: "DUPLICATE" }).success).toBe(false);
    expect(
      updateStatusSchema.safeParse({
        ...base,
        status: "DUPLICATE",
        duplicateOfId: "clx0000000000000000000009",
      }).success
    ).toBe(true);
  });
});

describe("commentSchema", () => {
  it("rejects empty and oversized bodies", () => {
    const reportId = "clx0000000000000000000000";
    expect(commentSchema.safeParse({ reportId, body: "x" }).success).toBe(false);
    expect(commentSchema.safeParse({ reportId, body: "a".repeat(2500) }).success).toBe(false);
    expect(commentSchema.safeParse({ reportId, body: "Dakord me këtë." }).success).toBe(true);
  });
});
