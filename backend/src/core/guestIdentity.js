// Single source of truth for guest identity. The backend owns generation;
// the frontend obtains guest credentials from the raid room create/join
// responses so the values used in the WebSocket join match what the
// backend originally issued.
export function generateGuestId() {
    return `guest-${crypto.randomUUID().slice(0, 8)}`;
}
export function generateGuestUsername() {
    return `Guest-${Math.floor(Math.random() * 900) + 100}`;
}
export function isGuestId(userId) {
    return userId.startsWith('guest-');
}
