/**
 * Contract tests for PATCH /api/parents/setup.
 *
 * Onboarding step: parent saves phone number + profile-access PIN, and
 * `account.new` flips to false.
 *
 * Five questions:
 *   Q1 ownership — implicit (operates on calling user's own parent row)
 *   Q2 validation — phoneNumber + pin types + .strict()
 *   Q3 response — { success: true }
 *   Q4 side effects — parents.phone_number / .profile_access_pin set; account.new = false
 *   Q5 external calls — none
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { createAccount, createParent } from "@tests/helpers/factories";
import { signSessionFor } from "@tests/helpers/auth";
import { resetAll } from "@tests/helpers/db";
import { call } from "@tests/helpers/request";
import { server } from "@tests/helpers/msw";
import { expectRowExists } from "@tests/helpers/sideEffects";

import { PATCH as setupPATCH } from "@/src/app/api/parents/setup/route";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
beforeEach(resetAll);

async function seedParent() {
  const owner = await createAccount({ role: 1 });
  const parent = await createParent(owner);
  const cookies = await signSessionFor(owner);
  return { owner, parent, cookies };
}

const VALID_BODY = { phoneNumber: "+15551234567", pin: "1234" };

describe("PATCH /api/parents/setup — input validation", () => {
  it("returns 400 when phoneNumber is missing", async () => {
    const { cookies } = await seedParent();
    const res = await call(setupPATCH, {
      method: "PATCH",
      cookies,
      body: { pin: "1234" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when pin is missing", async () => {
    const { cookies } = await seedParent();
    const res = await call(setupPATCH, {
      method: "PATCH",
      cookies,
      body: { phoneNumber: "+15551234567" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body contains unknown fields (strict)", async () => {
    const { cookies } = await seedParent();
    const res = await call(setupPATCH, {
      method: "PATCH",
      cookies,
      body: { ...VALID_BODY, extraneous: "field" },
    });
    expect(res.status).toBe(400);
  });

  it("error responses use the { error: string } shape", async () => {
    const { cookies } = await seedParent();
    const res = await call(setupPATCH, {
      method: "PATCH",
      cookies,
      body: {},
    });
    const body = await res.json<{ error?: string; success?: boolean; message?: string }>();
    expect(typeof body.error).toBe("string");
    expect(body.success).toBeUndefined();
    expect(body.message).toBeUndefined();
  });
});

describe("PATCH /api/parents/setup — response shape", () => {
  it("returns { success: true } on success", async () => {
    const { cookies } = await seedParent();
    const res = await call(setupPATCH, {
      method: "PATCH",
      cookies,
      body: VALID_BODY,
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ success: boolean }>();
    expect(body).toEqual({ success: true });
  });
});

describe("PATCH /api/parents/setup — side effects", () => {
  it("updates parents.phone_number and profile_access_pin", async () => {
    const { cookies, owner } = await seedParent();
    await call(setupPATCH, {
      method: "PATCH",
      cookies,
      body: VALID_BODY,
    });
    const row = await expectRowExists("parents", { account_id: owner.id });
    expect(row.phone_number).toBe("+15551234567");
    expect(row.profile_access_pin).toBe("1234");
  });

  it("flips account.new to false", async () => {
    const { cookies, owner } = await seedParent();
    await call(setupPATCH, {
      method: "PATCH",
      cookies,
      body: VALID_BODY,
    });
    const row = await expectRowExists("account", { id: owner.id });
    expect(row.new).toBe(false);
  });
});
