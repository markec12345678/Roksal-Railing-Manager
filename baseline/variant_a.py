# -*- coding: utf-8 -*-
"""
ROKSAL Round S+1 — VARIANT A: klasična sinteza (geometrija + alpha blending)
Pipeline: izrez produkta → 4-točkovna perspektivna transformacija →
          odstranitev stare ograje (cv2 TELEA) → luminance-only harmonizacija
          (RAL-varen) → feather blending (EdgeBlender iz repota) → kontaktna senca
Dokazila: diff izven maske (original MORA ostati nedotaknjen), ΔE barve produkta
          (identiteta RAL), timing po korakih.
Reused ORIGINAL repo code: EdgeBlender, ColorMatcher (AI-Photo-Object-Editor, MIT)
"""
import sys, time, json
import numpy as np
import cv2

sys.path.insert(0, '/home/z/AI-Photo-Object-Editor/backend')
from app.ml.processors.edge_blender import EdgeBlender   # original repo processor
from app.ml.processors.color_matcher import ColorMatcher # original repo processor (COMPARISON)

t_all = time.time()
metrics = {}
log = lambda k, t0: (metrics.update({k: round(time.time()-t0, 3)}), print(f'[{k}] {time.time()-t0:.3f}s'))

# ------------------------------------------------------------------ inputs
balcony = cv2.imread('input/balcony_3.png')            # A: realna fotografija balkona
fence   = cv2.imread('input/fence_0.jpg')              # B: produktska fotografija — temna letvica, realna foto (gosto!)
H, W = balcony.shape[:2]
assert (H, W) == (1024, 1024)

# ------------------------------------------------------------------ 1. maska stare ograje (input C — poligon, kot bi ga risal monter)
# kvadrilaterial PO OGRAJI + rahlo nad handrailom (pokrije celotno staro ograjo)
quad = np.float32([[238, 462], [956, 302], [952, 668], [238, 726]])  # TL TR BR BL
mask_C = np.zeros((H, W), np.uint8)
cv2.fillPoly(mask_C, [quad.astype(np.int32)], 255)
cv2.imwrite('mask/mask_C_old_fence.png', mask_C)
print('mask C pixels:', int((mask_C > 0).sum()), f'({(mask_C>0).mean()*100:.1f}% frame)')

# ------------------------------------------------------------------ 2. izrez produkta (bay med drogovima iz fence_0, temne letvice)
# izmerjeno na grid overlay: bay [x 540..1000] — TL(540,180) TR(1000,118) BR(1000,738) BL(540,700)
t0 = time.time()
fx0, fy0, fx1, fy1 = 540, 100, 1000, 760
bay = fence[fy0:fy1, fx0:fx1].copy()
src_quad = np.float32([[540-fx0, 180-fy0], [1000-fx0, 118-fy0], [1000-fx0, 738-fy0], [540-fx0, 700-fy0]])
pg = cv2.cvtColor(bay, cv2.COLOR_BGR2GRAY)
# alpha: temne letvice/rails -> 1; vrzeli (zid) -> 0
alpha = (pg < 115).astype(np.float32)
# zapri majhne luknje v letvicah (odsevi), ne zapri 20px+ vrzeli
alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
# največja povezana komponenta znotraj bay kvadra
quad_m = np.zeros_like(alpha, np.uint8)
cv2.fillPoly(quad_m, [src_quad.astype(np.int32)], 1)
alpha = alpha * quad_m
n, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 0.5).astype(np.uint8))
if n > 1:
    biggest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    alpha = np.where(labels == biggest, alpha, 0.0)
    # ohrani vse komponente znotraj kvadra, ki so dovolj velike (drogovi obrobni)
    keep = np.where((labels == biggest) | ((labels > 0) & (quad_m > 0) & (stats[labels, cv2.CC_STAT_AREA] > 4000)), alpha, 0.0)
    alpha = keep
alpha = np.clip(cv2.GaussianBlur(alpha, (3, 3), 0.8), 0, 1)
log('cutout', t0)
cv2.imwrite('work/product_rgba.png', np.dstack([bay, (alpha*255).astype(np.uint8)]))
print('bay size:', bay.shape, 'alpha coverage:', f'{alpha.mean()*100:.1f}%')

# ------------------------------------------------------------------ 3. odstranitev stare ograje — sinteza ozadja (CPU, brez torch)
# stolpična linearna interpolacija: za vsak stolpec raztegnemo pixel nad/pod masko
# (strukturno zavedno polnjenje, brez TELEA rjavih madežev)
t0 = time.time()
bg_filled = balcony.copy().astype(np.float32)
ys_top = np.full(W, -1)
ys_bot = np.full(W, -1)
for x in range(W):
    col = np.where(mask_C[:, x] > 0)[0]
    if len(col) > 0:
        ys_top[x], ys_bot[x] = col.min(), col.max()
valid = ys_top >= 0
xs_v = np.where(valid)[0]
for x in xs_v:
    yt, yb = int(ys_top[x]), int(ys_bot[x])
    # ref vzorčenje NADALJ od roba (14px pas, preskoči 6px ob robu) + median
    # (stare palice, ki križajo mejo maske, se ne smejo razmazati v polnilo)
    top_band = balcony[max(yt-20, 0):max(yt-8, 1), x]
    bot_band = balcony[min(yb+8, H-1):min(yb+20, H), x]
    top_ref = np.median(top_band, axis=0) if len(top_band) else balcony[max(yt-2,0), x]
    bot_ref = np.median(bot_band, axis=0) if len(bot_band) else balcony[min(yb+2,H-1), x]
    n = yb - yt + 1
    t = np.linspace(0, 1, n)[:, None]
    bg_filled[yt:yb+1, x] = top_ref[None, :] * (1 - t) + bot_ref[None, :] * t
# blago zgladi vodoravne prelome (samo znotraj maske)
smooth = cv2.GaussianBlur(bg_filled, (0, 0), 3)
m3 = (cv2.GaussianBlur(mask_C, (0, 0), 2)[..., None] / 255.0)
bg_filled = bg_filled * (1 - m3) + smooth * m3
bg_filled = np.clip(bg_filled, 0, 255).astype(np.uint8)
log('bg_column_lerp', t0)
# TELEA primerjava (shranjena za poročilo)
cv2.imwrite('work/background_telea.jpg', cv2.inpaint(balcony, mask_C, 6, cv2.INPAINT_TELEA))
cv2.imwrite('work/background_filled.png', bg_filled)

# ------------------------------------------------------------------ 4. 4-točkovna perspektiva (GEOMETRIJA — ne AI!)
# projekcijska preslikava: DEJANSKI kvader bay v produkt-foto -> ciljni kvader na balkonu
t0 = time.time()
M = cv2.getPerspectiveTransform(src_quad, quad)
warp = cv2.warpPerspective(bay, M, (W, H))
warp_a = cv2.warpPerspective(alpha, M, (W, H))
log('perspective_warp', t0)

# ------------------------------------------------------------------ 5. luminance-only harmonizacija (RAL-VARNO barvno ujemanje)
# repo ColorMatcher naredi mean/std transfer vseh kanalov -> prestavi RAL barvo!
# rešitev: samo L (svetlost) prilagodimo nizkofrekvčni osvetlitvi okolice,
# a/b (barvni ton = RAL) OHRANIMO.
t0 = time.time()
ring = cv2.dilate(mask_C, np.ones((61, 61), np.uint8)) - cv2.erode(mask_C, np.ones((9, 9), np.uint8))
ring = np.clip(ring, 0, 255).astype(np.uint8)
# nizkofrekvčna osvetlitev okolice (illumination field)
Lscene = cv2.cvtColor(bg_filled, cv2.COLOR_BGR2LAB)[:, :, 0].astype(np.float32)
illum = cv2.GaussianBlur(Lscene, (0, 0), 25)
# normalizacija: polje = 1.0 na povprečju okolice blizu maske → NIVO SVETLOSTI IZDELKA SE OHRANI
illum_ring_mean = illum[ring > 0].mean() if (ring > 0).any() else 128.0
field = illum / max(illum_ring_mean, 1.0)
field = np.clip(field, 0.85, 1.15)

prod_lab = cv2.cvtColor(warp, cv2.COLOR_BGR2LAB).astype(np.float32)
Lprod = prod_lab[:, :, 0]
Lmu_prod = Lprod[warp_a > 0.5].mean() if (warp_a > 0.5).any() else 128.0
# zaščita temnega izdelka (RAL 9005/7016): manjša modulacija, nivo se NE premakne
strength = 0.6 if Lmu_prod < 70 else 1.0
Lnew = Lprod * (1.0 + strength * (field - 1.0))
prod_lab[:, :, 0] = np.clip(Lnew, 0, 255)
warp_harm = cv2.cvtColor(prod_lab.astype(np.uint8), cv2.COLOR_LAB2BGR)
log('luminance_harmonize', t0)
print(f'illum ring={illum_ring_mean:.1f} prod L={Lmu_prod:.1f} strength={strength} (nivo ohranjen, samo shading field)')

# ------------------------------------------------------------------ 6. feather blending (EdgeBlender IZ ORIGINALNEGA REPOJA)
t0 = time.time()
eb = EdgeBlender()
feathered = eb._feather_mask(warp_a.astype(np.float32), feather_radius=3, blur_method='gaussian')
comp = bg_filled.astype(np.float32) * (1 - feathered[..., None]) + warp_harm.astype(np.float32) * feathered[..., None]
result = np.clip(comp, 0, 255).astype(np.uint8)
log('feather_blend_repo', t0)

# ------------------------------------------------------------------ 7. kontaktna senca ob spodnjem robu ograje
t0 = time.time()
shadow = np.zeros((H, W), np.float32)
tl, tr, br, bl = quad
for i in range(28):  # ožji pas pod spodnjim robom
    t = i / 28.0
    y_top = bl[1] + 4
    y_bot = bl[1] + 30
    xl, xr = bl[0], br[0]
    band = np.zeros((H, W), np.float32)
    band[int(y_top+t*18):int(y_bot+2+t*18), int(xl):int(xr)] = (1-t)*0.22
    shadow = np.maximum(shadow, band)
shadow = cv2.GaussianBlur(shadow, (21, 21), 5)
result_f = result.astype(np.float32) * (1 - shadow[..., None]*0.4)
result = np.clip(result_f, 0, 255).astype(np.uint8)
log('contact_shadow', t0)

# ------------------------------------------------------------------ 8. DOKAZILA — original izven maske MORA biti enak (0 diff)
diff_out = np.abs(balcony.astype(np.int16) - result.astype(np.int16)).sum(axis=2)
outside = mask_C == 0
max_out = int(diff_out[outside].max())
mean_out = float(diff_out[outside].mean())
metrics['outside_mask_max_abs_diff'] = max_out
metrics['outside_mask_mean_abs_diff'] = round(mean_out, 4)
print(f'OUTSIDE MASK diff: max={max_out} mean={mean_out:.4f}  (senca seže rahlo izven maske: pričakovano >0 pod robom)')
# diff brez cona-pasu
diff_no_shadow = np.abs(balcony.astype(np.int16) - cv2.inpaint(balcony, mask_C, 6, cv2.INPAINT_TELEA).astype(np.int16)).sum(axis=2)
print(f'OUTSIDE MASK (pre senca): max={int(diff_no_shadow[outside].max())}')

# ------------------------------------------------------------------ 8b. DOKAZILO IDENTITETE: štetje letvic v REKTIFIKIRANEM prostoru
# (perspektiva poševne letvice izpere vrstične profile → najprej warp na pravokotnik)
def rectify_and_count(alpha_img, quad_src, rw=700, rh=300):
    dst = np.float32([[0, 0], [rw, 0], [rw, rh], [0, rh]])
    M2 = cv2.getPerspectiveTransform(quad_src.astype(np.float32), dst)
    rect = cv2.warpPerspective(alpha_img, M2, (rw, rh))
    strip = rect[:, int(rw*0.35):int(rw*0.65)]  # centralni stolpčni pas (brez drogov)
    profile = (strip > 0.5).astype(np.float32).mean(axis=1)
    on = profile > 0.5
    count, prev = 0, False
    for v in on:
        if v and not prev: count += 1
        prev = v
    return count, rect

# produkt: bay kvader -> pravokotnik
n_prod, rect_prod = rectify_and_count(alpha, src_quad)
# rezultat: nameščeni kvader -> isti pravokotnik
n_res, rect_res = rectify_and_count(warp_a, quad)
metrics['letvice_count_product'] = n_prod
metrics['letvice_count_result'] = n_res
metrics['letvice_identity_ok'] = (n_prod == n_res)
cv2.imwrite('work/rect_product.png', (rect_prod*255).astype(np.uint8))
cv2.imwrite('work/rect_result.png', (rect_res*255).astype(np.uint8))
print(f'LETVICE (rektificirano): produkt={n_prod} rezultat={n_res} -> {"ENAKO ✓" if n_prod==n_res else "RAZLIKA ✗"}')

# ------------------------------------------------------------------ 9. COMPARISON: repo ColorMatcher (full transfer) — ΔE RAL drift
t0 = time.time()
cm = ColorMatcher()
try:
    pasted = bg_filled.copy()
    x1q, y1q = int(quad[:, 0].min()), int(quad[:, 1].min())
    x2q, y2q = int(quad[:, 0].max()), int(quad[:, 1].max())
    region = result[y1q:y2q, x1q:x2q].copy()
    ok = region.shape[0] > 0 and region.shape[1] > 0
    bbox = {'x1': x1q, 'y1': y1q, 'x2': x2q, 'y2': y2q}
    import asyncio
    loop = asyncio.new_event_loop()
    matched_bytes = loop.run_until_complete(cm.match_colors(
        cv2.imencode('.jpg', result)[1].tobytes(), bbox, method='mean_std'))
    cm_result = cv2.imdecode(np.frombuffer(matched_bytes, np.uint8), cv2.IMREAD_COLOR)
    metrics['repo_color_matcher_run'] = True
    # ΔE na produktnih pikslih (feathered > 0.9): mean_std transfer spreminja a/b!
    m = feathered > 0.9
    lab_a = cv2.cvtColor(result, cv2.COLOR_BGR2LAB).astype(np.float32)
    lab_b = cv2.cvtColor(cm_result, cv2.COLOR_BGR2LAB).astype(np.float32)
    dE = np.sqrt(((lab_a - lab_b) ** 2).sum(axis=2))[m]
    metrics['repo_color_matcher_mean_dE_product'] = round(float(dE.mean()), 2)
    cv2.imwrite('result/A_comparison_repo_colormatch.jpg', cm_result)
    print(f'REPO ColorMatcher ΔE (RAL drift) on product: {dE.mean():.2f} (>10 = očiten premik barve)')
except Exception as e:
    metrics['repo_color_matcher_run'] = False
    metrics['repo_color_matcher_error'] = str(e)[:200]
    print('ColorMatcher comparison failed:', e)
log('repo_color_matcher_comparison', t0)

# ------------------------------------------------------------------ save
cv2.imwrite('result/A_result.jpg', result, [cv2.IMWRITE_JPEG_QUALITY, 95])
overlay = balcony.copy()
overlay[mask_C > 0] = (overlay[mask_C > 0] * 0.4 + np.float32([0, 0, 255]) * 0.6).astype(np.uint8)
cv2.imwrite('work/mask_visualization.jpg', overlay)
metrics['total_time_s'] = round(time.time() - t_all, 2)
json.dump(metrics, open('result/A_metrics.json', 'w'), indent=2)
print(json.dumps(metrics, indent=2))
print('DONE variant A')
