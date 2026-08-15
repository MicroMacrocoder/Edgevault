import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function readBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function getAuthenticatedUser(request: NextRequest) {
  const accessToken = readBearerToken(request);

  if (!accessToken) {
    return { user: null, error: "You must be signed in." };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    return {
      user: null,
      error: error?.message ?? "Your session could not be verified.",
    };
  }

  return { user: data.user, error: null };
}

function getCredentialKey() {
  const secret = process.env.MT5_CREDENTIAL_ENCRYPTION_KEY?.trim();

  if (!secret) {
    throw new Error("Missing MT5_CREDENTIAL_ENCRYPTION_KEY");
  }

  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptMt5Password(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getCredentialKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptMt5Password(payload: string) {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(":");

  if (
    version !== "v1" ||
    !ivValue ||
    !tagValue ||
    !encryptedValue
  ) {
    throw new Error("Invalid encrypted MT5 credential payload.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getCredentialKey(),
    Buffer.from(ivValue, "base64"),
  );

  decipher.setAuthTag(Buffer.from(tagValue, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function isAuthorizedMt5Worker(request: NextRequest) {
  const configured = process.env.MT5_WORKER_SECRET?.trim() ?? "";
  const supplied = request.headers.get("x-edgevault-mt5-worker-secret")?.trim() ?? "";

  if (!configured || !supplied) {
    return false;
  }

  const configuredBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);

  if (configuredBuffer.length !== suppliedBuffer.length) {
    return false;
  }

  return timingSafeEqual(configuredBuffer, suppliedBuffer);
}
