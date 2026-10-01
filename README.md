# HD2 Extra Stratagem — 25×24 下拉菜单

给《绝地潜兵 2》用的 **Lua 注入式 mod**（跑在 [Bingus Shared Loader](https://github.com/CowboyBingus/HD2-BingusSharedLoader) 上）。

**让你带的战略配备，额外再带一个战略配备。**

```
25 个独立 mod × 每个 24 个选项 = 600 种组合
```

---

## ⚠️ 使用前必读

| 项 | 说明 |
|---|---|
| **反作弊风险** | 运行时修改游戏内存，**可能违反游戏 ToS** |
| **仅客户端生效** | 队友**看不到**你的额外战略配备 |
| **建议场景** | 单人 / 知情固定队 |
| **是否写磁盘** | **否**，退出游戏**完全还原** |
| **版本变更** | 校验 `game.dll` SHA-256，**不符则拒绝运行** |
| **责任** | 自担风险 |

**不建议在公开匹配中使用。**

---

## 这是什么

《绝地潜兵 2》每条战略配备记录里有个字段（`+200`），存着「这条技能额外附带哪个战略配备」。

引擎自己已经在用这个字段（10 条记录，值都是 `49`）。

**本 mod 只是给「你指定的技能」也写上值。**

```
哨戒机枪   +200 = 88   →  带哨戒机枪时，额外多拿一个 EXO-84 破门者
飞鹰空袭   +200 = 106  →  带飞鹰空袭时，额外多拿一个轨道凝固汽油弹
```

**带 N 个挂了额外的技能 → 多拿 N 个。**

---

## ★ 最重要的一条规则

> **授予的战略配备，只有你「还没有」的时候才看得见。**

| 情况 | 能否看见 |
|---|---|
| 授予的配备**你已经解锁** | ✅ **看得见**（多一个槽位） |
| 授予的配备**你正好装备着** | ❌ **看不见**（重复） |
| 授予的配备**你还没解锁** | ✅ **看得见** |

**所以：选授予的时候，挑你还没有的。** 机甲/载具类（EXO-45/49/51/84、补给FRV、侦察FRV、EAT-17、坦克）最容易看到效果。

> 这一条是理解整个 mod 的关键 —— 也是开发过程中花了最久才确认的事实。

---

## 安装

### 前置

- **Bingus Shared Loader v15+**，并开启 addon 支持
- 日志在 `BingusSharedLoader.log`，能看到 `API 1`

### 步骤

1. **彻底退出游戏**（结束进程，不是回主菜单）
2. **删掉旧的 Extra 相关条目**（避免多套系统互相覆盖）
3. 从 `dist/25x24/` 导入你想要的 mod —— **每个技能一个 zip**
4. 每个 mod 会显示**自己的下拉菜单**，各选一个
5. **Deploy** → 启动游戏

**改选择要重新 Deploy。**

---

## 25 个下拉

| 文件 | 管理器显示 | 中文名 |
|---|---|---|
| `001 Tank.zip` | Extra [001] Tank | TD-220 “堡垒”坦克 |
| `003 Eagle 500kg.zip` | Extra [003] Eagle 500kg | “飞鹰”500KG炸弹 |
| `004 Orbital Gatling.zip` | Extra [004] Orbital Gatling | 轨道加特林火力网 |
| `010 EXO-49.zip` | Extra [010] EXO-49 | EXO-49 “解放者”外骨骼装甲 |
| `018 Eagle Airstrike.zip` | Extra [018] Eagle Airstrike | “飞鹰”空袭 |
| `023 Laser Sentry.zip` | Extra [023] Laser Sentry | A/LAS-98 激光哨戒炮 |
| `026 Supply FRV.zip` | Extra [026] Supply FRV | M-103 补给型快速侦察载具 |
| `027 EXO-45.zip` | Extra [027] EXO-45 | EXO-45 “爱国者”外骨骼装甲 |
| `030 Eagle Strafing.zip` | Extra [030] Eagle Strafing | “飞鹰”机枪扫射 |
| `046 Gas Mines.zip` | Extra [046] Gas Mines | MD-8 毒气地雷 |
| `053 Rocket Sentry.zip` | Extra [053] Rocket Sentry | A/MLS-4X 火箭哨戒炮 |
| `058 Orbital Railcannon.zip` | Extra [058] Orbital Railcannon | 轨道炮攻击 |
| `065 Eagle Cluster.zip` | Extra [065] Eagle Cluster | “飞鹰”集束炸弹 |
| `066 Gatling Sentry.zip` | Extra [066] Gatling Sentry | A/G-16 加特林哨戒炮 |
| `074 Orbital Smoke.zip` | Extra [074] Orbital Smoke | 轨道烟雾攻击 |
| `088 EXO-84.zip` | Extra [088] EXO-84 | EXO-84 “破门者”外骨骼装甲 |
| `091 EXO-51.zip` | Extra [091] EXO-51 | EXO-51 “伐木者”外骨骼装甲 |
| `101 Supply Pack.zip` | Extra [101] Supply Pack | B-1 补给背包 |
| `105 Recon FRV.zip` | Extra [105] Recon FRV | M-102 快速侦察载具 |
| `106 Orbital Napalm.zip` | Extra [106] Orbital Napalm | 轨道凝固汽油弹火力网 |
| `107 Orbital Laser.zip` | Extra [107] Orbital Laser | 轨道激光炮 |
| `121 MG Sentry.zip` | Extra [121] MG Sentry | A/MG-43 哨戒机枪 |
| `124 Reinforce.zip` | Extra [124] Reinforce | 增援 |
| `137 Autocannon Sentry.zip` | Extra [137] Autocannon Sentry | A/AC-8 自动哨戒炮 |
| `147 EAT-17.zip` | Extra [147] EAT-17 | EAT-17 一次性反坦克武器 |

**编号 = 游戏内部的 kind 编号**，和 `docs/中文名对照表.md` 一一对应。

---

## 下拉长什么样

以 `018 Eagle Airstrike.zip` 为例：

```
What Eagle Airstrike brings
  ├─ Bring [001] Tank
  ├─ Bring [003] Eagle 500kg
  ├─ Bring [004] Orbital Gatling
  ├─ Bring [010] EXO-49
  ├─ Bring [023] Laser Sentry
  ├─ ...
  └─ Bring [147] EAT-17
```

**24 项，按编号升序，统一 `Bring` 开头** —— 一眼看出这个选择带来什么。

---

## 可以用几个

**一个 mod 里只能选一项**（管理器规则）。

**但可以同时装很多个 mod** —— 实测 27 个 `mods/dsh/` 脚本同时加载无问题。

**前提：不能有多个 mod 改同一个宿主**（会互相覆盖）。
**这 25 个 mod 每个只管一个宿主，互不重叠，所以可以全装。**

---

## 验证是否生效

日志目录：

```
%LOCALAPPDATA%\CowboyBingus\Helldivers2\Logs\
```

- `ExtraEngine-STATUS.txt` —— 总体状态
- `ExtraEngine-applied.txt` —— 逐条写入结果

**成功时：**

```
host   3  +200 49 -> 88  OK
host 147  +200  0 -> 66  OK
```

**再看游戏内，额外应该出现在战略配备列表里。**

---

## 安全设计

- **`game.dll` SHA-256 校验** —— 版本不符**拒绝运行**
- **完整遍历 80280 字节设置表**，边界检查，要求**恰好 149 条记录**
- **写入前把整块表读两遍比对**
- **只写目标记录的 `+200` 一个 dword**
- **`+200` 已非 0 的记录跳过，不覆盖**
- **明确拒绝 `MEM_IMAGE`** —— **绝不改代码段**
- **每次写入立即回读验证**
- **退出游戏时还原全部原始值**

---

## 仓库结构

```
dist/25x24/     25 个成品 mod（每个一个下拉）
docs/           使用教程、迭代记录、中文名对照、kind 数据
src/            共享引擎 + 单计划模板
tools/          生成器、打包器、校验器
ref/            简称表、kind 数据、名称表
```

---

## 致谢

- **Suzuka** — [helldivers-2-extra-slot](https://github.com/Suzuka2788/helldivers-2-extra-slot)
  `+200` 机制的最初线索来自该项目 —— **Suzuka 的 mod 证明了「一个技能可以多带一个战略配备」，
  这是本项目的起点。**
- **xypwn** — [Filediver](https://github.com/xypwn/filediver)
  用它的资源列表把记录里的名字哈希翻成技能名，**本项目 88/149 条记录的名字就是这样确定的**
- **CowboyBingus** — 共享加载器

---

## 许可

MIT。第三方署名归原作者。
