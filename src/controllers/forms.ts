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
import { verifySalesforceObject } from "../services/forms";

const router = new Hono<{ Bindings: Bindings }>();

router.post(
  "/web/create",
  vValidator("json", v.object({ objectName: v.string() })),
  salesforceAuth,
  async (c) => {
    const env = c.env;
    const { objectName } = c.req.valid("json");

    if (!objectName) {
      throw new APIError("Missing object parameter", 400);
    }

    const { orgId } = c.get("salesforce");

    const existingFormKey = `${orgId}:${objectName}`;
    const existingFormToken = await env.FORM_TOKENS_KV.get(existingFormKey);

    if (existingFormToken) {
      return c.json({
        webhookUrl: `${env.WORKER_URL}/forms/${existingFormToken}`,
      });
    }

    // Create a new form token and store the configuration
    const formToken = crypto.randomUUID();
    const formConfig: FormConfig = {
      orgId,
      objectName,
      createdAt: Date.now(),
    };

    // Save the form configuration in with the new form token
    await env.FORM_TOKENS_KV.put(`${formToken}`, JSON.stringify(formConfig));

    // Store the reference to this token for future lookups
    await env.FORM_TOKENS_KV.put(existingFormKey, formToken);

    return c.json({
      webhookUrl: `${env.WORKER_URL}/forms/web/${formToken}`,
    });
  },
);

router.post("/web/:formToken", vValidator("json", v.object({})), async (c) => {
  const env = c.env;
  const formToken = c.req.param("formToken");

  if (!formToken) {
    throw new APIError("Missing form token", 400);
  }

  // Get the form configuration from KV
  const storedConfig = await env.FORM_TOKENS_KV.get(formToken);
  if (!storedConfig) {
    throw new APIError("Invalid form token", 401);
  }

  const formConfig: FormConfig = JSON.parse(storedConfig);
  const { orgId, objectName } = formConfig;

  // Get stored minimal token data
  const storedTokens = await env.ORG_KV.get(`org:${orgId}`);
  if (!storedTokens) {
    throw new APIError("No authentication found for this org", 401);
  }

  const storedToken: StoredToken = JSON.parse(storedTokens);

  // Get fresh access token
  const accessToken = await getAccessToken(env, storedToken);
  if (!accessToken) {
    throw new APIError("Failed to get access token", 401);
  }

  const objectExists = await verifySalesforceObject(
    objectName,
    accessToken,
    storedToken.instance_url,
  );
  if (!objectExists) {
    throw new APIError("Invalid Salesforce object", 400);
  }

  // Get the form data
  const formData = await c.req.json();

  // Transform "on" and "off" values to boolean
  Object.keys(formData).forEach((key) => {
    if (formData[key] === "on") formData[key] = true;
    else if (formData[key] === "off") formData[key] = false;
  });

  // Create object in Salesforce
  const response = await fetch(
    `${storedToken.instance_url}/services/data/v62.0/sobjects/${objectName}`,
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
      Array.isArray(result) && result[0].errorCode === "DUPLICATES_DETECTED";

    if (!isDuplicateError) {
      throw new APIError(
        Array.isArray(result)
          ? result[0].message
          : "Failed to create Salesforce Object",
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
      `${storedToken.instance_url}/services/data/v62.0/sobjects/${objectName}/${recordId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      },
    );

    if (!updateResponse.ok) {
      const errorData: SFObjectErrorResponse[] = await updateResponse.json();
      return c.json(errorData, 502);
    }

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

router.post(
  "/account-engagement/forward",
  vValidator("json", v.object({})),
  async (c) => {
    const handlerUrl = c.req.query("handler");

    if (!handlerUrl) {
      throw new APIError("Missing handler URL", 400);
    }

    const framerFormData = await c.req.json();

    // Transform "on" and "off" values to boolean
    Object.keys(framerFormData).forEach((key) => {
      if (framerFormData[key] === "on") framerFormData[key] = true;
      else if (framerFormData[key] === "off") framerFormData[key] = false;
    });

    const urlEncodedData = new URLSearchParams(framerFormData).toString();

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
        `Failed to forward data: ${resText || res.statusText}`,
        res.status as StatusCode,
      );
    }

    return c.text(resText);
  },
);

export { router as forms };
