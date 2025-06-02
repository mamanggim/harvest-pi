export function saveToLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadFromLocal(key, defaultValue = null) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : defaultValue;
}

export function removeFromLocal(key) {
  localStorage.removeItem(key);
}
