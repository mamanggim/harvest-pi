export function saveToLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadFromLocal(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    console.warn(`⚠️ Failed to parse localStorage key "${key}":`, e.message);
    return defaultValue;
  }
}

export function removeFromLocal(key) {
  localStorage.removeItem(key);
}
