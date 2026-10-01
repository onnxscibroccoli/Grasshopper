import { observeWebApplication } from "./web-application-observation.mjs";

const ROLES = Object.freeze([
  "button",
  "link",
  "textbox",
  "checkbox",
  "radio",
  "combobox",
  "heading",
]);

export async function observePlaywrightPage(page) {
  if (!page || typeof page.url !== "function" || typeof page.getByRole !== "function") {
    throw new TypeError("a Playwright-like page is required");
  }

  const elements = [];
  for (const role of ROLES) {
    const locator = page.getByRole(role);
    const count = Math.min(await locator.count(), 200);
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      const name = await item.getAttribute("aria-label")
        || await item.getAttribute("name")
        || "";
      let text = "";
      try {
        text = (await item.innerText()).trim();
      } catch {
        // Some controls have no inner text.
      }
      elements.push({
        id: role + "-" + index,
        role,
        name,
        text,
        selector: "role=" + role + "[name=" + JSON.stringify(name || text) + "]",
      });
    }
  }

  let accessibilityText = "";
  try {
    accessibilityText = await page.locator("body").ariaSnapshot({ mode: "ai" });
  } catch {
    // Older Playwright versions can omit ariaSnapshot.
  }

  return observeWebApplication({
    url: page.url(),
    title: await page.title(),
    elements,
    accessibilityText,
  });
}
