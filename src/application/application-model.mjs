const SCHEMA = "omnikali.application.model/v1";

function stableText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function createApplicationModel(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("application model input must be an object");
  }

  const model = {
    schema: SCHEMA,
    source: input.source || "unknown",
    observedAt: input.observedAt || new Date().toISOString(),
    identity: {
      package: stableText(input.identity?.package),
      version: stableText(input.identity?.version),
      url: stableText(input.identity?.url),
      title: stableText(input.identity?.title),
    },
    elements: Array.isArray(input.elements)
      ? input.elements.map((element, index) => ({
          id: stableText(element.id) || \`element-\${index + 1}\`,
          role: stableText(element.role),
          name: stableText(element.name),
          text: stableText(element.text),
          selector: stableText(element.selector),
          bounds: element.bounds ?? null,
        }))
      : [],
    evidence: Array.isArray(input.evidence) ? input.evidence : [],
  };

  return Object.freeze(model);
}

export function findElement(model, query) {
  const needle = stableText(query).toLowerCase();
  if (!needle) return null;

  return model.elements.find((element) =>
    [element.name, element.text, element.id, element.role]
      .some((value) => stableText(value).toLowerCase() === needle)
  ) || model.elements.find((element) =>
    [element.name, element.text, element.id]
      .some((value) => stableText(value).toLowerCase().includes(needle))
  ) || null;
}
