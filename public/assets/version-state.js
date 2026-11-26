const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseStableVersion(value) {
  const raw = String(value ?? '').trim();
  const normalized = /^v(?=\d)/i.test(raw) ? raw.slice(1) : raw;
  const match = STABLE_VERSION_PATTERN.exec(normalized);

  if (!match) {
    throw new TypeError('Expected a stable MAJOR.MINOR.PATCH version without leading zeroes.');
  }

  const parts = match.slice(1).map(Number);
  if (parts.some(part => !Number.isSafeInteger(part))) {
    throw new TypeError('Version components must be safe integers.');
  }

  return parts;
}

export function compareStableVersions(left, right) {
  const a = Array.isArray(left) ? left : parseStableVersion(left);
  const b = Array.isArray(right) ? right : parseStableVersion(right);

  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }

  return 0;
}
