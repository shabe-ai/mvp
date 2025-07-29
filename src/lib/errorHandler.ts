import { NextResponse } from 'next/server';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  statusCode: number;
}

export class ValidationError extends Error {
  public code: string;
  public statusCode: number;
  public details?: unknown;

  constructor(message: string, code = 'VALIDATION_ERROR', details?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.statusCode = 400;
    this.details = details;
  }
}

export class AuthenticationError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
    this.code = 'AUTHENTICATION_ERROR';
    this.statusCode = 401;
  }
}

export class AuthorizationError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
    this.code = 'AUTHORIZATION_ERROR';
    this.statusCode = 403;
  }
}

export class NotFoundError extends Error {
  public code: string;
  public statusCode: number;

  constructor(resource = 'Resource') {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
    this.code = 'NOT_FOUND';
    this.statusCode = 404;
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  // Handle known error types
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode }
    );
  }

  // Handle unknown errors
  const errorMessage = error instanceof Error ? error.message : 'Internal server error';
  
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: errorMessage,
      },
    },
    { status: 500 }
  );
}

export function validateRequiredFields(data: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      throw new ValidationError(`Missing required field: ${field}`, 'MISSING_FIELD', { field });
    }
  }
}

export function validateStringField(value: unknown, fieldName: string, maxLength?: number): void {
  if (value !== undefined && value !== null) {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, 'INVALID_TYPE', { field: fieldName, expected: 'string' });
    }
    if (maxLength && value.length > maxLength) {
      throw new ValidationError(`${fieldName} must be ${maxLength} characters or less`, 'TOO_LONG', { field: fieldName, maxLength });
    }
  }
}

export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format', 'INVALID_EMAIL', { email });
  }
}

export function validateId(id: string, resourceName: string): void {
  if (!id || typeof id !== 'string' || id.length !== 24) {
    throw new ValidationError(`Invalid ${resourceName} ID format`, 'INVALID_ID', { id, resourceName });
  }
} 