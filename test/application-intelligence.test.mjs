import test from "node:test";
import assert from "node:assert/strict";
import { createApplicationModel, findElement } from "../src/application/application-model.mjs";
import { detectHumanBoundary } from "../src/application/human-boundary.mjs";
import { observeWebApplication } from "../src/application/web-application-observation.mjs";

test("application model normalizes semantic elements", () => {
  const model = createApplicationModel({
    source: "web-live",
    identity: { title: "  Example   App " },
    elements: [{ id: "login", role: "button", text: " Sign in " }],
  });

  assert.equal(model.schema, "omnikali.application.model/v1");
  assert.equal(model.identity.title, "Example App");
  assert.equal(findElement(model, "sign in").id, "login");
});

test("human boundary pauses automation on CAPTCHA", () => {
  const boundary = detectHumanBoundary({
    title: "Verify you are human",
    text: "Complete the CAPTCHA to continue",
  });

  assert.equal(boundary.status, "HUMAN_REQUIRED");
  assert.equal(boundary.reason, "CAPTCHA_REQUIRED");
  assert.equal(boundary.resume, "ON_USER_COMPLETION");
});

test("human boundary detects MFA without solving it", () => {
  const boundary = detectHumanBoundary({
    text: "Enter the verification code from your authenticator app",
  });

  assert.equal(boundary.reason, "MFA_REQUIRED");
});

test("ordinary page has no human boundary", () => {
  assert.equal(detectHumanBoundary({
    title: "Dashboard",
    text: "Welcome back",
  }), null);
});

test("web observation returns model plus boundary", () => {
  const observed = observeWebApplication({
    url: "https://example.test/login",
    title: "Sign in",
    elements: [{ id: "submit", role: "button", text: "Sign in" }],
  });

  assert.equal(observed.model.source, "web-live");
  assert.equal(observed.humanBoundary.reason, "AUTHENTICATION_REQUIRED");
});
