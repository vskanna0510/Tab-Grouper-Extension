// Centralized message validation and types for safe runtime messaging.

export const MESSAGE_TYPES = {
  GET_STATE: "GET_STATE",
  UPDATE_PURPOSE: "UPDATE_PURPOSE",
  MARK_DONE: "MARK_DONE",
  CLEAR_ALL: "CLEAR_ALL"
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

