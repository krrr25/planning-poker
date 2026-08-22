type HttpLikeError = {
  error?: unknown;
  status?: number;
  message?: string;
};

function looksLikeHtml(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('<') || trimmed.includes('<!DOCTYPE');
}

function httpFailedMessage(status?: number): string {
  if (status === 0) {
    return 'Could not reach the server. Try again.';
  }
  if (status) {
    return `Request failed (${status}). Try again.`;
  }
  return 'Request failed. Try again.';
}

export function readApiError(err: unknown, fallback = 'Request failed. Try again.'): string {
  const error = err as HttpLikeError;

  if (error.error && typeof error.error === 'object' && error.error !== null && 'message' in error.error) {
    const message = String((error.error as { message: string }).message).trim();
    if (message && !looksLikeHtml(message)) {
      return message;
    }
  }

  if (typeof error.error === 'string') {
    const message = error.error.trim();
    if (message && !looksLikeHtml(message)) {
      return message;
    }
  }

  if (typeof error.message === 'string') {
    const message = error.message.trim();
    if (message.includes('Unexpected token') || looksLikeHtml(message)) {
      return httpFailedMessage(error.status);
    }
    if (message && !message.startsWith('Http failure response')) {
      return message;
    }
  }

  return httpFailedMessage(error.status) || fallback;
}
