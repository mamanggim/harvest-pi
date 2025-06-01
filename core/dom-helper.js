export function addSafeClickListener(element, callback) {
  let isLocked = false;
  const handler = (e) => {
    if (isLocked) return;
    isLocked = true;
    callback(e);
    setTimeout(() => isLocked = false, 300);
  };
  element.addEventListener('click', handler);
  element.addEventListener('touchstart', handler);
}
