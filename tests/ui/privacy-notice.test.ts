// @vitest-environment jsdom
// Public /account/privacy notice: the verified Shopify-hosted links stay reachable by
// name, and the copy separates the existing Meta pixel from the inactive Google foundation.
import React from "react";
(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const account = vi.hoisted(() => ({session: null as null | {status: string}}));
vi.mock("../../app/account/account-client", () => ({
  useAccount: () => ({session: account.session, reloadSession: () => {}, csrf: ""}),
  PageHeading: ({title}: {title: string}) => React.createElement("h1", null, title),
}));

import AccountPrivacyPage from "../../app/account/privacy/page";
import { HOSTED_PRIVACY } from "../../lib/hosted-privacy";

afterEach(() => { cleanup(); account.session = null; });

it("links to the approved Shopify-hosted choices and policy by accessible name", () => {
  render(React.createElement(AccountPrivacyPage));
  expect(screen.getByRole("heading", {name: "Privacy"})).toBeTruthy();
  expect(screen.getByText("No sign-in needed.")).toBeTruthy();
  const choices = screen.getByRole("link", {name: /Your Privacy Choices/});
  const policy = screen.getByRole("link", {name: /Privacy policy/});
  expect(choices.getAttribute("href")).toBe("https://nr9zd0-t5.myshopify.com/pages/data-sharing-opt-out");
  expect(policy.getAttribute("href")).toBe("https://nr9zd0-t5.myshopify.com/policies/privacy-policy");
  expect([choices.getAttribute("href"), policy.getAttribute("href")]).toEqual([HOSTED_PRIVACY.choices, HOSTED_PRIVACY.policy]);
  for (const link of [choices, policy]) expect(link.getAttribute("rel")).toBe("noopener");
  expect(screen.getByRole("region", {name: "Privacy options"})).toBeTruthy();
});

it("states the Meta pixel's behavior and that Google measurement is inactive, without overclaiming", () => {
  account.session = {status: "signed_in"};
  render(React.createElement(AccountPrivacyPage));
  expect(screen.queryByText("No sign-in needed.")).toBeNull();
  const text = screen.getByRole("region", {name: "Privacy options"}).textContent || "";
  expect(text).toContain("Choices you make there are recorded by Shopify for the IQON store and its checkout.");
  expect(text).toContain("Our storefront uses the Meta pixel to measure page views, product views and additions to your bag.");
  expect(text).toContain("It does not load when your browser sends Global Privacy Control.");
  expect(text).toContain("Google Analytics and Google Ads measurement is not active on this storefront.");
  expect(text).toContain("Turning it on would first require a way to give or refuse consent on this site and an updated notice.");
  expect(text).toContain("A choice on Shopify’s pages alone would not count as consent to it.");
  // No Google Purchase/conversion claim, no "never" guarantee, no legal conclusion.
  expect(text).not.toMatch(/purchase|conversion|never|compl(y|iant|iance)|lawful|GDPR|CCPA/i);
  expect(text).not.toMatch(/Google[^.]*\b(uses|measures|tracks)\b/);
});
