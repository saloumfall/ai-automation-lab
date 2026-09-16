export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "AIError";
  }
}

export class RateLimitError extends AIError {
  constructor(message = "Rate limit exceeded") {
    super(message, "RATE_LIMIT", true);
  }
}

export class TimeoutError extends AIError {
  constructor(message = "AI request timed out") {
    super(message, "TIMEOUT", true);
  }
}

export class APIError extends AIError {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message, "API_ERROR", status >= 500);
  }
}