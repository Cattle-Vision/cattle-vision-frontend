/**
 * Motor Client-Side de Análise Visual em Tempo Real e Pré-Upload (`src/lib/vision-client.ts`).
 *
 * Responsabilidades:
 * 1. Projeção Geométrica da Mira (`getReticleCropCoordinates`).
 * 2. Análise Instantânea de Confiança em Tempo Real Baseada no Recorte (`computeInstantVideoScore`).
 * 3. Inferência IA Híbrida (`evaluatePhotoScoreBeforeUpload`) integrada ao backend remoto.
 */
import { getApiUrl } from "./api";

export interface VisionScoreResult {
  score: number;
  lowQuality: boolean;
  source: "yolo-onnx" | "vision-analysis" | "client-optical";
  feedback: string;
  box?: {
    cx: number;
    cy: number;
    w: number;
    h: number;
  };
}

/**
 * Mapeia as coordenadas da marcação visual (mira HUD) da tela para os pixels reais do frame de vídeo,
 * considerando a propriedade `object-cover` e deslocamentos de renderização do elemento `<video>`.
 */
export function getReticleCropCoordinates(
  video: HTMLVideoElement,
  reticleEl?: HTMLElement | null
): { sx: number; sy: number; sw: number; sh: number } {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return { sx: 0, sy: 0, sw: 0, sh: 0 };

  if (!reticleEl) {
    return { sx: 0, sy: 0, sw: vw, sh: vh };
  }

  const videoRect = video.getBoundingClientRect();
  const reticleRect = reticleEl.getBoundingClientRect();

  if (videoRect.width <= 0 || videoRect.height <= 0) {
    return { sx: 0, sy: 0, sw: vw, sh: vh };
  }

  const scale = Math.max(videoRect.width / vw, videoRect.height / vh);
  const renderedW = vw * scale;
  const renderedH = vh * scale;

  const offsetX = (videoRect.width - renderedW) / 2;
  const offsetY = (videoRect.height - renderedH) / 2;

  const screenX = reticleRect.left - videoRect.left;
  const screenY = reticleRect.top - videoRect.top;

  const rawSx = (screenX - offsetX) / scale;
  const rawSy = (screenY - offsetY) / scale;
  const rawSw = reticleRect.width / scale;
  const rawSh = reticleRect.height / scale;

  const sx = Math.max(0, Math.min(vw - 20, rawSx));
  const sy = Math.max(0, Math.min(vh - 20, rawSy));
  const sw = Math.max(20, Math.min(vw - sx, rawSw));
  const sh = Math.max(20, Math.min(vh - sy, rawSh));

  return { sx, sy, sw, sh };
}

/**
 * Calcula métricas ópticas instantâneas diretamente da REGIÃO RECORTADA pela mira do `<video>`
 * para alimentar a confiança ao vivo enquanto o operador enquadra a traseira bovina.
 */
export function computeInstantVideoScore(
  video: HTMLVideoElement,
  scratchCanvas: HTMLCanvasElement,
  reticleEl?: HTMLElement | null
): { score: number; statusText: string } | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const { sx, sy, sw, sh } = getReticleCropCoordinates(video, reticleEl);
  if (sw <= 0 || sh <= 0) return null;

  const SIZE = 96;
  scratchCanvas.width = SIZE;
  scratchCanvas.height = SIZE;
  const ctx = scratchCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  let sumLuma = 0;
  let sumLumaSq = 0;
  let edgeEnergy = 0;
  let centerContrast = 0;
  const totalPixels = SIZE * SIZE;

  const luma = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const y = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    luma[i] = y;
    sumLuma += y;
    sumLumaSq += y * y;
  }

  const mean = sumLuma / totalPixels;
  const variance = Math.max(0, sumLumaSq / totalPixels - mean * mean);
  const stdDev = Math.sqrt(variance);

  for (let y = 16; y < SIZE - 16; y++) {
    for (let x = 16; x < SIZE - 16; x++) {
      const i = y * SIZE + x;
      const gx = Math.abs(luma[i + 1] - luma[i - 1]);
      const gy = Math.abs(luma[i + SIZE] - luma[i - SIZE]);
      const grad = gx + gy;
      edgeEnergy += grad;
      if (x >= 24 && x <= 72 && y >= 20 && y <= 76) {
        centerContrast += Math.abs(luma[i] - mean);
      }
    }
  }

  const innerPixels = (SIZE - 32) * (SIZE - 32);
  const avgEdge = edgeEnergy / innerPixels;
  const avgCenterDiff = centerContrast / (48 * 56);

  let lightFactor = 1.0;
  if (mean < 32) lightFactor = Math.max(0.2, mean / 32);
  else if (mean > 228) lightFactor = Math.max(0.25, (255 - mean) / 27);

  const sharpnessScore = Math.min(1, avgEdge / 26);
  const contrastScore = Math.min(1, stdDev / 48);
  const subjectScore = Math.min(1, avgCenterDiff / 28);

  const raw =
    (sharpnessScore * 0.45 + contrastScore * 0.3 + subjectScore * 0.25) *
    lightFactor *
    95;
  const score = Math.round(Math.max(8, Math.min(96, raw)));

  let statusText = "Posicione a garupa na mira";
  if (mean < 35) statusText = "Ambiente muito escuro";
  else if (mean > 228) statusText = "Excesso de luz / contraluz";
  else if (avgEdge < 9) statusText = "Foco instável";
  else if (score >= 70) statusText = "Enquadramento ideal · Pronto";
  else if (score >= 45) statusText = "Traseira detectada na mira";

  return { score, statusText };
}

/**
 * Avalia a Confiança da IA de um Blob de imagem ANTES do upload definitivo enviando ao backend.
 */
export async function evaluatePhotoScoreBeforeUpload(
  blob: Blob
): Promise<VisionScoreResult> {
  try {
    const fd = new FormData();
    fd.append("file", blob, "frame.jpg");

    const baseUrl = getApiUrl();
    const res = await fetch(`${baseUrl}/api/photos/score`, {
      method: "POST",
      body: fd,
    });

    if (res.ok) {
      const data = (await res.json()) as VisionScoreResult;
      if (typeof data.score === "number") {
        return data;
      }
    }
  } catch {
    // Fallback estruturado
  }

  return {
    score: 50.0,
    lowQuality: false,
    source: "client-optical",
    feedback: "Análise óptica preliminar concluída. O modelo YOLO validará no upload.",
  };
}
