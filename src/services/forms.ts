import { Bindings } from "hono/types";

export async function verifySalesforceObject(
  objectName: string,
  accessToken: string,
  instanceUrl: string,
): Promise<boolean> {
  const response = await fetch(
    `${instanceUrl}/services/data/v62.0/sobjects/${objectName}/describe`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  return response.ok;
}
