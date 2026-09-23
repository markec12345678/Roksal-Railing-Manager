/**
 * S+5 — metrike hero demo primera (public/viz-demo/hero-metrics.json).
 * Generira tools/hero-demo.ts z DOKAZANIM A-pipeline-om na demo assets.
 * Statistični import — vrednosti so del paketa (brez dodatnega HTTP klica).
 *
 * VIR RESNICE: tools/hero-demo.ts (ponovno zaganjajoč dokaz, algoritem 1:1).
 */
export interface HeroDemoMetrics {
  source: string
  letviceProduct: number
  letviceResult: number
  letviceIdentityOk: boolean
  outsideMaxPreShadow: number
  chromaDE: number
  pipelineMs: number
  wallMs: number
}

import metricsJson from '../../../public/viz-demo/hero-metrics.json'

export const heroMetrics = metricsJson as HeroDemoMetrics
