import { Hono } from "hono";
import { logger } from "hono/logger";
import { ValiError } from "valibot";

import {
  AccountEngagementAPIError,
  APIError,
  SalesforceAPIError,
} from "./utils/errors";

import { corsMiddleware, kvMiddleware } from "./middlewares";
import { rootController, authController, formsController } from "./controllers";

import type { AppContext } from "./types";

const app = new Hono<AppContext>();

app.use(logger());
app.use("*", corsMiddleware);
app.use("*", kvMiddleware);

app.route("/", rootController);
app.route("/auth", authController);
app.route("/api/forms", formsController);

app.onError((e, c) => {
  if (e instanceof SalesforceAPIError) {
    return c.json(
      {
        error: { message: e.message },
        details: e.salesforceErrors,
      },
      e.status,
    );
  }

  if (e instanceof APIError) {
    return c.json({ error: { message: e.message } }, e.status);
  }

  if (e instanceof ValiError) {
    return c.json(e, 400);
  }

  return c.json({ error: { message: "Internal server error" } }, 500);
});

app.notFound((c) => {
  return c.text("Not found", 404);
});

export default app;
