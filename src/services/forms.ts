import { Context } from "hono";
import { salesforceRequest } from "../utils/salesforceRequest";
import { APIError, SalesforceAPIError } from "../utils/errors";
import type { ObjectRecord } from "../types";

interface ObjectResponse {
  id: string;
  errors: SalesforceAPIError[];
  success: boolean;
}

async function updateSalesforceObject(
  c: Context,
  objectName: string,
  recordId: string,
  recordData: Record<string, unknown>,
) {
  const updatedObjectRes = await salesforceRequest<ObjectResponse>(c, {
    path: `/sobjects/${objectName}/${recordId}`,
    method: "patch",
    body: recordData,
  });

  if (updatedObjectRes.ok) {
    return updatedObjectRes.data;
  }

  throw new SalesforceAPIError(
    `Failed to update object with id: '${recordId}'`,
    400,
    updatedObjectRes.errors,
  );
}

export async function upsertSalesforceObject(
  c: Context,
  objectName: string,
  recordData: ObjectRecord,
) {
  const newObjectRes = await salesforceRequest<ObjectResponse>(c, {
    path: `/sobjects/${objectName}`,
    method: "post",
    body: recordData,
  });

  if (newObjectRes.ok) {
    return newObjectRes.data;
  }

  const error = newObjectRes.errors[0];

  switch (error.errorCode) {
    case "DUPLICATES_DETECTED": {
      const recordId =
        error.duplicateResult?.matchResults[0].matchRecords[0].record.Id;

      if (!recordId) {
        throw new SalesforceAPIError(
          "Expected `recordId` for duplicate record error",
          400,
          newObjectRes.errors,
        );
      }

      return updateSalesforceObject(c, objectName, recordId, recordData);
    }
    default: {
      throw new SalesforceAPIError(
        "Failed to upsert object",
        400,
        newObjectRes.errors,
      );
    }
  }
}

export async function assertSalesforceObject(c: Context, objectName: string) {
  const res = await salesforceRequest(c, {
    path: `/sobjects/${objectName}/describe`,
    method: "GET",
  });

  if (!res.ok) {
    throw new SalesforceAPIError("Object does not exist", 400, res.errors);
  }
}

export async function forwardToAccountEngagementFormsHandler(
  handlerUrl: string,
  formData: Record<string, string>,
): Promise<string> {
  const urlEncodedData = new URLSearchParams(formData).toString();

  const res = await fetch(handlerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: urlEncodedData,
  });

  const resText = await res.text();

  if (!res.ok) {
    throw new APIError(
      `Failed to forward data to Account Engagement form handler`,
      502,
    );
  }

  return resText;
}
