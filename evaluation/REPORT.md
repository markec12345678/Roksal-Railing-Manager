# S+6 — Qwen GPU Proof-of-Quality: REZULTATI

> **⚠️ MOCK REHEARSAL** — izhodi iz determinističnega mock backend-a (`QWEN_MOCK=1`). To dokazuje pogodbo API-ja (§20), evalvacijsko cevovod in merilni instrument (§13) — NE kakovosti Qwen-Image-Edit-2509. Realni run: `run_suite.py --backend <GPU-URL>` (glej gpu-backend/README.md).

Generirano: 2026-09-23 18:47:18
Prompt (§17, kanoničen): `Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.`

| Test | Način | Identiteta (perioda A→Q) | Geometrija (corr) | Barva (ΔE) | Okolica (frac) | Occlusion | Čas (s) | Sklep |
|---|---|---|---|---|---|---|---|---|
| S6-T1-ravna-antracit | finalize | 21→21 | 0.9914 | 1.96 | 0.021827 | n/a | 0.09 | FAIL: okolica spremenjena |
| | | | | | | | | ![trak ORIGINAL|A|QWEN](output/S6-T1-ravna-antracit/strip_finalize.jpg) |
| S6-T1-ravna-antracit | compose | 21→17 | 0.1063 | 18.53 | 0.00532 | n/a | 0.15 | FAIL: barvni odmik, geometrija |
| | | | | | | | | ![trak ORIGINAL|A|QWEN](output/S6-T1-ravna-antracit/strip_compose.jpg) |
| S6-T2-perspektiva | finalize | 21→20 | 0.9879 | 3.19 | 0.028463 | n/a | 0.09 | FAIL: okolica spremenjena |
| | | | | | | | | ![trak ORIGINAL|A|QWEN](output/S6-T2-perspektiva/strip_finalize.jpg) |
| S6-T2-perspektiva | compose | 21→17 | 0.0768 | 16.45 | 0.004077 | n/a | 0.2 | FAIL: barvni odmik, geometrija |
| | | | | | | | | ![trak ORIGINAL|A|QWEN](output/S6-T2-perspektiva/strip_compose.jpg) |
| S6-T3-osvetlitev | finalize | 4→4 | 0.9866 | 2.55 | 0.00624 | n/a | 0.05 | PASS kandidat (potrdi vizualno) |
| | | | | | | | | ![trak ORIGINAL|A|QWEN](output/S6-T3-osvetlitev/strip_finalize.jpg) |
| S6-T3-osvetlitev | compose | 4→17 | 0.1648 | 18.67 | 0.006327 | n/a | 0.13 | FAIL: barvni odmik, struktura letvic, geometrija |
| | | | | | | | | ![trak ORIGINAL|A|QWEN](output/S6-T3-osvetlitev/strip_compose.jpg) |
| S6-T4-occlusion-rastlinje | finalize | 21→21 | 0.98 | 2.48 | 0.033394 | izmerjeno | 0.09 | FAIL: okolica spremenjena |
| | | | | | | | | ![trak ORIGINAL|A|QWEN](output/S6-T4-occlusion-rastlinje/strip_finalize.jpg) |
| S6-T4-occlusion-rastlinje | compose | 21→17 | 0.077 | 19.2 | 0.004925 | izmerjeno | 0.16 | FAIL: barvni odmik, geometrija |
| | | | | | | | | ![trak ORIGINAL|A|QWEN](output/S6-T4-occlusion-rastlinje/strip_compose.jpg) |
| S6-T5-svetlo-ozadje | finalize | 19→21 | 0.9882 | 2.01 | 0.005492 | n/a | 0.09 | PASS kandidat (potrdi vizualno) |
| | | | | | | | | ![trak ORIGINAL|A|QWEN](output/S6-T5-svetlo-ozadje/strip_finalize.jpg) |
| S6-T5-svetlo-ozadje | compose | 19→17 | 0.1861 | 17.92 | 0.005538 | n/a | 0.11 | FAIL: barvni odmik, geometrija |
| | | | | | | | | ![trak ORIGINAL|A|QWEN](output/S6-T5-svetlo-ozadje/strip_compose.jpg) |
| S6-T6-occlusion-drevo | finalize | 4→26 | 0.6088 | 6.86 | 0.033334 | izmerjeno | 0.17 | FAIL: okolica spremenjena, barvni odmik, struktura letvic |
| | | | | | | | | ![trak ORIGINAL|A|QWEN](output/S6-T6-occlusion-drevo/strip_finalize.jpg) |
| S6-T6-occlusion-drevo | compose | 4→13 | 0.3112 | 18.43 | 0.005129 | izmerjeno | 0.15 | FAIL: barvni odmik, struktura letvic, geometrija |
| | | | | | | | | ![trak ORIGINAL|A|QWEN](output/S6-T6-occlusion-drevo/strip_compose.jpg) |

## Meritve po testu (§13)

### S6-T1-ravna-antracit / finalize
```json
{
  "jobId": "f907687c63974474a23a2ae5a9e61cc2",
  "projectId": "S6-T1-ravna-antracit",
  "status": "completed",
  "createdAt": 1790189208.6976442,
  "startedAt": 1790189208.6982343,
  "finishedAt": 1790189209.0842085,
  "error": null,
  "generation_time_s": 0.09,
  "vram_peak_mib": null,
  "vram_total_mib": null,
  "ram_peak_mib": null,
  "gpu_name": null,
  "seed": 250901,
  "steps": 40,
  "true_cfg_scale": 4.0,
  "negative_prompt": " ",
  "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
  "width": 1024,
  "height": 1024,
  "model_load_s": 0.0,
  "mock": true,
  "mock_note": "MOCK izhod — dokazuje pogodbo API-ja in determinizem, NE kakovosti Qwen-a (spec §19)",
  "determinism_note": "mock: isti seed + isti vhodi = bajtno identičen izhod",
  "model": "mock-composite",
  "mode": "finalize",
  "resolution_label": "final",
  "queue_wait_s": 0.0,
  "total_job_s": 0.38,
  "device": "cpu",
  "backend_mode": "mock",
  "api_contract": "S+6 §20",
  "request": {
    "projectId": "S6-T1-ravna-antracit",
    "original": "<b64>",
    "product": "<b64>",
    "mask": "<b64>",
    "aPreview": "<b64>",
    "mode": "finalize",
    "placement": {
      "corners": [
        [
          0.232421875,
          0.451171875
        ],
        [
          0.93359375,
          0.294921875
        ],
        [
          0.9296875,
          0.65234375
        ],
        [
          0.232421875,
          0.708984375
        ]
      ]
    },
    "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
    "seed": 250901,
    "resolution": "final",
    "steps": 40,
    "trueCfg": 4.0
  },
  "test_id": "S6-T1-ravna-antracit",
  "metrics": {
    "sanity_A_vs_original": {
      "pixels_outside": 809766,
      "mean_abs_diff": 1.226,
      "p99_abs_diff": 13.0,
      "frac_changed": 0.005972
    },
    "background_preservation_Q_vs_A": {
      "pixels_outside": 809766,
      "mean_abs_diff": 3.663,
      "p99_abs_diff": 20.0,
      "frac_changed": 0.021827
    },
    "color_Q_vs_A": {
      "pixels_sampled": 178341,
      "deltaE_mean": 1.96,
      "deltaE_p95": 5.59
    },
    "letvice_A_estimate": 4,
    "letvice_Q_estimate": 5,
    "slat_period_A": 21,
    "slat_period_Q": 21,
    "slat_period_rel_diff": 0.0,
    "edge_profile_correlation": 0.9914
  }
}
```

### S6-T1-ravna-antracit / compose
```json
{
  "jobId": "d5ba29613dab4f51a6e385a75bfadb56",
  "projectId": "S6-T1-ravna-antracit",
  "status": "completed",
  "createdAt": 1790189210.78316,
  "startedAt": 1790189210.7836008,
  "finishedAt": 1790189211.223457,
  "error": null,
  "generation_time_s": 0.15,
  "vram_peak_mib": null,
  "vram_total_mib": null,
  "ram_peak_mib": null,
  "gpu_name": null,
  "seed": 250901,
  "steps": 40,
  "true_cfg_scale": 4.0,
  "negative_prompt": " ",
  "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
  "width": 1024,
  "height": 1024,
  "model_load_s": 0.0,
  "mock": true,
  "mock_note": "MOCK izhod — dokazuje pogodbo API-ja in determinizem, NE kakovosti Qwen-a (spec §19)",
  "determinism_note": "mock: isti seed + isti vhodi = bajtno identičen izhod",
  "model": "mock-composite",
  "mode": "compose",
  "resolution_label": "final",
  "queue_wait_s": 0.0,
  "total_job_s": 0.44,
  "device": "cpu",
  "backend_mode": "mock",
  "api_contract": "S+6 §20",
  "request": {
    "projectId": "S6-T1-ravna-antracit",
    "original": "<b64>",
    "product": "<b64>",
    "mask": "<b64>",
    "aPreview": "<b64>",
    "mode": "compose",
    "placement": {
      "corners": [
        [
          0.232421875,
          0.451171875
        ],
        [
          0.93359375,
          0.294921875
        ],
        [
          0.9296875,
          0.65234375
        ],
        [
          0.232421875,
          0.708984375
        ]
      ]
    },
    "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
    "seed": 250901,
    "resolution": "final",
    "steps": 40,
    "trueCfg": 4.0
  },
  "test_id": "S6-T1-ravna-antracit",
  "metrics": {
    "sanity_A_vs_original": {
      "pixels_outside": 809766,
      "mean_abs_diff": 1.226,
      "p99_abs_diff": 13.0,
      "frac_changed": 0.005972
    },
    "background_preservation_Q_vs_A": {
      "pixels_outside": 809766,
      "mean_abs_diff": 1.286,
      "p99_abs_diff": 12.0,
      "frac_changed": 0.00532
    },
    "color_Q_vs_A": {
      "pixels_sampled": 178341,
      "deltaE_mean": 18.53,
      "deltaE_p95": 60.43
    },
    "letvice_A_estimate": 4,
    "letvice_Q_estimate": 5,
    "slat_period_A": 21,
    "slat_period_Q": 17,
    "slat_period_rel_diff": 0.19,
    "edge_profile_correlation": 0.1063
  }
}
```

### S6-T2-perspektiva / finalize
```json
{
  "jobId": "6d5945ee86114851b9bedb7b00e35e11",
  "projectId": "S6-T2-perspektiva",
  "status": "completed",
  "createdAt": 1790189212.8478465,
  "startedAt": 1790189212.8483126,
  "finishedAt": 1790189213.2581794,
  "error": null,
  "generation_time_s": 0.09,
  "vram_peak_mib": null,
  "vram_total_mib": null,
  "ram_peak_mib": null,
  "gpu_name": null,
  "seed": 250902,
  "steps": 40,
  "true_cfg_scale": 4.0,
  "negative_prompt": " ",
  "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
  "width": 1296,
  "height": 960,
  "model_load_s": 0.0,
  "mock": true,
  "mock_note": "MOCK izhod — dokazuje pogodbo API-ja in determinizem, NE kakovosti Qwen-a (spec §19)",
  "determinism_note": "mock: isti seed + isti vhodi = bajtno identičen izhod",
  "model": "mock-composite",
  "mode": "finalize",
  "resolution_label": "final",
  "queue_wait_s": 0.0,
  "total_job_s": 0.41,
  "device": "cpu",
  "backend_mode": "mock",
  "api_contract": "S+6 §20",
  "request": {
    "projectId": "S6-T2-perspektiva",
    "original": "<b64>",
    "product": "<b64>",
    "mask": "<b64>",
    "aPreview": "<b64>",
    "mode": "finalize",
    "placement": {
      "corners": [
        [
          0.347,
          0.588
        ],
        [
          0.612,
          0.58
        ],
        [
          0.614,
          0.748
        ],
        [
          0.349,
          0.756
        ]
      ]
    },
    "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
    "seed": 250902,
    "resolution": "final",
    "steps": 40,
    "trueCfg": 4.0
  },
  "test_id": "S6-T2-perspektiva",
  "note_resolution_resized_for_metrics": true,
  "metrics": {
    "sanity_A_vs_original": {
      "pixels_outside": 1182365,
      "mean_abs_diff": 0.655,
      "p99_abs_diff": 5.67,
      "frac_changed": 0.000323
    },
    "background_preservation_Q_vs_A": {
      "pixels_outside": 1182365,
      "mean_abs_diff": 3.513,
      "p99_abs_diff": 20.67,
      "frac_changed": 0.028463
    },
    "color_Q_vs_A": {
      "pixels_sampled": 153898,
      "deltaE_mean": 3.19,
      "deltaE_p95": 8.41
    },
    "letvice_A_estimate": 3,
    "letvice_Q_estimate": 3,
    "slat_period_A": 21,
    "slat_period_Q": 20,
    "slat_period_rel_diff": 0.048,
    "edge_profile_correlation": 0.9879
  }
}
```

### S6-T2-perspektiva / compose
```json
{
  "jobId": "b06a65f3e6ac4ceea10c1f9f97a9ca77",
  "projectId": "S6-T2-perspektiva",
  "status": "completed",
  "createdAt": 1790189214.9273472,
  "startedAt": 1790189214.9278095,
  "finishedAt": 1790189215.4652708,
  "error": null,
  "generation_time_s": 0.2,
  "vram_peak_mib": null,
  "vram_total_mib": null,
  "ram_peak_mib": null,
  "gpu_name": null,
  "seed": 250902,
  "steps": 40,
  "true_cfg_scale": 4.0,
  "negative_prompt": " ",
  "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
  "width": 1296,
  "height": 960,
  "model_load_s": 0.0,
  "mock": true,
  "mock_note": "MOCK izhod — dokazuje pogodbo API-ja in determinizem, NE kakovosti Qwen-a (spec §19)",
  "determinism_note": "mock: isti seed + isti vhodi = bajtno identičen izhod",
  "model": "mock-composite",
  "mode": "compose",
  "resolution_label": "final",
  "queue_wait_s": 0.0,
  "total_job_s": 0.54,
  "device": "cpu",
  "backend_mode": "mock",
  "api_contract": "S+6 §20",
  "request": {
    "projectId": "S6-T2-perspektiva",
    "original": "<b64>",
    "product": "<b64>",
    "mask": "<b64>",
    "aPreview": "<b64>",
    "mode": "compose",
    "placement": {
      "corners": [
        [
          0.347,
          0.588
        ],
        [
          0.612,
          0.58
        ],
        [
          0.614,
          0.748
        ],
        [
          0.349,
          0.756
        ]
      ]
    },
    "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
    "seed": 250902,
    "resolution": "final",
    "steps": 40,
    "trueCfg": 4.0
  },
  "test_id": "S6-T2-perspektiva",
  "note_resolution_resized_for_metrics": true,
  "metrics": {
    "sanity_A_vs_original": {
      "pixels_outside": 1182365,
      "mean_abs_diff": 0.655,
      "p99_abs_diff": 5.67,
      "frac_changed": 0.000323
    },
    "background_preservation_Q_vs_A": {
      "pixels_outside": 1182365,
      "mean_abs_diff": 2.125,
      "p99_abs_diff": 12.0,
      "frac_changed": 0.004077
    },
    "color_Q_vs_A": {
      "pixels_sampled": 153898,
      "deltaE_mean": 16.45,
      "deltaE_p95": 52.51
    },
    "letvice_A_estimate": 3,
    "letvice_Q_estimate": 5,
    "slat_period_A": 21,
    "slat_period_Q": 17,
    "slat_period_rel_diff": 0.19,
    "edge_profile_correlation": 0.0768
  }
}
```

### S6-T3-osvetlitev / finalize
```json
{
  "jobId": "12ee7b3ad06f4a2fac73d310a116e1e7",
  "projectId": "S6-T3-osvetlitev",
  "status": "completed",
  "createdAt": 1790189216.9884148,
  "startedAt": 1790189216.9888725,
  "finishedAt": 1790189217.2987657,
  "error": null,
  "generation_time_s": 0.05,
  "vram_peak_mib": null,
  "vram_total_mib": null,
  "ram_peak_mib": null,
  "gpu_name": null,
  "seed": 250903,
  "steps": 40,
  "true_cfg_scale": 4.0,
  "negative_prompt": " ",
  "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
  "width": 736,
  "height": 1200,
  "model_load_s": 0.0,
  "mock": true,
  "mock_note": "MOCK izhod — dokazuje pogodbo API-ja in determinizem, NE kakovosti Qwen-a (spec §19)",
  "determinism_note": "mock: isti seed + isti vhodi = bajtno identičen izhod",
  "model": "mock-composite",
  "mode": "finalize",
  "resolution_label": "final",
  "queue_wait_s": 0.0,
  "total_job_s": 0.31,
  "device": "cpu",
  "backend_mode": "mock",
  "api_contract": "S+6 §20",
  "request": {
    "projectId": "S6-T3-osvetlitev",
    "original": "<b64>",
    "product": "<b64>",
    "mask": "<b64>",
    "aPreview": "<b64>",
    "mode": "finalize",
    "placement": {
      "corners": [
        [
          0.205,
          0.372
        ],
        [
          0.823,
          0.356
        ],
        [
          0.828,
          0.592
        ],
        [
          0.21,
          0.607
        ]
      ]
    },
    "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
    "seed": 250903,
    "resolution": "final",
    "steps": 40,
    "trueCfg": 4.0
  },
  "test_id": "S6-T3-osvetlitev",
  "note_resolution_resized_for_metrics": true,
  "metrics": {
    "sanity_A_vs_original": {
      "pixels_outside": 740205,
      "mean_abs_diff": 0.606,
      "p99_abs_diff": 13.0,
      "frac_changed": 0.007295
    },
    "background_preservation_Q_vs_A": {
      "pixels_outside": 740205,
      "mean_abs_diff": 1.898,
      "p99_abs_diff": 13.67,
      "frac_changed": 0.00624
    },
    "color_Q_vs_A": {
      "pixels_sampled": 153981,
      "deltaE_mean": 2.55,
      "deltaE_p95": 6.82
    },
    "letvice_A_estimate": 15,
    "letvice_Q_estimate": 16,
    "slat_period_A": 4,
    "slat_period_Q": 4,
    "slat_period_rel_diff": 0.0,
    "edge_profile_correlation": 0.9866
  }
}
```

### S6-T3-osvetlitev / compose
```json
{
  "jobId": "1aba9ea888194f13b6f3fd35708df5f8",
  "projectId": "S6-T3-osvetlitev",
  "status": "completed",
  "createdAt": 1790189219.0449998,
  "startedAt": 1790189219.0454435,
  "finishedAt": 1790189219.4241397,
  "error": null,
  "generation_time_s": 0.13,
  "vram_peak_mib": null,
  "vram_total_mib": null,
  "ram_peak_mib": null,
  "gpu_name": null,
  "seed": 250903,
  "steps": 40,
  "true_cfg_scale": 4.0,
  "negative_prompt": " ",
  "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
  "width": 736,
  "height": 1200,
  "model_load_s": 0.0,
  "mock": true,
  "mock_note": "MOCK izhod — dokazuje pogodbo API-ja in determinizem, NE kakovosti Qwen-a (spec §19)",
  "determinism_note": "mock: isti seed + isti vhodi = bajtno identičen izhod",
  "model": "mock-composite",
  "mode": "compose",
  "resolution_label": "final",
  "queue_wait_s": 0.0,
  "total_job_s": 0.38,
  "device": "cpu",
  "backend_mode": "mock",
  "api_contract": "S+6 §20",
  "request": {
    "projectId": "S6-T3-osvetlitev",
    "original": "<b64>",
    "product": "<b64>",
    "mask": "<b64>",
    "aPreview": "<b64>",
    "mode": "compose",
    "placement": {
      "corners": [
        [
          0.205,
          0.372
        ],
        [
          0.823,
          0.356
        ],
        [
          0.828,
          0.592
        ],
        [
          0.21,
          0.607
        ]
      ]
    },
    "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
    "seed": 250903,
    "resolution": "final",
    "steps": 40,
    "trueCfg": 4.0
  },
  "test_id": "S6-T3-osvetlitev",
  "note_resolution_resized_for_metrics": true,
  "metrics": {
    "sanity_A_vs_original": {
      "pixels_outside": 740205,
      "mean_abs_diff": 0.606,
      "p99_abs_diff": 13.0,
      "frac_changed": 0.007295
    },
    "background_preservation_Q_vs_A": {
      "pixels_outside": 740205,
      "mean_abs_diff": 1.446,
      "p99_abs_diff": 13.0,
      "frac_changed": 0.006327
    },
    "color_Q_vs_A": {
      "pixels_sampled": 153981,
      "deltaE_mean": 18.67,
      "deltaE_p95": 56.49
    },
    "letvice_A_estimate": 15,
    "letvice_Q_estimate": 5,
    "slat_period_A": 4,
    "slat_period_Q": 17,
    "slat_period_rel_diff": 3.25,
    "edge_profile_correlation": 0.1648
  }
}
```

### S6-T4-occlusion-rastlinje / finalize
```json
{
  "jobId": "4af83f0c961b4cf4a5fb69eccc9683e7",
  "projectId": "S6-T4-occlusion-rastlinje",
  "status": "completed",
  "createdAt": 1790189221.099069,
  "startedAt": 1790189221.0995262,
  "finishedAt": 1790189221.500329,
  "error": null,
  "generation_time_s": 0.09,
  "vram_peak_mib": null,
  "vram_total_mib": null,
  "ram_peak_mib": null,
  "gpu_name": null,
  "seed": 250904,
  "steps": 40,
  "true_cfg_scale": 4.0,
  "negative_prompt": " ",
  "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
  "width": 864,
  "height": 1392,
  "model_load_s": 0.0,
  "mock": true,
  "mock_note": "MOCK izhod — dokazuje pogodbo API-ja in determinizem, NE kakovosti Qwen-a (spec §19)",
  "determinism_note": "mock: isti seed + isti vhodi = bajtno identičen izhod",
  "model": "mock-composite",
  "mode": "finalize",
  "resolution_label": "final",
  "queue_wait_s": 0.0,
  "total_job_s": 0.4,
  "device": "cpu",
  "backend_mode": "mock",
  "api_contract": "S+6 §20",
  "request": {
    "projectId": "S6-T4-occlusion-rastlinje",
    "original": "<b64>",
    "product": "<b64>",
    "mask": "<b64>",
    "aPreview": "<b64>",
    "mode": "finalize",
    "placement": {
      "corners": [
        [
          0.355,
          0.56
        ],
        [
          0.885,
          0.505
        ],
        [
          0.89,
          0.76
        ],
        [
          0.36,
          0.785
        ]
      ]
    },
    "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
    "seed": 250904,
    "resolution": "final",
    "steps": 40,
    "trueCfg": 4.0
  },
  "test_id": "S6-T4-occlusion-rastlinje",
  "note_resolution_resized_for_metrics": true,
  "metrics": {
    "sanity_A_vs_original": {
      "pixels_outside": 1040219,
      "mean_abs_diff": 0.518,
      "p99_abs_diff": 3.0,
      "frac_changed": 8.8e-05
    },
    "background_preservation_Q_vs_A": {
      "pixels_outside": 1040219,
      "mean_abs_diff": 3.959,
      "p99_abs_diff": 23.0,
      "frac_changed": 0.033394
    },
    "color_Q_vs_A": {
      "pixels_sampled": 180921,
      "deltaE_mean": 2.48,
      "deltaE_p95": 6.32
    },
    "letvice_A_estimate": 3,
    "letvice_Q_estimate": 3,
    "slat_period_A": 21,
    "slat_period_Q": 21,
    "slat_period_rel_diff": 0.0,
    "edge_profile_correlation": 0.98,
    "occlusion_region_preservation_Q_vs_A": {
      "pixels_outside": 1117463,
      "mean_abs_diff": 4.003,
      "p99_abs_diff": 23.0,
      "frac_changed": 0.032781
    }
  }
}
```

### S6-T4-occlusion-rastlinje / compose
```json
{
  "jobId": "a2a9ae762ee1491b83eee08d2f6a661b",
  "projectId": "S6-T4-occlusion-rastlinje",
  "status": "completed",
  "createdAt": 1790189223.1710656,
  "startedAt": 1790189223.1715062,
  "finishedAt": 1790189223.6667423,
  "error": null,
  "generation_time_s": 0.16,
  "vram_peak_mib": null,
  "vram_total_mib": null,
  "ram_peak_mib": null,
  "gpu_name": null,
  "seed": 250904,
  "steps": 40,
  "true_cfg_scale": 4.0,
  "negative_prompt": " ",
  "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
  "width": 864,
  "height": 1392,
  "model_load_s": 0.0,
  "mock": true,
  "mock_note": "MOCK izhod — dokazuje pogodbo API-ja in determinizem, NE kakovosti Qwen-a (spec §19)",
  "determinism_note": "mock: isti seed + isti vhodi = bajtno identičen izhod",
  "model": "mock-composite",
  "mode": "compose",
  "resolution_label": "final",
  "queue_wait_s": 0.0,
  "total_job_s": 0.49,
  "device": "cpu",
  "backend_mode": "mock",
  "api_contract": "S+6 §20",
  "request": {
    "projectId": "S6-T4-occlusion-rastlinje",
    "original": "<b64>",
    "product": "<b64>",
    "mask": "<b64>",
    "aPreview": "<b64>",
    "mode": "compose",
    "placement": {
      "corners": [
        [
          0.355,
          0.56
        ],
        [
          0.885,
          0.505
        ],
        [
          0.89,
          0.76
        ],
        [
          0.36,
          0.785
        ]
      ]
    },
    "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
    "seed": 250904,
    "resolution": "final",
    "steps": 40,
    "trueCfg": 4.0
  },
  "test_id": "S6-T4-occlusion-rastlinje",
  "note_resolution_resized_for_metrics": true,
  "metrics": {
    "sanity_A_vs_original": {
      "pixels_outside": 1040219,
      "mean_abs_diff": 0.518,
      "p99_abs_diff": 3.0,
      "frac_changed": 8.8e-05
    },
    "background_preservation_Q_vs_A": {
      "pixels_outside": 1040219,
      "mean_abs_diff": 2.42,
      "p99_abs_diff": 13.67,
      "frac_changed": 0.004925
    },
    "color_Q_vs_A": {
      "pixels_sampled": 180921,
      "deltaE_mean": 19.2,
      "deltaE_p95": 58.59
    },
    "letvice_A_estimate": 3,
    "letvice_Q_estimate": 5,
    "slat_period_A": 21,
    "slat_period_Q": 17,
    "slat_period_rel_diff": 0.19,
    "edge_profile_correlation": 0.077,
    "occlusion_region_preservation_Q_vs_A": {
      "pixels_outside": 1117463,
      "mean_abs_diff": 5.337,
      "p99_abs_diff": 94.67,
      "frac_changed": 0.051062
    }
  }
}
```

### S6-T5-svetlo-ozadje / finalize
```json
{
  "jobId": "d79830128ec747aaad3c5dcc415fd5a3",
  "projectId": "S6-T5-svetlo-ozadje",
  "status": "completed",
  "createdAt": 1790189225.2492979,
  "startedAt": 1790189225.2497993,
  "finishedAt": 1790189225.6673226,
  "error": null,
  "generation_time_s": 0.09,
  "vram_peak_mib": null,
  "vram_total_mib": null,
  "ram_peak_mib": null,
  "gpu_name": null,
  "seed": 250905,
  "steps": 40,
  "true_cfg_scale": 4.0,
  "negative_prompt": " ",
  "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
  "width": 736,
  "height": 1200,
  "model_load_s": 0.0,
  "mock": true,
  "mock_note": "MOCK izhod — dokazuje pogodbo API-ja in determinizem, NE kakovosti Qwen-a (spec §19)",
  "determinism_note": "mock: isti seed + isti vhodi = bajtno identičen izhod",
  "model": "mock-composite",
  "mode": "finalize",
  "resolution_label": "final",
  "queue_wait_s": 0.0,
  "total_job_s": 0.42,
  "device": "cpu",
  "backend_mode": "mock",
  "api_contract": "S+6 §20",
  "request": {
    "projectId": "S6-T5-svetlo-ozadje",
    "original": "<b64>",
    "product": "<b64>",
    "mask": "<b64>",
    "aPreview": "<b64>",
    "mode": "finalize",
    "placement": {
      "corners": [
        [
          0.185,
          0.25
        ],
        [
          0.83,
          0.25
        ],
        [
          0.83,
          0.605
        ],
        [
          0.185,
          0.605
        ]
      ]
    },
    "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
    "seed": 250905,
    "resolution": "final",
    "steps": 40,
    "trueCfg": 4.0
  },
  "test_id": "S6-T5-svetlo-ozadje",
  "note_resolution_resized_for_metrics": true,
  "metrics": {
    "sanity_A_vs_original": {
      "pixels_outside": 655804,
      "mean_abs_diff": 0.508,
      "p99_abs_diff": 9.0,
      "frac_changed": 0.006249
    },
    "background_preservation_Q_vs_A": {
      "pixels_outside": 655804,
      "mean_abs_diff": 1.748,
      "p99_abs_diff": 12.67,
      "frac_changed": 0.005492
    },
    "color_Q_vs_A": {
      "pixels_sampled": 156602,
      "deltaE_mean": 2.01,
      "deltaE_p95": 4.56
    },
    "letvice_A_estimate": 12,
    "letvice_Q_estimate": 12,
    "slat_period_A": 19,
    "slat_period_Q": 21,
    "slat_period_rel_diff": 0.105,
    "edge_profile_correlation": 0.9882
  }
}
```

### S6-T5-svetlo-ozadje / compose
```json
{
  "jobId": "7efb729afe8d4b88bdec8a527bab6984",
  "projectId": "S6-T5-svetlo-ozadje",
  "status": "completed",
  "createdAt": 1790189227.302049,
  "startedAt": 1790189227.302484,
  "finishedAt": 1790189227.6662638,
  "error": null,
  "generation_time_s": 0.11,
  "vram_peak_mib": null,
  "vram_total_mib": null,
  "ram_peak_mib": null,
  "gpu_name": null,
  "seed": 250905,
  "steps": 40,
  "true_cfg_scale": 4.0,
  "negative_prompt": " ",
  "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
  "width": 736,
  "height": 1200,
  "model_load_s": 0.0,
  "mock": true,
  "mock_note": "MOCK izhod — dokazuje pogodbo API-ja in determinizem, NE kakovosti Qwen-a (spec §19)",
  "determinism_note": "mock: isti seed + isti vhodi = bajtno identičen izhod",
  "model": "mock-composite",
  "mode": "compose",
  "resolution_label": "final",
  "queue_wait_s": 0.0,
  "total_job_s": 0.36,
  "device": "cpu",
  "backend_mode": "mock",
  "api_contract": "S+6 §20",
  "request": {
    "projectId": "S6-T5-svetlo-ozadje",
    "original": "<b64>",
    "product": "<b64>",
    "mask": "<b64>",
    "aPreview": "<b64>",
    "mode": "compose",
    "placement": {
      "corners": [
        [
          0.185,
          0.25
        ],
        [
          0.83,
          0.25
        ],
        [
          0.83,
          0.605
        ],
        [
          0.185,
          0.605
        ]
      ]
    },
    "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
    "seed": 250905,
    "resolution": "final",
    "steps": 40,
    "trueCfg": 4.0
  },
  "test_id": "S6-T5-svetlo-ozadje",
  "note_resolution_resized_for_metrics": true,
  "metrics": {
    "sanity_A_vs_original": {
      "pixels_outside": 655804,
      "mean_abs_diff": 0.508,
      "p99_abs_diff": 9.0,
      "frac_changed": 0.006249
    },
    "background_preservation_Q_vs_A": {
      "pixels_outside": 655804,
      "mean_abs_diff": 1.326,
      "p99_abs_diff": 9.33,
      "frac_changed": 0.005538
    },
    "color_Q_vs_A": {
      "pixels_sampled": 156602,
      "deltaE_mean": 17.92,
      "deltaE_p95": 57.01
    },
    "letvice_A_estimate": 12,
    "letvice_Q_estimate": 5,
    "slat_period_A": 19,
    "slat_period_Q": 17,
    "slat_period_rel_diff": 0.105,
    "edge_profile_correlation": 0.1861
  }
}
```

### S6-T6-occlusion-drevo / finalize
```json
{
  "jobId": "615e6378b9204698b546d4b10514880d",
  "projectId": "S6-T6-occlusion-drevo",
  "status": "completed",
  "createdAt": 1790189229.3656986,
  "startedAt": 1790189229.366215,
  "finishedAt": 1790189229.782913,
  "error": null,
  "generation_time_s": 0.17,
  "vram_peak_mib": null,
  "vram_total_mib": null,
  "ram_peak_mib": null,
  "gpu_name": null,
  "seed": 250906,
  "steps": 40,
  "true_cfg_scale": 4.0,
  "negative_prompt": " ",
  "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
  "width": 1408,
  "height": 736,
  "model_load_s": 0.0,
  "mock": true,
  "mock_note": "MOCK izhod — dokazuje pogodbo API-ja in determinizem, NE kakovosti Qwen-a (spec §19)",
  "determinism_note": "mock: isti seed + isti vhodi = bajtno identičen izhod",
  "model": "mock-composite",
  "mode": "finalize",
  "resolution_label": "final",
  "queue_wait_s": 0.0,
  "total_job_s": 0.42,
  "device": "cpu",
  "backend_mode": "mock",
  "api_contract": "S+6 §20",
  "request": {
    "projectId": "S6-T6-occlusion-drevo",
    "original": "<b64>",
    "product": "<b64>",
    "mask": "<b64>",
    "aPreview": "<b64>",
    "mode": "finalize",
    "placement": {
      "corners": [
        [
          0.262,
          0.377
        ],
        [
          0.618,
          0.377
        ],
        [
          0.618,
          0.438
        ],
        [
          0.262,
          0.438
        ]
      ]
    },
    "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
    "seed": 250906,
    "resolution": "final",
    "steps": 40,
    "trueCfg": 4.0
  },
  "test_id": "S6-T6-occlusion-drevo",
  "note_resolution_resized_for_metrics": true,
  "metrics": {
    "sanity_A_vs_original": {
      "pixels_outside": 2378714,
      "mean_abs_diff": 0.503,
      "p99_abs_diff": 4.0,
      "frac_changed": 0.003551
    },
    "background_preservation_Q_vs_A": {
      "pixels_outside": 2378714,
      "mean_abs_diff": 4.94,
      "p99_abs_diff": 21.33,
      "frac_changed": 0.033334
    },
    "color_Q_vs_A": {
      "pixels_sampled": 153809,
      "deltaE_mean": 6.86,
      "deltaE_p95": 15.23
    },
    "letvice_A_estimate": 5,
    "letvice_Q_estimate": 3,
    "slat_period_A": 4,
    "slat_period_Q": 26,
    "slat_period_rel_diff": 5.5,
    "edge_profile_correlation": 0.6088,
    "occlusion_region_preservation_Q_vs_A": {
      "pixels_outside": 2443700,
      "mean_abs_diff": 5.138,
      "p99_abs_diff": 24.0,
      "frac_changed": 0.040541
    }
  }
}
```

### S6-T6-occlusion-drevo / compose
```json
{
  "jobId": "ae820fb1e86a4f0fbfa8eeaf7365f338",
  "projectId": "S6-T6-occlusion-drevo",
  "status": "completed",
  "createdAt": 1790189231.4463234,
  "startedAt": 1790189231.4467833,
  "finishedAt": 1790189231.8601844,
  "error": null,
  "generation_time_s": 0.15,
  "vram_peak_mib": null,
  "vram_total_mib": null,
  "ram_peak_mib": null,
  "gpu_name": null,
  "seed": 250906,
  "steps": 40,
  "true_cfg_scale": 4.0,
  "negative_prompt": " ",
  "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
  "width": 1408,
  "height": 736,
  "model_load_s": 0.0,
  "mock": true,
  "mock_note": "MOCK izhod — dokazuje pogodbo API-ja in determinizem, NE kakovosti Qwen-a (spec §19)",
  "determinism_note": "mock: isti seed + isti vhodi = bajtno identičen izhod",
  "model": "mock-composite",
  "mode": "compose",
  "resolution_label": "final",
  "queue_wait_s": 0.0,
  "total_job_s": 0.41,
  "device": "cpu",
  "backend_mode": "mock",
  "api_contract": "S+6 §20",
  "request": {
    "projectId": "S6-T6-occlusion-drevo",
    "original": "<b64>",
    "product": "<b64>",
    "mask": "<b64>",
    "aPreview": "<b64>",
    "mode": "compose",
    "placement": {
      "corners": [
        [
          0.262,
          0.377
        ],
        [
          0.618,
          0.377
        ],
        [
          0.618,
          0.438
        ],
        [
          0.262,
          0.438
        ]
      ]
    },
    "prompt": "Preserve the exact reference railing design, geometry, color and structure. Integrate it into the marked railing area while preserving the original architecture and surroundings.",
    "seed": 250906,
    "resolution": "final",
    "steps": 40,
    "trueCfg": 4.0
  },
  "test_id": "S6-T6-occlusion-drevo",
  "note_resolution_resized_for_metrics": true,
  "metrics": {
    "sanity_A_vs_original": {
      "pixels_outside": 2378714,
      "mean_abs_diff": 0.503,
      "p99_abs_diff": 4.0,
      "frac_changed": 0.003551
    },
    "background_preservation_Q_vs_A": {
      "pixels_outside": 2378714,
      "mean_abs_diff": 2.896,
      "p99_abs_diff": 14.0,
      "frac_changed": 0.005129
    },
    "color_Q_vs_A": {
      "pixels_sampled": 153809,
      "deltaE_mean": 18.43,
      "deltaE_p95": 50.15
    },
    "letvice_A_estimate": 5,
    "letvice_Q_estimate": 5,
    "slat_period_A": 4,
    "slat_period_Q": 13,
    "slat_period_rel_diff": 2.25,
    "edge_profile_correlation": 0.3112,
    "occlusion_region_preservation_Q_vs_A": {
      "pixels_outside": 2443700,
      "mean_abs_diff": 3.872,
      "p99_abs_diff": 40.0,
      "frac_changed": 0.023676
    }
  }
}
```

### S6-T1-ravna-antracit / finalize-repeat
```json
{
  "test_id": "S6-T1-ravna-antracit",
  "mode": "finalize-repeat",
  "status": "completed",
  "determinism": {
    "sha_first": "d8570d40108b191fbc1b0ba6402a0ec44821a7a9cd18100841a3cc5da9198b37",
    "sha_repeat": "d8570d40108b191fbc1b0ba6402a0ec44821a7a9cd18100841a3cc5da9198b37",
    "identical": true
  }
}
```
