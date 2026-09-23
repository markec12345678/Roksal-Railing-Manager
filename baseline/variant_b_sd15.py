# -*- coding: utf-8 -*-
"""
ROKSAL Round S+1 — VARIANT B: SD1.5-inpainting (repo DiffusionReplacer pot, brez IP-Adapter)
- IP-Adapter uteži (h94) = CC BY-NC-SA → IZLOČENE iz komercialne poti → text-only pogoj
- CPU poskus: fp16 + sequential CPU offload, 12 korakov, 512 delovna resolucija
- Vprašanje, na ki odgovarja test: ali text-only SD ohrani IDENTITETO izdelka?
  (pričakovano NE — to je dokaz, da referenčno-vodena pot (A geometrija / C Qwen) je obvezna)
Na GPU strežniku: ista skripta, device='cuda', steps=30, WORK_RES=640 (repo nastavitve).
"""
import os, time, json
os.environ['MALLOC_ARENA_MAX'] = '2'
os.environ['HF_HUB_ENABLE_HF_TRANSFER'] = '0'
import numpy as np
import cv2

t_all = time.time()
metrics = {}
WORK_RES = 512
STEPS = 12
GUIDANCE = 5.5
PROMPT = "dark anthracite grey aluminium horizontal slat fence railing on balcony, photorealistic, sharp, detailed metal slats"
NEGATIVE = ("blurry, distorted, low quality, deformed, artifacts, wooden fence, "
            "picket fence, white fence, vertical bars, chain link, extra objects")
SEED = 42

balcony = cv2.imread('input/balcony_3.png')
mask = cv2.imread('mask/mask_C_old_fence.png', 0)
H, W = balcony.shape[:2]

# --- delovna resolucija (repo DiffusionReplacer pristop: crop+resize okoli maske)
ys, xs = np.where(mask > 0)
y1, y2, x1, x2 = ys.min(), ys.max(), xs.min(), xs.max()
pad = int(0.35 * max(y2 - y1, x2 - x1))  # repo DIFFUSION_CROP_PADDING_RATIO
cy1, cy2 = max(y1 - pad, 0), min(y2 + pad, H)
cx1, cx2 = max(x1 - pad, 0), min(x2 + pad, W)
crop = balcony[cy1:cy2, cx1:cx2]
cmask = mask[cy1:cy2, cx1:cx2]
scale = WORK_RES / max(crop.shape[:2])
crop_s = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
cmask_s = cv2.resize(cmask, (crop_s.shape[1], crop_s.shape[0]), interpolation=cv2.INTER_NEAREST)
print(f'crop {crop.shape[:2]} -> work {crop_s.shape[:2]}')

# --- hard binary mask (repo: feathering se odloži na compositing)
cmask_bin = (cmask_s > 127).astype(np.uint8) * 255

import torch
torch.set_num_threads(2)
from diffusers import AutoPipelineForInpainting, DPMSolverMultistepScheduler

t0 = time.time()
pipe = AutoPipelineForInpainting.from_pretrained(
    "stable-diffusion-v1-5/stable-diffusion-inpainting",
    torch_dtype=torch.float16, safety_checker=None, requires_safety_checker=False,
    low_cpu_mem_usage=True)
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, use_karras_sigmas=True)
pipe.enable_sequential_cpu_offload()  # RAM omejitev (2GB) — komponente se nalagajo izmenično
metrics['model_load_s'] = round(time.time() - t0, 1)
print(f'model load {metrics["model_load_s"]}s')

t0 = time.time()
gen = torch.Generator(device='cpu').manual_seed(SEED)
out = pipe(prompt=PROMPT, negative_prompt=NEGATIVE,
           image=crop_s, mask_image=cmask_bin,
           num_inference_steps=STEPS, guidance_scale=GUIDANCE, generator=gen)
gen_img = out.images[0]
metrics['inference_s'] = round(time.time() - t0, 1)
print(f'inference {metrics["inference_s"]}s ({STEPS} steps @ {WORK_RES}px CPU fp16+offload)')

# --- nazaj v originalni okvir: resize + feather blend (repo postopek)
gen_full = cv2.cvtColor(np.array(gen_img), cv2.COLOR_RGB2BGR)
gen_full = cv2.resize(gen_full, (cx2 - cx1, cy2 - cy1), interpolation=cv2.INTER_LANCZOS4)
soft = cv2.GaussianBlur(cmask.astype(np.float32) / 255.0, (0, 0), 4)[..., None]
region = balcony[cy1:cy2, cx1:cx2].astype(np.float32) * (1 - soft) + gen_full.astype(np.float32) * soft
result = balcony.copy()
result[cy1:cy2, cx1:cx2] = np.clip(region, 0, 255).astype(np.uint8)

# --- izven maske: original mora ostati
diff_out = np.abs(balcony.astype(np.int16) - result.astype(np.int16)).sum(axis=2)
outside = mask == 0
metrics['outside_mask_max_abs_diff'] = int(diff_out[outside].max())
metrics['outside_mask_mean_abs_diff'] = round(float(diff_out[outside].mean()), 4)

cv2.imwrite('result/B_result.jpg', result, [cv2.IMWRITE_JPEG_QUALITY, 95])
cv2.imwrite('work/B_gen_crop.png', cv2.cvtColor(np.array(gen_img), cv2.COLOR_RGB2BGR))
metrics['total_time_s'] = round(time.time() - t_all, 2)
metrics['config'] = dict(steps=STEPS, guidance=GUIDANCE, work_res=WORK_RES, seed=SEED,
                         ip_adapter='IZLOČEN (CC BY-NC-SA)', device='cpu fp16 + seq offload')
json.dump(metrics, open('result/B_metrics.json', 'w'), indent=2)
print(json.dumps(metrics, indent=2))
print('DONE variant B')
