const SENSITIVE_KEYWORDS = ['password', 'token', 'secret', 'apikey', 'authorization'];

export function redactSensitiveFields(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  const newObj = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (typeof key === 'string' && SENSITIVE_KEYWORDS.some(keyword => key.toLowerCase().includes(keyword))) {
        newObj[key] = '[REDACTED]';
      } else {
        newObj[key] = obj[key];
      }
    }
  }
  return newObj;
}


export function shallowCloneAndTruncate(obj, maxStringLength = 512) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.slice(0, 50).map(item => shallowCloneAndTruncate(item, maxStringLength));
  }
  const newObj = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'string') {
        newObj[key] = value.substring(0, maxStringLength);
      } else if (typeof value !== 'function') {
        newObj[key] = value;
      }
    }
  }
  return newObj;
}
