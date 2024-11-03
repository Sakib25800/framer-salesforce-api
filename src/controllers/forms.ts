import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import * as v from "valibot";
import type {
  Bindings,
  FormConfig,
  ObjectErrorResponse,
  ObjectSuccessResponse,
  StoredToken,
} from "../types";
import { getAccessToken } from "../services/auth";
import { APIError } from "../utils/errors";

const router = new Hono<{ Bindings: Bindings }>();

router.post(
  "/create",
  vValidator(
    "json",
    v.object({
      orgId: v.string(),
      objectType: v.string(),
    }),
  ),
  async (c) => {
    const env = c.env;
    const { orgId, objectType } = c.req.valid("json");

    // Verify org exists and is authenticated
    const storedTokens = await env.OAUTH_KV.get(`org:${orgId}`);
    if (!storedTokens) {
      return c.json({ error: "No authentication found for this org" }, 401);
    }

    // Generate secure form token
    const formToken = crypto.randomUUID();

    // Store form configuration
    const formConfig: FormConfig = {
      orgId,
      objectType,
      createdAt: Date.now(),
    };

    await env.OAUTH_KV.put(`form:${formToken}`, JSON.stringify(formConfig));

    return c.json({
      formToken,
      webhookUrl: `${env.WORKER_URL}/forms/${formToken}`,
    });
  },
);

router.post("/:formToken", async (c) => {
  const env = c.env;
  const formToken = c.req.param("formToken");

  if (!formToken) {
    return c.json({ error: "Missing form token" }, 400);
  }

  // Get the form configuration from KV
  const storedConfig = await env.OAUTH_KV.get(`form:${formToken}`);
  if (!storedConfig) {
    return c.json({ error: "Invalid form token" }, 401);
  }

  const formConfig: FormConfig = JSON.parse(storedConfig);
  const { orgId, objectType } = formConfig;

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
    `${StoredToken.instance_url}/services/data/v62.0/sobjects/${objectType}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    },
  );

  const result: ObjectSuccessResponse | ObjectErrorResponse[] =
    await response.json();

  if (!response.ok) {
    const isDuplicateError =
      Array.isArray(result) &&
      result.length > 0 &&
      result[0].errorCode === "DUPLICATES_DETECTED";

    if (!isDuplicateError) {
      throw new Error("Something went wrong");
    }

    const recordId =
      result[0].duplicateResult?.matchResults[0]?.matchRecords[0]?.record?.Id;

    if (!recordId) {
      throw new APIError("No record Id found for duplicate object", 401);
    }

    // Update the existing record instead
    const updateResponse = await fetch(
      `${StoredToken.instance_url}/services/data/v62.0/sobjects/${objectType}/${recordId}`,
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
