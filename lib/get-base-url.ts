export function getBaseURL() {
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (
    (process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "production") &&
    process.env.VERCEL_URL
  ) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return `http://localhost:${process.env.PORT || "3000"}`;
}
