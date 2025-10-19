import { dequal } from 'dequal';

const IGNORED_KEYS = new Set(['_id', '_key', '_rev', 'updatedAt', '_version', 'createdAt', 'deletedAt']);

export function generateDiff(oldObj, newObj) {
  const diff = {};
  if (!oldObj || !newObj) return diff;

  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    if (IGNORED_KEYS.has(key)) continue;

    const oldValue = oldObj[key];
    const newValue = newObj[key];

    if (!dequal(oldValue, newValue)) {
      diff[key] = { from: oldValue, to: newValue };
    }
  }
  return diff;
}