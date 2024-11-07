import { cors } from "hono/cors";
import { Bindings } from "../types";
export const corsMiddleware = (env: Bindings) => {
  return cors({
    origin: (origin) => {
      if (!origin)
        return `https://${env.PLUGIN_ID}.${env.PLUGIN_PARENT_DOMAIN}`;

      const originURL = new URL(origin);
      if (originURL.hostname === "localhost" || origin === "https://salesforce-plugin.pages.dev") {
        return origin;
      }

      const [hostLabel, ...parentDomainLabels] = originURL.hostname.split(".");
      if (
        parentDomainLabels.join(".") === env.PLUGIN_PARENT_DOMAIN &&
        hostLabel.startsWith(env.PLUGIN_ID)
      ) {
        return origin;
      }

      return `https://${env.PLUGIN_ID}.${env.PLUGIN_PARENT_DOMAIN}`;
    },
  });
};
