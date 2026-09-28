class NamedError extends Error {
  constructor(name: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = name;
  }
}

export class ValidationError extends NamedError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("ValidationError", message, options);
  }
}

export class AuthenticationError extends NamedError {
  constructor(message = "Write authorization required.", options?: { cause?: unknown }) {
    super("AuthenticationError", message, options);
  }
}

export class CapacityError extends NamedError {
  constructor(message = "Too many provenance writes are already in progress.", options?: { cause?: unknown }) {
    super("CapacityError", message, options);
  }
}

export class ConfigurationError extends NamedError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("ConfigurationError", message, options);
  }
}

export class UpstreamError extends NamedError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("UpstreamError", message, options);
  }
}
