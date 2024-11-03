import { StatusCode } from "hono/utils/http-status";

export class APIError extends Error {
  constructor(
    message: string,
    public status: StatusCode = 400,
  ) {
    super(message);
  }
}
