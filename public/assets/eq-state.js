export const EQ_BANDS = Object.freeze([
  { label: '31 Hz', type: 'lowshelf', frequency: 31 },
  { label: '62 Hz', type: 'peaking', frequency: 62 },
  { label: '125 Hz', type: 'peaking', frequency: 125 },
  { label: '250 Hz', type: 'peaking', frequency: 250 },
  { label: '500 Hz', type: 'peaking', frequency: 500 },
  { label: '1 kHz', type: 'peaking', frequency: 1000 },
  { label: '2 kHz', type: 'peaking', frequency: 2000 },
  { label: '4 kHz', type: 'peaking', frequency: 4000 },
  { label: '8 kHz', type: 'peaking', frequency: 8000 },
  { label: '16 kHz', type: 'highshelf', frequency: 16000 }
].map(band => Object.freeze(band)));

export const EQ_PRESETS = Object.freeze({
  'Плоский': Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  'Бас': Object.freeze([5, 4, 3, 2, 1, 0, -1, -1, 0, 1]),
  'Рок': Object.freeze([3, 4, 3, 1, -1, 0, 2, 3, 4, 3]),
  'Поп': Object.freeze([1, 2, 2, 1, 0, 1, 2, 2, 1, 1]),
  'Вокал': Object.freeze([-3, -2, -1, 0, 1, 2, 3, 3, 2, 1]),
  'Тихий вечер': Object.freeze([2, 1, 0, 0, 1, 1, 0, -1, -1, -2])
});

const DEFAULT_GAINS = Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

export function normalizeEqGain(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const bounded = Math.max(-12, Math.min(12, number));
  return Math.round(bounded * 2) / 2;
}

export function normalizeEqSettings(value) {
  const saved = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  let gains = [...DEFAULT_GAINS];

  if (Array.isArray(saved.gains)) {
    if (saved.gains.length === 10) {
      gains = saved.gains.map(normalizeEqGain);
    } else if (saved.gains.length === 5) {
      const [low, lowMid, mid, highMid, high] = saved.gains;
      gains = [low, low, lowMid, lowMid, lowMid, mid, mid, highMid, high, high];
      gains = gains.map(normalizeEqGain);
    }
  }

  return {
    gains,
    enabled: saved.enabled !== false
  };
}

export function parseEqSettings(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return normalizeEqSettings(null);
  try {
    return normalizeEqSettings(JSON.parse(raw));
  } catch {
    return normalizeEqSettings(null);
  }
}

export function matchingEqPreset(gains) {
  if (!Array.isArray(gains) || gains.length !== EQ_BANDS.length) return 'custom';
  for (const [name, values] of Object.entries(EQ_PRESETS)) {
    if (values.every((value, index) => normalizeEqGain(gains[index]) === value)) return name;
  }
  return 'custom';
}
