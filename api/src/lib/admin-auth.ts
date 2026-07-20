import type { FastifyReply, FastifyRequest } from "fastify";
import { normalizePhone } from "../services/verification.service.js";

function getAllowedAdminPhones(rawValue: string) {
  return rawValue
    .split(",")
    .map((entry) => normalizePhone(entry))
    .filter(Boolean);
}

export function getAuthenticatedAdminPhone(request: FastifyRequest) {
  const phoneHeader = request.headers["x-admin-phone"];
  return typeof phoneHeader === "string" ? normalizePhone(phoneHeader) : "";
}

export function requireAdminAccess(request: FastifyRequest, reply: FastifyReply) {
  const configuredAccessKey = request.server.config.ADMIN_ACCESS_KEY?.trim();
  const allowedPhones = getAllowedAdminPhones(request.server.config.ADMIN_PHONE_NUMBERS);

  if (!configuredAccessKey || !allowedPhones.length) {
    reply.status(503).send({
      error: "ADMIN_NOT_CONFIGURED",
    });
    return false;
  }

  const accessKeyHeader = request.headers["x-admin-key"];
  const adminPhone = getAuthenticatedAdminPhone(request);
  const adminKey = typeof accessKeyHeader === "string" ? accessKeyHeader.trim() : "";

  if (!adminPhone || !adminKey) {
    reply.status(401).send({
      error: "ADMIN_AUTH_REQUIRED",
    });
    return false;
  }

  if (!allowedPhones.includes(adminPhone) || adminKey !== configuredAccessKey) {
    reply.status(403).send({
      error: "ADMIN_AUTH_INVALID",
    });
    return false;
  }

  return true;
}
