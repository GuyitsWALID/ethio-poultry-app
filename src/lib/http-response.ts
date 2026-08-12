type ErrorPayload = { error?: unknown; message?: unknown };

function messageFromPayload(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const payload = value as ErrorPayload;
  if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
  if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
  return null;
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(
        response.ok
          ? "The server returned an unreadable response. Please refresh and try again."
          : `The server could not complete this request (${response.status}). Please try again or contact support.`
      );
    }
  }

  if (!response.ok) {
    throw new Error(messageFromPayload(payload) ?? `The request failed (${response.status}).`);
  }

  return payload as T;
}
