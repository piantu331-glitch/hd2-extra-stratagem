# HD2 Extra Stratagem — per-stratagem extra choice

A [Bingus Shared Loader](https://github.com/CowboyBingus/HD2-BingusSharedLoader) addon for
**Helldivers 2** that lets you pick, **for each stratagem you carry, which additional
stratagem it delivers into the mission**.

25 dropdown groups × 24 choices each = 600 combinations, every group independent.

---

## ⚠️ Read this first

- **This modifies game memory at runtime.** That is a grey area: it can violate the
  game's Terms of Service and it carries an anti-cheat risk. **Use at your own risk.**
- **Client-side only.** Teammates do not see your extra stratagems.
- **Single-player / trusted friends recommended.**
- Nothing is written to disk. **All changes are restored when the game exits.**
- The addon verifies `game.dll` by SHA-256 and **refuses to run** on a build it does not
  recognise, so a game update cannot make it write to the wrong place.

---

## What it does

Every stratagem record in the game's stratagem settings table has a field at offset
`+200` meaning *"also grant this stratagem kind"*. The engine already uses it for 10 of
its own records. This addon writes a kind of your choosing into that field for the
stratagems you select.

So: **carry N stratagems that each have an extra assigned, and get N extra stratagems.**

---

## Install

1. Install **Bingus Shared Loader v15+** and enable addon support.
2. Import `dist/Extra-Full-25x24.zip` into your mod manager.
3. Pick one entry in **each of the 25 dropdowns** (they are independent).
4. Deploy, then launch the game.

Changing a selection requires re-deploying.

---

## The dropdowns

Each group is labelled `[kind] Short name`, for example:

```
[4] Orbital Gatling          <- pick one of 24
[18] Eagle Airstrike         <- pick one of 24
[66] Gatling Sentry          <- pick one of 24
[124] Reinforce              <- pick one of 24
```

The 24 choices in every group are the same 25 stratagems minus the host itself
(so nothing can bring itself).

| kind | Dropdown name | 中文名 |
|---|---|---|
| 1 | Tank | TD-220 “堡垒”坦克 |
| 3 | Eagle 500kg | “飞鹰”500KG炸弹 |
| 4 | Orbital Gatling | 轨道加特林火力网 |
| 10 | EXO-49 | EXO-49 “解放者”外骨骼装甲 |
| 18 | Eagle Airstrike | “飞鹰”空袭 |
| 23 | Laser Sentry | A/LAS-98 激光哨戒炮 |
| 26 | Supply FRV | M-103 补给型快速侦察载具 |
| 27 | EXO-45 | EXO-45 “爱国者”外骨骼装甲 |
| 30 | Eagle Strafing | “飞鹰”机枪扫射 |
| 46 | Gas Mines | MD-8 毒气地雷 |
| 53 | Rocket Sentry | A/MLS-4X 火箭哨戒炮 |
| 58 | Orbital Railcannon | 轨道炮攻击 |
| 65 | Eagle Cluster | “飞鹰”集束炸弹 |
| 66 | Gatling Sentry | A/G-16 加特林哨戒炮 |
| 74 | Orbital Smoke | 轨道烟雾攻击 |
| 88 | EXO-84 | EXO-84 “破门者”外骨骼装甲 |
| 91 | EXO-51 | EXO-51 “伐木者”外骨骼装甲 |
| 101 | Supply Pack | B-1 补给背包 |
| 105 | Recon FRV | M-102 快速侦察载具 |
| 106 | Orbital Napalm | 轨道凝固汽油弹火力网 |
| 107 | Orbital Laser | 轨道激光炮 |
| 121 | MG Sentry | A/MG-43 哨戒机枪 |
| 124 | Reinforce | 增援 |
| 137 | Autocannon Sentry | A/AC-8 自动哨戒炮 |
| 147 | EAT-17 | EAT-17 一次性反坦克武器 |

Full table with sources: [`docs/中文名对照表.md`](docs/中文名对照表.md)

---

## How the kinds were identified

This is the part worth documenting, because **guessing is easy and wrong**.

Every stratagem record stores the **name hash of its own assets**:

| offset | holds |
|---|---|
| `+168` | the stratagem's sound / effect asset |
| `+176` | the stratagem's icon asset |

Extracting the game with [Filediver](https://github.com/xypwn/filediver) gives the asset
list, which turns those hashes into file names that name the stratagem outright:

```
kind  58  +168 = orbital_railcannon     ->  Orbital Railcannon Strike
kind 121  +176 = ...turrets_machinegun  ->  A/MG-43 Machine Gun Sentry
```

No guessing, and the method survives game updates — see
[`docs/stratagem-kinds.md`](docs/stratagem-kinds.md) for the full procedure.

**An earlier attempt guessed the sentry kinds as 47/95/60 and the Eagles as
76/78/79/129. Both were completely wrong**, which is why an empirical test produced
nothing. The asset method is what actually works.

---

## Safety design

- `game.dll` SHA-256 verified before any write; unknown build ⇒ refuses to run.
- The 80280-byte settings blob is walked with the same bounds checks the reference
  addon uses, and must be exactly 80280 bytes with exactly 149 records.
- The blob is read **twice** and compared immediately before writing.
- Only the single `+200` dword of the selected records is touched.
- Records whose `+200` is non-zero are **skipped, never overwritten** — except the four
  Eagles the engine already assigns an extra to, which this deliberately replaces
  (count unchanged, content becomes your choice).
- Writes go only to private/mapped writable pages; **`MEM_IMAGE` is refused**, so
  executable code is never modified.
- Every write is read back and verified.
- All original values are restored on shutdown.

---

## Known limits

- **Four hosts are engine-owned records** (Eagles 18/30/65/3, originally `+200 = 49`).
  Assigning them an extra replaces the engine's default grant. The *number* of extras
  is unchanged.
- **The host must be equipped** for its extra to appear — the extra rides along with
  the host.
- A host cannot bring itself; those pairs are excluded from the manifest.
- **Resupply could not be identified**: it has neither an icon nor a sound asset, so
  the hash method cannot reach it. It is deliberately absent rather than guessed.

---

## Credits

- **Suzuka** — [helldivers-2-extra-slot](https://github.com/Suzuka2788/helldivers-2-extra-slot).
  The `+200` "extra stratagem" mechanism and 12 of the named kinds come from that
  project, and its manifest layout is the model for this one. **If you reuse this,
  credit Suzuka and consider asking first.**
- **xypwn** — [Filediver](https://github.com/xypwn/filediver), the extractor used to
  identify every stratagem kind here.
- **CowboyBingus** — the shared loader this addon runs under.

---

## Repo layout

```
dist/     the built addon zip
docs/     kind reference, asset-identification method, name tables
src/      extra_exact.lua -- the template every generated script derives from
tools/    generator, packer and verifier
```

---

## Rebuilding

```sh
node tools/gen_grid3.js      # writes build/grid3.json + 600 entry scripts
node tools/build_addon.js \
  --name mods/dsh/extra_full \
  --choices build/grid3.json \
  --guid <your-uuid> \
  --display-name "Full Stratagem Choice" \
  --output dist/Extra-Full-25x24.zip
node tools/verify_short.js dist/Extra-Full-25x24.zip
```

The verifier checks all 600 leaves: that every archive exists, unwraps, targets the
intended host/grant pair, and that **each dropdown label matches the script behind it**.

---

## License

MIT for the code in this repo. Third-party credits above remain with their authors.