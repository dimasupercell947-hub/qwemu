const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseStableVersion(value) {
  const raw = String(value ?? '').trim();
  const normalized = /^v(?=\d)/i.test(raw) ? raw.slice(1) : raw;
  const match = STABLE_VERSION_PATTERN.exec(normalized);
  if (!match) {
    throw new TypeError('Ожидается стабильная версия MAJOR.MINOR.PATCH без ведущих нулей.');
  }
  const parts = match.slice(1).map(Number);
  if (parts.some(part => !Number.isSafeInteger(part))) {
    throw new TypeError('Компоненты версии должны быть безопасными целыми числами.');
  }
  return parts;
}

export function compareStableVersions(left, right) {
  const a = Array.isArray(left) ? left : parseStableVersion(left);
  const b = Array.isArray(right) ? right : parseStableVersion(right);
  if (a.length !== 3 || b.length !== 3) throw new TypeError('Для сравнения нужны три компонента версии.');
  for (let index = 0; index < 3; index += 1) {
    if (!Number.isSafeInteger(a[index]) || !Number.isSafeInteger(b[index]) || a[index] < 0 || b[index] < 0) {
      throw new TypeError('Компоненты версии должны быть неотрицательными безопасными целыми числами.');
    }
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}
