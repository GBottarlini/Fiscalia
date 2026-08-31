const storedValues = new Map();
const localStorage = {
  clear() {
    storedValues.clear();
  },
  getItem(key) {
    return storedValues.get(String(key)) ?? null;
  },
  removeItem(key) {
    storedValues.delete(String(key));
  },
  setItem(key, value) {
    storedValues.set(String(key), String(value));
  },
};

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: localStorage,
});
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: localStorage,
});
