import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const path = request.path.split("?", 1)[0];
  const errorType = error instanceof Error ? error.name : "Error";
  const digest = typeof error === "object" && error !== null && "digest" in error && typeof error.digest === "string"
    ? error.digest
    : null;
  console.error(JSON.stringify({
    event: "application.request_error",
    severity: "error",
    environment: process.env.APP_ENVIRONMENT ?? "unknown",
    release: process.env.APP_RELEASE ?? "unversioned",
    errorType: errorType || "Error",
    digest,
    method: request.method,
    path,
    route: context.routePath,
    routeType: context.routeType,
    router: context.routerKind,
    occurredAt: new Date().toISOString(),
  }));
};
