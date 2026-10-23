// The header's menu button (phones / tablets) and the sidebar drawer talk through this event.
export const NAV_TOGGLE_EVENT = 'admin:nav-toggle'

export function toggleAdminNav() {
  window.dispatchEvent(new Event(NAV_TOGGLE_EVENT))
}
