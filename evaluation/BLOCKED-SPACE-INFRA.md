# Dokazilo: zakaj realna Qwen inference ni bila izvedljiva v peskovniku (S+6)

Datum: 2026-09-23 · Spec S+6 §1/§2/§15: meri, ne ugibaj — to je zapis meritev.

## 1. Strojna omejitev (merjeno)

```
nvidia-smi  →  command not found            (Ni GPU)
free -h     →  4.1 GiB total, 1.6 GiB available
df -h /     →  9.9 GiB total, 2.0 GiB prosto
nproc       →  2
docker      →  command not found
```

Qwen-Image-Edit-2509 = 20.4B MMDiT: ~40–55 GB bf16 uteži (~11–13 GB int4 GGUF)
→ uteži se ne prilegajo niti na disk, kvečjemu v RAM; CPU inference na 2 jedrih
ni realna pot. Sklep: **izvedba v peskovniku fizično nemogoča** (ne "težko").

## 2. Poverilnice (audit okolja)

```
env | grep -iE 'runpod|vast|modal|lambda|gpu|hf_|hugging|replicate'  →  (prazno)
```

Najeta GPU instanca (spec §2 jo dovoljuje kot TESTNO INFRASTRUKTURO) zahteva
račun/token — ni na voljo. Nova registracija zahteva plačilo/verifikacijo —
ni izvedljivo iz peskovnika.

## 3. Javni uradni demo Space — poskus + zavrnitev (dokazano)

Uradni `Qwen/Qwen-Image-Edit-2509` Space je RUNNING (ZeroGPU A10G). API shema
ima vse, kar spec §17/§18 zahteva (`images` seznam, `seed`, `randomize_seed`,
`true_guidance_scale`, `num_inference_steps`, `rewrite_prompt`).

Poskus 1 — anonimni API klic (upload OK, inferenca):

```
POST /gradio_api/call/infer → 200 {"event_id": …}
GET  /gradio_api/call/infer/<event_id>
event: error
data: null            ← takoj (0.2 s), ne po GPU delu
```

Poskus 2 — brskalniški UI (agent-browser): slike naložene (2 sliki ✓), prompt
vstavljen ✓, seed=250901 + randomize OFF ✓, rewrite_prompt OFF ✓, 1024×1024 ✓,
"Edit!" → **Error** v izhodnem stolpcu.

Poskus 3 — diskriminacijski test (FLUX.1-schnell, drug, majhen ZeroGPU Space):

```
API:     event: error / data: null (0.2 s)
Brskalnik: Error tudi tam
```

→ **Vsa ZeroGPU anonimna uporaba iz tega datacenter IP je zavrnjena** (kvota=0),
nije napaka našega payloada.

## 4. Iskanje ne-ZeroGPU poti (raziskano)

- Iskanje po HF Spaces (Qwen-Image-Edit-2509): ~60 rezultatov; vsi vidni
  kandidati z vsebino = `zero-a10g` (blokirano kot zgoraj);
  `dmorawiec/Nunchaku_Qwen-Image-Edit-2509` = `cpu-basic` (2 vCPU — 20B model
  ni realno obdelati; tudi RAM meja).
- HF Inference Providers za ta model: zahtevajo HF token + gre prek plačljivih
  ponudnikov (fal/Replicate) — spec §2 to izključuje.
- ModelScope (modelscope.cn) dosegljiv, a studio/API zahteva prijavo.

## 5. Sklep

Realna inference zahteva ENO od:
1. lasten/najet GPU stroj (runbook: gpu-backend/README.md — 3 ukazi do run-a),
2. HF račun s tokenom (ZeroGPU kvota) — za brskalniški/API dostop do javnega dema,
3. potrditev pristopov na ModelScope.

Celoten merilni sistem je zgrajen in validiran (pogodba 15/15, instrument 14/14,
dataset 6 realnih testov, A-stolpec izpolnjen) — realni run je en ukaz takoj,
ko je GPU dosegljiv.
