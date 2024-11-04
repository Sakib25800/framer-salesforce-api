import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import * as v from "valibot";
import type {
  Bindings,
  FormConfig,
  SFObjectErrorResponse,
  SFObjectSuccessResponse,
  StoredToken,
} from "../types";
import { getAccessToken } from "../services/auth";
import { APIError } from "../utils/errors";
import { salesforceAuth } from "../middlewares/salesforceAuth";
import { StatusCode } from "hono/utils/http-status";

const router = new Hono<{ Bindings: Bindings }>();

router.post(
  "/create",
  vValidator("json", v.object({ objectApiName: v.string() })),
  salesforceAuth,
  async (c) => {
    const env = c.env;
    const { objectApiName } = c.req.valid("json");

    if (!objectApiName) {
      throw new APIError("Missing object parameter", 400);
    }

    const { orgId } = c.get("salesforce");

    const existingFormKey = `form:${orgId}:${objectApiName}`;
    const existingFormToken = await env.OAUTH_KV.get(existingFormKey);

    if (existingFormToken) {
      return c.json({
        webhookUrl: `${env.WORKER_URL}/forms/${existingFormToken}`,
      });
    }

    // Create a new form token and store the configuration
    const formToken = crypto.randomUUID();
    const formConfig: FormConfig = {
      orgId,
      objectApiName,
      createdAt: Date.now(),
    };

    // Save the form configuration in with the new form token
    await env.OAUTH_KV.put(`form:${formToken}`, JSON.stringify(formConfig));

    // Store the reference to this token for future lookups
    await env.OAUTH_KV.put(existingFormKey, formToken);

    return c.json({
      webhookUrl: `${env.WORKER_URL}/forms/${formToken}`,
    });
  },
);

router.post("/:formToken", vValidator("json", v.object({})), async (c) => {
  const env = c.env;
  const formToken = c.req.param("formToken");

  if (!formToken) {
    throw new APIError("Missing form token", 400);
  }

  // Get the form configuration from KV
  const storedConfig = await env.OAUTH_KV.get(`form:${formToken}`);
  if (!storedConfig) {
    throw new APIError("Invalid form token", 401);
  }

  const formConfig: FormConfig = JSON.parse(storedConfig);
  const { orgId, objectApiName } = formConfig;

  // Get stored minimal token data
  const storedTokens = await env.OAUTH_KV.get(`org:${orgId}`);
  if (!storedTokens) {
    throw new APIError("No authentication found for this org", 401);
  }

  const StoredToken: StoredToken = JSON.parse(storedTokens);

  // Get fresh access token
  const accessToken = await getAccessToken(env, StoredToken);
  if (!accessToken) {
    throw new APIError("Failed to get access token", 401);
  }

  // Get the form data
  const formData = await c.req.json();

  // Create object in Salesforce
  const response = await fetch(
    `${StoredToken.instance_url}/services/data/v62.0/sobjects/${objectApiName}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    },
  );

  const result: SFObjectSuccessResponse | SFObjectErrorResponse[] =
    await response.json();

  if (!response.ok) {
    const isDuplicateError =
      Array.isArray(result) &&
      result.length > 0 &&
      result[0].errorCode === "DUPLICATES_DETECTED";

    if (!isDuplicateError) {
      throw new APIError(
        "Failed to create Salesforce object",
        response.status as StatusCode,
      );
    }

    const recordId =
      result[0].duplicateResult?.matchResults[0]?.matchRecords[0]?.record?.Id;

    if (!recordId) {
      throw new APIError("No record Id found for duplicate object", 401);
    }

    // Update the existing record instead
    const updateResponse = await fetch(
      `${StoredToken.instance_url}/services/data/v62.0/sobjects/${object}/${recordId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      },
    );

    if (updateResponse.ok) {
      return c.json({
        id: recordId,
        success: true,
        updated: true,
        errors: [],
      });
    }
  }

  return c.json(result);
});

export { router as forms };
