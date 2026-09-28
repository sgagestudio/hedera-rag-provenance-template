export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends Error {
  constructor(message = "Write authorization required.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class CapacityError extends Error {
  constructor(message = "Too many provenance writes are already in progress.") {
    super(message);
    this.name = "CapacityError";
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "UpstreamError";
  }
}
