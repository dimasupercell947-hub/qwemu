# QWEMU MUSIC — историческое происхождение исходной Rust-ветки

Stage 6 was created in a new working directory from the verified QWEMU PC 0.6.0 BETA source tree. The following source archives were available, ZIP-tested, extracted read-only and compared during the audit:

| Source archive | SHA-256 | Use |
|---|---|---|
| `QWEMU_PC_0.5.1_BETA.zip` (uploaded duplicate-safe filename `QWEMU_PC_0.5.1_BETA(1).zip`) | `703fba927e195ec95fc0cf3c23733e1e2a6f6367cc3d60aaea8e31b13e9da359` | Original UI, behavior, profile/library compatibility and 0.5.1 fixes |
| `QWEMU_PC_0.5.0_STABLE_RUST_STAGE1.zip` | `a1dd376fc0dcd87b6fb54f1e51d756c5f6467594077affbd357ceac188216066` | Intermediate Tauri 2/Rust migration scaffold |
| `QWEMU_PC_0.5.0_RELEASE_FULL_AUDIT_FIX.zip` | `277b2c72108cdf6da45bb24176b7d7a539586fd95c965bc38c93245a5d1a8055` | Audited Rust API, SQLite and native library baseline |
| `QWEMU_PC_0.5.1_BETA_RUST_STAGE4.zip` | `5cf06662519635a9260150735c5208244971d3a2c1e6f71600e844fd5bd7c9d4` | In-app browser, native download and streaming migration stage |
| `QWEMU_PC_0.6.0_BETA.zip` | `760180adc37689675f2466e07bc8303b9c5569ff309f9ab8069923a855bf82ee` | Immediate Stage 6 working base |

All source archives were preserved. Stage 6 was created as a separate project and archive; no previous working build or source ZIP was overwritten.

No personal SQLite database, IndexedDB export, music library folder, profile database or account data file was supplied. Therefore Stage 6 updates the migration implementation but does not claim to have migrated a real personal data set.
