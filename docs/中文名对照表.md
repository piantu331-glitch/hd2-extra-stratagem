# HD2 战略配备 kind 编号 —— 识别方法与结果

> 这份文档记录**怎么查**，游戏更新后可以照做一遍。

---

## 一、核心发现

**每条战略配备记录里存着它自己的资源名哈希：**

| 记录偏移 | 内容 |
|---|---|
| **`+168`** | 音效 / 特效资源名哈希 |
| **`+176`** | 图标资源名哈希 |

**把哈希和游戏资源列表一对，技能名字就出来了。**

**149 条里 88 条能这样解出名字。**

---

## 二、完整流程

### 1. 下载 Filediver（社区解包器）

```
https://github.com/xypwn/filediver/releases/latest
→ filediver-cli-windows.zip
```

解压后 `ffmpeg.exe` 和 `filediver.exe` 放一起。

### 2. 导出资源列表（拿到 名称 → 哈希 对照）

```powershell
cd <filediver目录>
.\filediver.exe --gamedir "C:\AAAyingyong\steam\steamapps\common\Helldivers 2" `
                --list -i "*stratagem*" > stratagem_list.txt
.\filediver.exe --gamedir "..." --list -i "*eagle*"     > eagle_list.txt
.\filediver.exe --gamedir "..." --list -i "*orbital*"   > orbital_list.txt
```

> ⚠️ PowerShell 重定向会写成 **UTF-16**，读的时候要 `.toString('utf16le')`。
> ⚠️ **不能用 Node 的 `execFileSync` 抓输出** —— 沙箱禁止管道 stdio（EPERM）。

输出格式：

```
content/audio/stratagems_orbital_gatling_barrage.wwise_bank, 0x<hash>.0x<type>
```

### 3. 从游戏内存 dump 记录（`+168` / `+176`）

用只读探针读 `*(game.dll + 0x348E8F8)` 那块 80280 字节，按 400 字节一条切，
取每条的 `+168` 和 `+176`。

### 4. 配对

`+168`/`+176` 的值 → 资源名 → **就是技能的名字**。

---

## 三、解出的 12 个（已实测可用）

| kind | 技能 | 依据资源 |
|---|---|---|
| **4** | 轨道加特林火力网 | `orbital_gatling_barrage` |
| **106** | 轨道凝固汽油弹火力网 | `orbital_napalm_barrage` |
| **58** | 轨道炮攻击 | `orbital_railcannon` |
| **18** | 飞鹰空袭 | `eagle_airstrike` |
| **30** | 飞鹰机枪扫射 | `eagle_base` |
| **65** | 飞鹰集束炸弹 | `eagle_clusterbombs` |
| **3** | 飞鹰 500KG | `eagle_bomb` |
| **101** | B-1 Supply Pack | `icon_...supportbackpack_ammo` |
| **121** | A/MG-43 机枪哨戒炮 | `icon_...turrets_machinegun` |
| **66** | A/G-16 加特林哨戒炮 | `icon_...turrets_gatling` |
| **53** | A/MLS-4X 火箭哨戒炮 | `icon_...turrets_rocket` |
| **46** | MD-8 毒气地雷 | `icon_...gas_mine` |

**完整 88 条见 `stratagem_kinds.json`。**

---

## 四、其它已确认的 kind

| kind | 技能 | 来源 |
|---|---|---|
| 124 | Reinforce（增援） | Suzuka mod 的 `expected` 表 |
| 1 | Tank | Suzuka mod |
| 10 / 27 / 88 / 91 | EXO-49 / 45 / 84 / 51 | 图标 |
| 26 / 105 / 135 | M-103 / M-102 / M-104 载具 | 图标 |
| 137 / 117 / 44 / 52 / 23 / 8 | 各型哨戒炮 | 图标 |

---

## 五、关键机制：`+200` 字段

**写一个 kind 进 `+200`，该技能就额外带一个那个战略配备。**

| 事实 | 说明 |
|---|---|
| 类型 | **标量**（写 4 个值只出 1 个，已实测） |
| 可叠加 | **可以** —— 带 N 个挂了额外的技能 → N 个额外 |
| 引擎自己用了 10 条 | kinds 30, 3, 140, 18, 133, 65, 38, 126, 35, 146（值都是 49） |
| **危险** | **全量 149 条一起改会把配装搞崩**（实测，技能全消失） |
| 安全范围 | **十几条以内**，且要有明确依据 |

---

## 六、踩过的坑（避免重犯）

| 坑 | 教训 |
|---|---|
| 全量 149 条 | **会崩配装**，只改必要的那几条 |
| 靠猜 kind | 猜的哨戒炮/飞鹰**全错**（47,95,60 / 76,78,79,129） |
| 「加了没反应」当判据 | **无效** —— 非装备项加了也没反应，推不出结论 |
| 用 mod 的 `+56` 分类 | 只能分出轨道类，剩下 117 条分不开 |
| 用 `+104` 浮点分组 | **巧合**，不是分类键 |
| 手写 hex 字面量 | **必须用脚本生成**，手分会掉字节 |
| Node 抓子进程输出 | 沙箱 EPERM，**用 PowerShell 重定向** |
| 读 UTF-16 文件 | 要 `toString('utf16le')` |

---

## 七、游戏更新后怎么办

1. **先看 `game.dll` SHA-256** —— 变了就说明版本更新了
2. 记录结构（400 字节、`+168`/`+176`）**很稳定**，通常不用改
3. **重新跑一遍上面的流程**，重新导出资源列表
4. 用新的 `kind` 更新 mod 里的 `TARGETS` 表

**判别是否对上的方法**：`+168`/`+176` 解出的名字**和你要的技能一致**，就是对的。

---

## 八、环境速查

| 项 | 值 |
|---|---|
| 游戏根目录 | `C:\AAAyingyong\steam\steamapps\common\Helldivers 2` |
| 战略配备设置槽位 | `*(game.dll + 0x348E8F8)` |
| blob 大小 | 80280 字节 |
| 记录大小 | 400 字节 |
| 组数 | 11 个 LDLD 组，共 149 条 |
| `+0` | kind |
| `+4` | id |
| `+168` | 音效资源名哈希 |
| `+176` | 图标资源名哈希 |
| `+200` | **额外战略配备**（标量） |
| `game.dll` SHA-256 | `2e2c3b7c2500646dadd5f2b4c6e0504dbb7e7896139f64cddc0d1813c718f51e` |
| 版本 | 25480438 / exe 1.8.46015.0 |
