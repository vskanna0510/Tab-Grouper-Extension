// Centralized message validation and types for safe runtime messaging.

export const MESSAGE_TYPES = {
  GET_STATE: "GET_STATE",
  UPDATE_PURPOSE: "UPDATE_PURPOSE",
  MARK_DONE: "MARK_DONE",
  CLEAR_ALL: "CLEAR_ALL",
  GET_SESSIONS: "GET_SESSIONS",
  SAVE_SESSION: "SAVE_SESSION",
  RESTORE_SESSION: "RESTORE_SESSION",
  DELETE_SESSION: "DELETE_SESSION"
};

export function isValidMessage(request) {
  if (!request || typeof request !== "object") return false;
  const { type } = request;
  if (typeof type !== "string") return false;
  return Object.values(MESSAGE_TYPES).includes(type);
}

export function validateUpdatePurposePayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const tabId = Number(payload.tabId);
  if (!Number.isFinite(tabId)) return null;
  const purpose =
    typeof payload.purpose === "string" ? payload.purpose : "";
  return { tabId, purpose };
}

export function validateMarkDonePayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const tabId = Number(payload.tabId);
  if (!Number.isFinite(tabId)) return null;
  return { tabId };
}

export function validateSaveSessionPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  return name.length > 0 ? { name } : null;
}

export function validateRestoreSessionPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
  return sessionId.length > 0 ? { sessionId } : null;
}

export function validateDeleteSessionPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
  return sessionId.length > 0 ? { sessionId } : null;
}

