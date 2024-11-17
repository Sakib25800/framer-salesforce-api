import type { FramerFormData, ObjectRecord } from "../types";

export function generateRandomId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);

  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

export async function generateCodeChallenge(verifier: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64URLEncode(new Uint8Array(hash));
}

function base64URLEncode(buffer: Uint8Array) {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Transforms wbehook form data into literal or string literal values
 */
export function transformFormData<T extends boolean>(
  franerFormData: FramerFormData,
  literal: T,
): T extends true ? ObjectRecord : FramerFormData {
  const transformedData: Record<string, any> = { ...franerFormData };

  for (const [key, value] of Object.entries(franerFormData)) {
    if (value === "on") {
      transformedData[key] = literal ? true : "true";
    } else if (value === "off") {
      transformedData[key] = literal ? false : "false";
    } else if (!isNaN(Number(value))) {
      transformedData[key] = literal ? Number(value) : String(Number(value));
    }
  }

  return transformedData as T extends true ? ObjectRecord : FramerFormData;
}
