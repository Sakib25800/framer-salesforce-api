import { Context } from "hono";
import { StatusCode } from "hono/utils/http-status";
import { APIError } from "../utils/errors";
import type { AppContext, SFError } from "../types";

const SF_CORE_API_VERSION = "v62.0";

interface RequestOptions {
  method?: string;
  query?: Record<string, string | number | string[]> | URLSearchParams;
  body?: any;
  headers?: Record<string, string>;
  path: string;
}

export interface SuccessResponse<SuccessData> {
  ok: true;
  data: SuccessData;
  errors: null;
  status: StatusCode;
}

export interface ErrorResponse<ErrorData> {
  ok: false;
  data: null;
  errors: ErrorData[];
  status: StatusCode;
}

export type BaseResponse<SuccessData, ErrorData> =
  | SuccessResponse<SuccessData>
  | ErrorResponse<ErrorData>;

export async function salesforceRequest<SuccessResponse>(
  c: Context<AppContext>,
  { path, method, query, body }: RequestOptions,
): Promise<BaseResponse<SuccessResponse, SFError>> {
  const userContext = c.get("user");
  if (!userContext) {
    throw new APIError("Unauthorized", 401);
  }

  const { accessToken, instanceUrl } = userContext;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const baseUrl = `${instanceUrl}/services/data/${SF_CORE_API_VERSION}${path}`;
  const url = new URL(baseUrl);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, value.toString());
      }
    });
  }

  const res = await fetch(url.toString(), {
    method: method?.toUpperCase() || "GET",
    body: body ? JSON.stringify(body) : undefined,
    headers,
  });

  let data;
  const rawText = await res.text();

  // Attempt to parse as JSON directly since some Salesforce endpoints
  // have incorrect Content-Type set
  try {
    data = JSON.parse(rawText);
  } catch {
    data = rawText;
  }

  if (res.ok) {
    return {
      ok: true,
      data: data as SuccessResponse,
      errors: null,
      status: res.status as StatusCode,
    };
  }

  return {
    ok: false,
    data: null,
    errors: Array.isArray(data) ? data : ([data] as SFError[]),
    status: res.status as StatusCode,
  };
}
