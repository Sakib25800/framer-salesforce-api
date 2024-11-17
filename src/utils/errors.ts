import { StatusCode } from "hono/utils/http-status";
import { AEError, SFError } from "../types";

export class APIError extends Error {
  constructor(
    message: string,
    public status: StatusCode = 400,
  ) {
    super(message);
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

export class SalesforceAPIError extends APIError {
  constructor(
    message: string,
    public salesforceErrors: SFError[],
    public status: StatusCode = 502,
  ) {
    super(message, status);
    Object.setPrototypeOf(this, SalesforceAPIError.prototype);
  }
}