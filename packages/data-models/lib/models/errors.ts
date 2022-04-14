/**
 * Main Error for the API containing a status code.
 */
export class APIError extends Error {
  /** HTTP status code of the error. */
  public statusCode: number;

  /**
   * APIError constructor.
   * @param statusCode HTTP status code of the error.
   */
  constructor(statusCode: number) {
    super('Error');
    this.name = 'APIError';
    this.message = `APIError with status ${statusCode}.`;
    this.statusCode = statusCode;
  }
}

/**
 * Error representing an object that doesn't exists.
 */
export class NotFoundError extends APIError {
  public modelType: string;

  /**
   * NotFoundError constructor.
   * @param modelType Type of the object that wasn't found.
   */
  constructor(modelType = 'Object') {
    super(404);
    this.name = 'NotFoundError';
    this.message = `${modelType} not found.`;
    this.modelType = modelType;
  }
}

/**
 * Error representing a malformed request.
 */
export class BadRequestError extends APIError {

  /**
   * BadRequestError constructor.
   * @param message Message explaining the error.
   */
  constructor(message: string) {
    super(400);
    this.name = 'BadRequestError';
    this.message = message;
  }
}

/**
 * Error representing an unauthorized request.
 */
export class ForbiddenError extends APIError {

  /**
   * ForbiddenError constructor.
   * @param message Message explaining the error.
   */
  constructor(message: string) {
    super(403);
    this.name = 'ForbiddenError';
    this.message = message;
  }
}
