import { createSign } from "node:crypto";

interface ServiceAccountCreds {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface FcmBroadcastResult {
  configured: boolean;
  sent: number;
  failed: number;
  invalidTokens: string[];
  error?: string;
}

function parseServiceAccount(raw?: string): ServiceAccountCreds | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw.trim()) as Partial<ServiceAccountCreds>;
    if (
      typeof parsed.project_id === "string" &&
      parsed.project_id.trim() &&
      typeof parsed.client_email === "string" &&
      parsed.client_email.trim() &&
      typeof parsed.private_key === "string" &&
      parsed.private_key.includes("BEGIN")
    ) {
      return {
        project_id: parsed.project_id.trim(),
        client_email: parsed.client_email.trim(),
        private_key: parsed.private_key.replace(/\\n/g, "\n"),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function isFcmConfigured(): boolean {
  return parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) !== null;
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function fetchGoogleAccessToken(creds: ServiceAccountCreds): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = base64Url(signer.sign(creds.private_key));
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OAuth token exchange failed (${res.status}): ${errText}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Missing access_token from Google OAuth");
  return json.access_token;
}

export async function sendFcmBroadcast(
  tokens: string[],
  title: string,
  body: string
): Promise<FcmBroadcastResult> {
  const creds = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!creds) {
    return {
      configured: false,
      sent: 0,
      failed: tokens.length,
      invalidTokens: [],
      error: "Chưa cấu hình biến môi trường FIREBASE_SERVICE_ACCOUNT_JSON trên Vercel.",
    };
  }

  if (tokens.length === 0) {
    return { configured: true, sent: 0, failed: 0, invalidTokens: [] };
  }

  const accessToken = await fetchGoogleAccessToken(creds);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${creds.project_id}/messages:send`;

  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  for (const token of tokens) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            android: {
              priority: "HIGH",
              notification: { sound: "default", channel_id: "speakit_announcements" },
            },
          },
        }),
      });

      if (res.ok) {
        sent += 1;
      } else {
        failed += 1;
        const errText = await res.text().catch(() => "");
        if (errText.includes("UNREGISTERED") || errText.includes("INVALID_ARGUMENT")) {
          invalidTokens.push(token);
        }
      }
    } catch {
      failed += 1;
    }
  }

  return { configured: true, sent, failed, invalidTokens };
}
