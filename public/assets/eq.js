import { EQ_BANDS, EQ_PRESETS, calculateEqHeadroomGain, matchingEqPreset, normalizeEqGain, parseEqSettings } from './eq-state.js';

(() => {
  'use strict';

  const audio = document.querySelector('#audio');
  const transport = document.querySelector('.transport');
  const volume = document.querySelector('.volume-control');
  if (!audio || !transport || !volume || window.__QWEMU_EQ__) return;
  window.__QWEMU_EQ__ = true;

  const storageKey = 'qwemu.eq.v1';
  const readSavedSettings = () => {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  };

  const restored = parseEqSettings(readSavedSettings());
  let gains = restored.gains;
  let enabled = restored.enabled;
  let audioContext = null;
  let filters = [];
  let preGain = null;
  let analyser = null;
  let analyserData = null;
  let visualizerGradient = null;
  let animationFrame = 0;

  const prefersReducedMotion = () => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    return document.documentElement.classList.contains('reduce-motion') || Boolean(mediaQuery?.matches);
  };

  function saveSettings() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 2, gains, enabled }));
    } catch {
      status.textContent = 'Не удалось сохранить настройки';
    }
  }

  function updateHeadroom() {
    if (!audioContext || !preGain || filters.length !== EQ_BANDS.length) return;

    try {
      const nyquist = audioContext.sampleRate / 2;
      const maxFrequency = Math.min(20000, nyquist * 0.98);
      const minFrequency = Math.min(10, maxFrequency * 0.5);
      const pointCount = 1024;
      const frequencies = new Float32Array(pointCount);
      const combinedMagnitude = new Float32Array(pointCount);
      const filterMagnitude = new Float32Array(pointCount);
      const phase = new Float32Array(pointCount);

      for (let index = 0; index < pointCount; index += 1) {
        const progress = index / (pointCount - 1);
        frequencies[index] = minFrequency * (maxFrequency / minFrequency) ** progress;
        combinedMagnitude[index] = 1;
      }

      for (const filter of filters) {
        filter.getFrequencyResponse(frequencies, filterMagnitude, phase);
        for (let index = 0; index < pointCount; index += 1) {
          const response = filterMagnitude[index];
          if (Number.isFinite(response) && response >= 0) {
            combinedMagnitude[index] *= response;
          }
        }
      }

      const targetGain = enabled ? calculateEqHeadroomGain(combinedMagnitude, 0.9) : 1;
      preGain.gain.setTargetAtTime(targetGain, audioContext.currentTime, 0.025);
    } catch {
      const maximumBoost = Math.max(0, ...gains);
      const fallbackGain = enabled ? 0.9 * 10 ** (-maximumBoost / 20) : 1;
      preGain.gain.setTargetAtTime(fallbackGain, audioContext.currentTime, 0.025);
    }
  }

  function applySettings() {
    const now = audioContext?.currentTime ?? 0;
    filters.forEach((filter, index) => {
      const target = enabled ? gains[index] : 0;
      filter.gain.value = target;
    });

    updateHeadroom();
    toggle.textContent = enabled ? 'Включён' : 'Выключен';
    toggle.classList.toggle('on', enabled);
    toggle.setAttribute('aria-pressed', String(enabled));
    status.textContent = enabled ? 'EQ активен' : 'EQ отключён';
    saveSettings();
  }

  function createAudioGraph() {
    if (audioContext) return true;

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) throw new Error('Web Audio API недоступен в этом WebView');

    const context = new AudioContextConstructor();
    try {
      const source = context.createMediaElementSource(audio);
      const gainNode = context.createGain();
      const nextFilters = EQ_BANDS.map(band => {
        const filter = context.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.value = band.frequency;
        if (band.type === 'peaking') filter.Q.value = 1;
        return filter;
      });
      const meter = context.createAnalyser();
      meter.fftSize = 256;
      meter.smoothingTimeConstant = 0.82;

      source.connect(gainNode);
      gainNode.connect(nextFilters[0]);
      nextFilters.forEach((filter, index) => {
        filter.connect(nextFilters[index + 1] || meter);
      });
      meter.connect(context.destination);

      audioContext = context;
      preGain = gainNode;
      filters = nextFilters;
      analyser = meter;
      analyserData = new Uint8Array(meter.frequencyBinCount);
      applySettings();
      return true;
    } catch (error) {
      context.close().catch(() => {});
      throw error;
    }
  }

  function initializeAudio() {
    try {
      createAudioGraph();
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(error => {
          status.textContent = error?.message || 'Не удалось активировать аудиоконтекст';
        });
      }
      return true;
    } catch (error) {
      status.textContent = error?.message || 'Не удалось включить эквалайзер';
      return false;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'qwemu-wave';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Визуализация звучания');
  transport.insertBefore(canvas, transport.querySelector('.transport-buttons'));
  const canvasContext = canvas.getContext('2d');

  function resizeCanvas() {
    if (!canvasContext) return;
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
    canvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
    canvasContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    visualizerGradient = canvasContext.createLinearGradient(0, 0, 0, rect.height);
    visualizerGradient.addColorStop(0, '#f3a05a');
    visualizerGradient.addColorStop(1, '#df4c49');
  }

  resizeCanvas();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resizeCanvas).observe(canvas);
  } else {
    window.addEventListener('resize', resizeCanvas, { passive: true });
  }

  function drawVisualizer() {
    if (!canvasContext) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    canvasContext.clearRect(0, 0, width, height);

    let frequencyData = null;
    if (analyser && !audio.paused && !audio.ended) {
      frequencyData = analyserData;
      analyser.getByteFrequencyData(frequencyData);
    }

    const barCount = 40;
    const gap = 2.1;
    const barWidth = Math.max(1, (width - (barCount - 1) * gap) / barCount);

    for (let index = 0; index < barCount; index += 1) {
      let amplitude = frequencyData
        ? Math.max(0.06, frequencyData[Math.floor(index / barCount * frequencyData.length)] / 255)
        : 0.055;

      if (frequencyData && !prefersReducedMotion()) {
        amplitude *= 1 + Math.sin(performance.now() / 320 + index * 0.55) * 0.14;
      }

      const barHeight = Math.max(2, amplitude * height * 0.82);
      const y = (height - barHeight) / 2;
      const x = index * (barWidth + gap);
      canvasContext.fillStyle = visualizerGradient || '#e56d4b';
      canvasContext.beginPath();
      if (typeof canvasContext.roundRect === 'function') {
        canvasContext.roundRect(x, y, barWidth, barHeight, Math.min(barWidth / 2, 3));
      } else {
        canvasContext.rect(x, y, barWidth, barHeight);
      }
      canvasContext.fill();
    }

    if (frequencyData && !prefersReducedMotion()) {
      animationFrame = requestAnimationFrame(drawVisualizer);
    } else {
      animationFrame = 0;
    }
  }

  function startVisualizer() {
    if (!animationFrame) drawVisualizer();
  }

  function stopVisualizer() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    drawVisualizer();
  }

  audio.addEventListener('play', () => {
    if (initializeAudio()) startVisualizer();
  });
  audio.addEventListener('pause', stopVisualizer);
  audio.addEventListener('ended', stopVisualizer);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopVisualizer();
    else if (!audio.paused) startVisualizer();
  });

  const openButton = document.createElement('button');
  openButton.className = 'eq-open-button';
  openButton.type = 'button';
  openButton.title = 'Эквалайзер';
  openButton.setAttribute('aria-label', 'Открыть эквалайзер');
  openButton.setAttribute('aria-expanded', 'false');
  openButton.innerHTML = '<span aria-hidden="true">▥</span> EQ';
  volume.insertBefore(openButton, volume.firstChild);

  const panel = document.createElement('section');
  panel.className = 'eq-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Настройки десятиполосного эквалайзера');
  panel.innerHTML = '<header class="eq-header"><div><div class="eq-overline">QWEMU AUDIO LAB</div><h2>Эквалайзер</h2></div><button class="eq-close" type="button" aria-label="Закрыть">×</button></header><div class="eq-presets"><select class="eq-preset" aria-label="Пресет"></select><button class="eq-reset" type="button">Сброс</button></div><div class="eq-bands"></div><footer class="eq-footer"><span class="eq-status">Готов</span><button class="eq-toggle" type="button" aria-pressed="true">Включён</button></footer>';
  document.body.append(panel);

  const toggle = panel.querySelector('.eq-toggle');
  const status = panel.querySelector('.eq-status');
  const presetSelect = panel.querySelector('.eq-preset');
  const bandsHolder = panel.querySelector('.eq-bands');

  const customOption = document.createElement('option');
  customOption.value = 'custom';
  customOption.textContent = 'Свои настройки';
  customOption.disabled = true;
  presetSelect.append(customOption);

  Object.keys(EQ_PRESETS).forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    presetSelect.append(option);
  });
  presetSelect.value = matchingEqPreset(gains);

  const bandInputs = EQ_BANDS.map((band, index) => {
    const label = document.createElement('label');
    label.className = 'eq-band';
    label.innerHTML = '<span class="eq-val"></span><input type="range" min="-12" max="12" step="0.5" aria-label="' + band.label + ' gain"><span class="eq-name">' + band.label + '</span>';

    const input = label.querySelector('input');
    const valueLabel = label.querySelector('.eq-val');
    input.value = String(gains[index]);
    valueLabel.textContent = (gains[index] > 0 ? '+' : '') + gains[index] + ' dB';

    input.addEventListener('input', () => {
      gains[index] = normalizeEqGain(input.value);
      valueLabel.textContent = (gains[index] > 0 ? '+' : '') + gains[index] + ' dB';
      presetSelect.value = matchingEqPreset(gains);
      if (initializeAudio()) applySettings();
      else saveSettings();
    });

    bandsHolder.append(label);
    return input;
  });

  function syncBandInputs() {
    bandInputs.forEach((input, index) => {
      input.value = String(gains[index]);
      input.previousElementSibling.textContent = (gains[index] > 0 ? '+' : '') + gains[index] + ' dB';
    });
    presetSelect.value = matchingEqPreset(gains);
  }

  presetSelect.addEventListener('change', () => {
    const preset = EQ_PRESETS[presetSelect.value];
    if (!preset) return;
    gains = [...preset];
    syncBandInputs();
    if (initializeAudio()) applySettings();
    else saveSettings();
  });

  panel.querySelector('.eq-reset').addEventListener('click', () => {
    gains = [...EQ_PRESETS['Плоский']];
    syncBandInputs();
    if (initializeAudio()) applySettings();
    else saveSettings();
  });

  toggle.addEventListener('click', () => {
    if (!initializeAudio()) return;
    enabled = !enabled;
    applySettings();
  });

  function closePanel() {
    panel.hidden = true;
    openButton.classList.remove('active');
    openButton.setAttribute('aria-expanded', 'false');
    openButton.focus();
  }

  panel.querySelector('.eq-close').addEventListener('click', closePanel);
  openButton.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    openButton.classList.toggle('active', !panel.hidden);
    openButton.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) initializeAudio();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) closePanel();
  });

  document.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('#play,[data-action="play-track"]')) {
      initializeAudio();
    }
  }, true);

  applySettings();
  stopVisualizer();
})();
