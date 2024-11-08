import { Hono } from "hono";
import { auth } from "./controllers/auth";
import { forms } from "./controllers/forms";
import { corsMiddleware } from "./middlewares/cors";
import { root } from "./controllers/root";
import { APIError } from "./utils/errors";

import type { Bindings } from "./types";

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => corsMiddleware(c.env)(c, next));

app.route("/", root);
app.route("/auth", auth);
app.route("/forms", forms);

app.onError((err, c) => {
  console.error(err);
  if (err instanceof APIError) {
    return c.json({ error: { message: err.message } }, err.status);
  }

  return c.json({ error: { message: "Internal server error" } }, 500);
});

app.notFound((c) => {
  return c.text("Page not found", 404);
});

export default app;
