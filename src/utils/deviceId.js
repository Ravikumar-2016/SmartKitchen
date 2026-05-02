export function formatDeviceId(id) {
  return String(id ?? '').replace(/[:-]/g, '').trim().toUpperCase()
}

export function requireFormattedDeviceId(id) {
  const formatted = formatDeviceId(id)
  if (!formatted) {
    throw new Error('device_id is required.')
  }
  return formatted
}
