import { Context, Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import * as v from "valibot";
import { authMiddleware } from "../middlewares/auth";
import { transformFormData } from "../utils/helpers";
import {
  forwardToAccountEngagementFormsHandler,
  assertSalesforceObject,
  upsertSalesforceObject,
} from "../services/forms";
import type { AppContext } from "../types";
import { fetchNewAccessToken } from "../services/auth";

const router = new Hono<AppContext>();

router.post(
  "/web/create",
  authMiddleware,
  vValidator("json", v.object({ objectName: v.string() })),
  async (c) => {
    const { objectName } = c.req.valid("json");
    const { userId } = c.get("user");
    const formToken = crypto.randomUUID();

    await assertSalesforceObject(c, objectName);
    await c.get("kv").webFormTokens.put({ formToken }, { objectName, userId });

    return c.json({
      webhook: `${c.env.WORKER_URL}/api/web/submit/${formToken}`,
    });
  },
);

router.post(
  "/submit/:formToken",
  vValidator("json", v.record(v.string(), v.string())),
  vValidator("param", v.object({ formToken: v.string() })),
  async (c) => {
    const { formToken } = c.req.valid("param");
    const formData = c.req.valid("json");

    const { objectName, userId } = await c
      .get("kv")
      .webFormTokens.getOrThrow({ formToken });
    const { orgId, instanceUrl, refreshToken } = await c
      .get("kv")
      .storedTokens.getOrThrow({ userId });

    const freshAccessToken = await fetchNewAccessToken(c.env, refreshToken);

    c.set("user", {
      accessToken: freshAccessToken,
      orgId: orgId,
      instanceUrl: instanceUrl,
      userId: userId,
    });

    const data = await upsertSalesforceObject(c, objectName, formData);

    return c.json(data, 201);
  },
);

router.post(
  "/account-engagement/forward",
  vValidator("json", v.record(v.string(), v.string())),
  vValidator("query", v.object({ handler: v.string() })),
  async (c) => {
    const { handler } = c.req.valid("query");
    const formData = transformFormData(c.req.valid("json"), false);

    // Convert booleans to 0/1
    Object.entries(formData).forEach(([key, value]) => {
      if (value === "true") {
        formData[key] = "1";
      }

      if (value === "false") {
        formData[key] = "0";
      }
    });

    const resText = await forwardToAccountEngagementFormsHandler(
      handler,
      formData,
    );

    return c.json(resText, 200);
  },
);

export { router as formsController };
