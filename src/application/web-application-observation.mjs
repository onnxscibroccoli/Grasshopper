import { createApplicationModel } from "./application-model.mjs";
import { detectHumanBoundary } from "./human-boundary.mjs";

export function observeWebApplication(snapshot = {}) {
  const model = createApplicationModel({
    source: "web-live",
    identity: {
      url: snapshot.url,
      title: snapshot.title,
    },
    elements: snapshot.elements,
    evidence: snapshot.evidence,
  });

  return Object.freeze({
    model,
    humanBoundary: detectHumanBoundary(snapshot),
  });
}
