const url = process.env.OMNIKALI_READINESS_URL;

if (!url) {
  console.error("OMNIKALI_READINESS_URL is required.");
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error("OMNIKALI_READINESS_URL is not a valid URL.");
  process.exit(1);
}

if (parsed.protocol !== "https:" && process.env.OMNIKALI_ALLOW_INSECURE_READINESS !== "1") {
  console.error("Production readiness requires HTTPS.");
  process.exit(1);
}

const timeoutMs = Number(process.env.OMNIKALI_READINESS_TIMEOUT_MS || 10000);
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);

try {
  const response = await fetch(parsed, {
    method: "GET",
    redirect: "manual",
    signal: controller.signal,
    headers: { "accept": "application/json" }
  });

  if (response.status !== 200) {
    console.error(`Readiness failed: HTTP ${response.status}`);
    process.exit(1);
  }

  console.log("Production readiness endpoint: HTTP 200");
} catch (error) {
  console.error("Production readiness request failed:", error.name === "AbortError" ? "timeout" : error.message);
  process.exit(1);
} finally {
  clearTimeout(timer);
}
