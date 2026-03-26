<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import {
  getFileMd5,
  measureImageSize,
  useT,
  useWebCutContext,
  useWebCutHistory,
  useWebCutLibrary,
  useWebCutPlayer,
} from '../../../src/index';

type MouthShape = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'X';
type RhubarbRecognizer = 'phonetic' | 'pocketSphinx';

type RhubarbMouthCue = {
  start: number;
  end: number;
  value: MouthShape;
};

const REQUIRED_SHAPES: MouthShape[] = ['A', 'B', 'C', 'D', 'E', 'F', 'X'];
const OPTIONAL_SHAPES: MouthShape[] = ['G', 'H'];
const ALL_SHAPES: MouthShape[] = ['A', 'B', 'C', 'D', 'E', 'F', 'X', 'G', 'H'];
const DEFAULT_RECOGNIZER: RhubarbRecognizer = 'phonetic';
const MOUTH_SHAPE_INFO: Record<MouthShape, {
  title: string;
  detail: string;
  hint: string;
}> = {
  A: {
    title: 'Closed Lips',
    detail: 'P / B / M',
    hint: 'Closed mouth with light lip pressure',
  },
  B: {
    title: 'Clenched Teeth',
    detail: 'K / S / T / EE',
    hint: 'Slightly open with visible teeth',
  },
  C: {
    title: 'Open Mouth',
    detail: 'EH / AE',
    hint: 'Natural open shape for mid vowels',
  },
  D: {
    title: 'Wide Open',
    detail: 'AA',
    hint: 'Largest open shape for strong vowels',
  },
  E: {
    title: 'Rounded',
    detail: 'AO / ER',
    hint: 'Rounded lips without opening too wide',
  },
  F: {
    title: 'Puckered Lips',
    detail: 'UW / OW / W',
    hint: 'Forward lips for rounded sounds',
  },
  G: {
    title: 'Lip Bite',
    detail: 'F / V',
    hint: 'Upper teeth touch the lower lip',
  },
  H: {
    title: 'Tongue Up',
    detail: 'L',
    hint: 'Tongue lifts behind the upper teeth',
  },
  X: {
    title: 'Rest / Closed Mouth',
    detail: 'Pause / Idle',
    hint: 'Used whenever speech stops and the mouth should rest closed',
  },
};

const t = useT();
const { push, pushSeries } = useWebCutPlayer();
const { push: pushHistory } = useWebCutHistory();
const { cursorTime, width, height } = useWebCutContext();
const { addNewFile } = useWebCutLibrary();

const audioFile = ref<File | null>(null);
const loading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const shapeFiles = reactive<Record<MouthShape, File | null>>({
  A: null,
  B: null,
  C: null,
  D: null,
  E: null,
  F: null,
  G: null,
  H: null,
  X: null,
});

const previewUrls = reactive<Record<MouthShape, string>>({
  A: '',
  B: '',
  C: '',
  D: '',
  E: '',
  F: '',
  G: '',
  H: '',
  X: '',
});

const canGenerate = computed(() => {
  return Boolean(audioFile.value) && REQUIRED_SHAPES.every(shape => shapeFiles[shape]);
});

const extendedShapes = computed(() => ['G', 'H', 'X'].filter((shape) => shapeFiles[shape as MouthShape]).join(''));

function secondsToMicroseconds(value: number) {
  return Math.max(0, Math.round(value * 1_000_000));
}

function normalizeMouthCues(mouthCues: RhubarbMouthCue[], totalDuration: number) {
  const sortedCues = [...mouthCues]
    .filter(cue => cue.end > cue.start)
    .sort((left, right) => left.start - right.start);

  const normalized: RhubarbMouthCue[] = [];
  let cursor = 0;
  const finalDuration = Math.max(0, totalDuration);
  const epsilon = 0.000001;

  for (const cue of sortedCues) {
    const cueStart = Math.max(cursor, cue.start);
    const cueEnd = Math.max(cueStart, cue.end);

    if (cueStart > cursor + epsilon) {
      normalized.push({
        start: cursor,
        end: cueStart,
        value: 'X',
      });
    }

    if (cueEnd > cueStart + epsilon) {
      const previousCue = normalized[normalized.length - 1];
      if (previousCue && previousCue.value === cue.value && Math.abs(previousCue.end - cueStart) <= epsilon) {
        previousCue.end = cueEnd;
      }
      else {
        normalized.push({
          start: cueStart,
          end: cueEnd,
          value: cue.value,
        });
      }
      cursor = cueEnd;
    }
  }

  if (finalDuration > cursor + epsilon) {
    const previousCue = normalized[normalized.length - 1];
    if (previousCue && previousCue.value === 'X' && Math.abs(previousCue.end - cursor) <= epsilon) {
      previousCue.end = finalDuration;
    }
    else {
      normalized.push({
        start: cursor,
        end: finalDuration,
        value: 'X',
      });
    }
  }

  return normalized;
}

function updatePreview(shape: MouthShape, file: File | null) {
  if (previewUrls[shape]) {
    URL.revokeObjectURL(previewUrls[shape]);
    previewUrls[shape] = '';
  }

  if (file) {
    previewUrls[shape] = URL.createObjectURL(file);
  }
}

function handleAudioSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  audioFile.value = input.files?.[0] || null;
}

function handleShapeSelect(shape: MouthShape, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  shapeFiles[shape] = file;
  updatePreview(shape, file);
}

async function validateMouthPack() {
  const referenceShape = ALL_SHAPES.find(shape => shapeFiles[shape]);
  if (!referenceShape || !shapeFiles[referenceShape]) {
    throw new Error('Upload the mouth PNGs before generating lip sync.');
  }

  const referenceSize = await measureImageSize(shapeFiles[referenceShape]!);

  for (const shape of ALL_SHAPES) {
    const file = shapeFiles[shape];
    if (!file) {
      continue;
    }
    const size = await measureImageSize(file);
    if (size.width !== referenceSize.width || size.height !== referenceSize.height) {
      throw new Error('All mouth PNG files must share identical dimensions for accurate overlay alignment.');
    }
  }

  return referenceSize;
}

function buildDefaultRect(imageWidth: number, imageHeight: number) {
  const scale = Math.min(1, width.value / imageWidth, height.value / imageHeight);
  const finalWidth = Math.max(1, Math.round(imageWidth * scale));
  const finalHeight = Math.max(1, Math.round(imageHeight * scale));

  return {
    x: Math.round((width.value - finalWidth) / 2),
    y: Math.round((height.value - finalHeight) / 2),
    w: finalWidth,
    h: finalHeight,
    angle: 0,
  };
}

async function analyzeAudio() {
  if (!audioFile.value) {
    throw new Error('Upload an audio file first.');
  }

  const formData = new FormData();
  formData.append('audio', audioFile.value);
  formData.append('recognizer', DEFAULT_RECOGNIZER);
  formData.append('extendedShapes', extendedShapes.value);

  const response = await fetch('/api/rhubarb-lip-sync/analyze', {
    method: 'POST',
    body: formData,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Rhubarb analysis failed.');
  }
  return payload as {
    metadata: { duration: number };
    mouthCues: RhubarbMouthCue[];
    recognizer: RhubarbRecognizer;
    extendedShapes: string;
  };
}

async function ensureProjectFileId(file: File) {
  await addNewFile(file);
  return await getFileMd5(file);
}

async function generateLipSync() {
  if (!canGenerate.value || !audioFile.value) {
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const referenceSize = await validateMouthPack();
    const analysis = await analyzeAudio();

    if (!analysis.mouthCues.length) {
      throw new Error('Rhubarb returned no mouth cues for this audio.');
    }

    const baseStart = cursorTime.value;
    const defaultRect = buildDefaultRect(referenceSize.width, referenceSize.height);
    const audioFileId = await ensureProjectFileId(audioFile.value);
    const shapeFileIds: Partial<Record<MouthShape, string>> = {};
    const detectedDuration = typeof analysis.metadata?.duration === 'number'
      ? analysis.metadata.duration
      : analysis.mouthCues[analysis.mouthCues.length - 1]?.end || 0;
    const normalizedMouthCues = normalizeMouthCues(analysis.mouthCues, detectedDuration);

    for (const shape of ALL_SHAPES) {
      const shapeFile = shapeFiles[shape];
      if (!shapeFile) {
        continue;
      }
      shapeFileIds[shape] = await ensureProjectFileId(shapeFile);
    }

    await push('audio', `file:${audioFileId}`, {
      time: {
        start: baseStart,
      },
    });

    await pushSeries(
      normalizedMouthCues.map((cue) => {
        const fileId = shapeFileIds[cue.value] || shapeFileIds.X || shapeFileIds.A;
        if (!fileId) {
          throw new Error(`Missing PNG shape for ${cue.value}.`);
        }

        return {
          type: 'image' as const,
          source: `file:${fileId}`,
          meta: {
            thingType: 'rhubarb-lip-sync',
            rect: defaultRect,
            time: {
              duration: secondsToMicroseconds(cue.end - cue.start),
            },
          },
        };
      }),
      {
        startTime: baseStart,
        thingType: 'rhubarb-lip-sync',
      },
    );

    await pushHistory();
    successMessage.value = `Generated distributed lip sync PNG frames and added the audio separately.`;
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to generate lip sync.';
  }
  finally {
    loading.value = false;
  }
}

onBeforeUnmount(() => {
  ALL_SHAPES.forEach((shape) => {
    if (previewUrls[shape]) {
      URL.revokeObjectURL(previewUrls[shape]);
    }
  });
});
</script>

<template>
  <div class="lipsync-panel">
    <div class="lipsync-toolbar">
      <div class="lipsync-toolbar__title">{{ t('Lip Sync') }}</div>
      <button
        class="lipsync-generate"
        type="button"
        :disabled="!canGenerate || loading"
        @click="generateLipSync"
      >
        {{ loading ? t('Generating...') : t('Generate') }}
      </button>
    </div>

    <div class="lipsync-section">
      <div class="lipsync-section__header">
        <span>{{ t('Audio') }}</span>
        <span class="lipsync-section__note">{{ t('Required · WAV or Ogg') }}</span>
      </div>
      <label class="lipsync-upload">
        <input
          class="lipsync-upload__input"
          type="file"
          accept=".wav,.ogg,audio/wav,audio/ogg"
          @change="handleAudioSelect"
        />
        <span>{{ audioFile ? audioFile.name : t('Upload audio') }}</span>
      </label>
    </div>

    <div class="lipsync-section">
      <div class="lipsync-section__header">
        <span>{{ t('Official Mouth Shapes') }}</span>
        <span class="lipsync-section__hint">{{ t('X is required for pauses so the mouth closes when speech stops.') }}</span>
      </div>

      <div class="lipsync-grid">
        <label
          v-for="shape in ALL_SHAPES"
          :key="shape"
          :class="['lipsync-shape-card', { 'lipsync-shape-card--required': REQUIRED_SHAPES.includes(shape), 'lipsync-shape-card--filled': !!shapeFiles[shape] }]"
        >
          <input
            class="lipsync-upload__input"
            type="file"
            accept="image/png"
            @change="handleShapeSelect(shape, $event)"
          />
          <div class="lipsync-shape-card__header">
            <span class="lipsync-shape-card__letter">{{ shape }}</span>
            <span>{{ REQUIRED_SHAPES.includes(shape) ? t('Required') : t('Optional') }}</span>
          </div>
          <div class="lipsync-shape-card__meta">
            <strong>{{ t(MOUTH_SHAPE_INFO[shape].title) }}</strong>
            <span>{{ t(MOUTH_SHAPE_INFO[shape].detail) }}</span>
          </div>
          <div class="lipsync-shape-card__preview">
            <img v-if="previewUrls[shape]" :src="previewUrls[shape]" :alt="`mouth shape ${shape}`" />
            <span v-else>{{ t('Upload PNG') }}</span>
          </div>
          <div class="lipsync-shape-card__footer">
            {{ t(MOUTH_SHAPE_INFO[shape].hint) }}
          </div>
          <div class="lipsync-shape-card__file">
            {{ shapeFiles[shape]?.name || t('Choose file') }}
          </div>
        </label>
      </div>
    </div>

    <div class="lipsync-feedback lipsync-feedback--error" v-if="errorMessage">
      {{ errorMessage }}
    </div>
    <div class="lipsync-feedback lipsync-feedback--success" v-if="successMessage">
      {{ successMessage }}
    </div>
  </div>
</template>

<style scoped>
.lipsync-panel {
  height: 100%;
  overflow: auto;
  padding: 16px;
  box-sizing: border-box;
  background-color: var(--webcut-background-color);
  color: var(--text-color-base);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lipsync-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.lipsync-toolbar__title {
  font-size: 16px;
  font-weight: 700;
}

.lipsync-generate {
  border: 1px solid color-mix(in srgb, var(--primary-color) 32%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--primary-color) 16%, transparent);
  color: var(--text-color-base);
  min-height: 38px;
  padding: 0 16px;
  cursor: pointer;
}

.lipsync-generate:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.lipsync-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lipsync-section__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}

.lipsync-section__note,
.lipsync-section__hint {
  font-size: 11px;
  opacity: 0.7;
}

.lipsync-upload {
  border: 1px dashed var(--webcut-line-color);
  border-radius: 14px;
  background: color-mix(in srgb, var(--webcut-thumb-color) 55%, transparent);
  min-height: 44px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  cursor: pointer;
  box-sizing: border-box;
}

.lipsync-upload__input {
  display: none;
}

.lipsync-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.lipsync-shape-card {
  border: 1px solid var(--webcut-line-color);
  border-radius: 16px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: color-mix(in srgb, var(--webcut-thumb-color) 35%, transparent);
  cursor: pointer;
  min-width: 0;
}

.lipsync-shape-card--required {
  border-color: color-mix(in srgb, var(--primary-color) 22%, var(--webcut-line-color));
}

.lipsync-shape-card--filled {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color) 18%, transparent);
}

.lipsync-shape-card__header,
.lipsync-shape-card__footer,
.lipsync-shape-card__file {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
}

.lipsync-shape-card__letter {
  font-size: 16px;
  font-weight: 700;
}

.lipsync-shape-card__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 38px;
}

.lipsync-shape-card__meta strong {
  font-size: 12px;
  line-height: 1.25;
}

.lipsync-shape-card__meta span {
  font-size: 11px;
  opacity: 0.78;
}

.lipsync-shape-card__footer {
  display: block;
  line-height: 1.35;
  opacity: 0.82;
}

.lipsync-shape-card__file {
  font-size: 11px;
  opacity: 0.96;
}

.lipsync-shape-card__preview {
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  background: color-mix(in srgb, var(--webcut-background-color) 84%, black);
  border: 1px solid color-mix(in srgb, var(--webcut-line-color) 70%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.lipsync-shape-card__preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.lipsync-feedback {
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 12px;
}

.lipsync-feedback--error {
  background: color-mix(in srgb, #d64545 16%, transparent);
  border: 1px solid color-mix(in srgb, #d64545 24%, transparent);
}

.lipsync-feedback--success {
  background: color-mix(in srgb, #27a07c 16%, transparent);
  border: 1px solid color-mix(in srgb, #27a07c 24%, transparent);
}
</style>
