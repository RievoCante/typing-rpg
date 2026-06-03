// Consistent JSON error shape
export function jsonError(c, status, message, details) {
    return c.json({ success: false, error: message, details }, status);
}
