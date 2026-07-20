import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

const ACCESS_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

type AccessTokenPayload = {
  sub: string;
  iat: number;
  exp: number;
  iss: "choice-api";
  aud: "choice-app";
};

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signTokenPart(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function buildAccessTokenPayload(userId: string): AccessTokenPayload {
  const issuedAt = Math.floor(Date.now() / 1000);

  return {
    sub: userId,
    iat: issuedAt,
    exp: issuedAt + ACCESS_TOKEN_TTL_SECONDS,
    iss: "choice-api",
    aud: "choice-app",
  };
}

function verifySignedToken(unsignedToken: string, providedSignature: string, secret: string) {
  const expectedSignature = signTokenPart(unsignedToken, secret);
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(providedSignature, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function readBearerToken(request: FastifyRequest) {
  const authHeader = request.headers.authorization?.trim();

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  return token || null;
}

export function issueAccessToken(userId: string, secret: string) {
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify(buildAccessTokenPayload(userId)));
  const unsignedToken = `${header}.${payload}`;
  const signature = signTokenPart(unsignedToken, secret);

  return `${unsignedToken}.${signature}`;
}

export function verifyAccessToken(token: string, secret: string) {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    return null;
  }

  const unsignedToken = `${header}.${payload}`;

  if (!verifySignedToken(unsignedToken, signature, secret)) {
    return null;
  }

  try {
    const parsedPayload = JSON.parse(decodeBase64Url(payload)) as Partial<AccessTokenPayload>;

    if (
      parsedPayload.iss !== "choice-api"
      || parsedPayload.aud !== "choice-app"
      || typeof parsedPayload.sub !== "string"
      || !parsedPayload.sub.trim()
      || typeof parsedPayload.exp !== "number"
      || typeof parsedPayload.iat !== "number"
      || parsedPayload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return {
      userId: parsedPayload.sub,
      expiresAt: parsedPayload.exp,
    };
  } catch {
    return null;
  }
}

export function requireAuthenticatedUser(request: FastifyRequest, reply: FastifyReply) {
  const token = readBearerToken(request);

  if (!token) {
    reply.status(401).send({
      error: "AUTH_REQUIRED",
    });
    return null;
  }

  const verified = verifyAccessToken(token, request.server.config.JWT_ACCESS_SECRET);

  if (!verified) {
    reply.status(401).send({
      error: "AUTH_INVALID",
    });
    return null;
  }

  return verified.userId;
}

export function requireMatchingAuthenticatedUser(
  request: FastifyRequest,
  reply: FastifyReply,
  targetUserId: string,
) {
  const authenticatedUserId = requireAuthenticatedUser(request, reply);

  if (!authenticatedUserId) {
    return null;
  }

  if (authenticatedUserId !== targetUserId) {
    reply.status(403).send({
      error: "AUTH_FORBIDDEN",
    });
    return null;
  }

  return authenticatedUserId;
}
