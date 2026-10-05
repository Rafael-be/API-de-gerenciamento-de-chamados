export type ErrorDetails = Record<string, unknown>;

export class AppError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly isOperational: boolean;
  public readonly details?: ErrorDetails;

  constructor(code: string, message: string, httpStatus = 500, details?: ErrorDetails) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.isOperational = true;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthError extends AppError {
  constructor(code: string, message: string, details?: ErrorDetails) {
    super(code, message, 401, details);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends AppError {
  constructor(code: string, message: string, details?: ErrorDetails) {
    super(code, message, 403, details);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(code: string, message: string, details?: ErrorDetails) {
    super(code, message, 404, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string, details?: ErrorDetails) {
    super(code, message, 409, details);
    this.name = 'ConflictError';
  }
}

export class UnprocessableError extends AppError {
  constructor(code: string, message: string, details?: ErrorDetails) {
    super(code, message, 422, details);
    this.name = 'UnprocessableError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, retryAfter: number) {
    super('RATE_LIMITED', message, 429, { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super('DATABASE_UNAVAILABLE', message, 503, details);
    this.name = 'DatabaseError';
  }
}

export function createAppError(code: string, message: string, httpStatus: number, details?: ErrorDetails): AppError {
  return new AppError(code, message, httpStatus, details);
}
