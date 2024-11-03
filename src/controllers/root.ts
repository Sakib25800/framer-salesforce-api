import { Hono } from "hono";
import type { Bindings } from "../types";

const router = new Hono<{ Bindings: Bindings }>();

router.get("/", (c) => {
  return c.text("✅ OAuth Worker is up and running!");
});

export { router as root };
