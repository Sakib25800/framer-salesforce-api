import { Hono } from "hono";
import type { AppContext } from "../types/context";

const router = new Hono<AppContext>();

router.get("/", (c) => {
  return c.redirect("https://framer.com");
});

export { router as rootController };
