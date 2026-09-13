# dsh-notify

A DeepSeek Harness plugin that alerts you through the **browser** — with a **notification and a sound** — when something needs your attention in the web UI:

- **🔔 Run finished** — a run completes → notification + a *soft ascending chime*.
- **❓ Input needed** — the agent is waiting for you (answer a question, review a plan, approve an action) → notification + an *urgent triple beep*.

The two event classes use **clearly different sounds** (sine arpeggio vs. square beeps), so you can tell them apart without looking at the screen.

## 快速使用 Quick start

1. 安装插件到 web profile（见下方「Installation」）并重启 `dsh web`。
2. 打开 **Settings → 通知 (Notifications)**，点击 **请求权限 (Request permission)** 并允许浏览器通知。
3. 先点击页面任意位置一次（浏览器自动播放策略），再用 **试听** 按钮确认两种提示音都能播放。
4. 完成 —— 之后每当一个运行结束（`done`）或智能体需要你输入（`question` / 计划审批 / 操作确认）时，都会收到浏览器通知 + 提示音。

## Features

- **Done chime** (`done`): soft ascending arpeggio (C5–E5–G5, sine); alternative `cascade` preset (descending, brighter).
- **Question chime** (`question`): urgent triple beep (A5–A5–D6, square); alternative `pulse` preset (double pulse, bright).
- **Browser notifications** via the Notifications API (`silent` — the chime is the sound, so you never get a double beep from the OS). Permission is requested from the Settings page.
- **Settings page** (Settings → 通知 / Notifications): enable/disable the whole feature, sound on/off, volume (0–100), one preset per event class, and a **“background only”** mode (stay quiet while the page is in the foreground).
- **Test buttons**: play each chime and send a test notification right from the settings page.
- **Smart triggers** (all client-side, driven by the sessions list snapshot):
  - `done` fires on a top-level session's `running` true→false edge. **Subagent sessions are excluded** — only a user-visible run's completion alerts you.
  - `question` fires when a session's `pendingInteraction` appears (`question`, `plan-review`, or `approval`).
  - A short per-session debounce coalesces back-to-back transitions (e.g. goal rounds) without swallowing real completions.
- **No host routes, no API keys** — the plugin is browser-only logic plus a settings schema; nothing leaves the machine.
- **Self-contained settings** — preferences persist in `localStorage`, so the settings page always works (even on remote browsers or if the host settings transport is unavailable). When the host exposes the `dsh-notify` namespace, writes are additionally mirrored into `$DSH_HOME/settings.yaml`.

## Installation

The plugin ships as a normal out-of-tree dsh plugin package (host half + browser half). Install it into the `web` profile:

```sh
# from the profile directory
dsh plugin --profile web add dsh-notify --link <path-to-this-package>
```

or, manually:

1. Add a loader entry to `$DSH_HOME/profiles/web/cordis.patch.yml`:

   ```yaml
   - insert:
       - id: dsh-notify
         name: 'dsh-notify'
   ```

2. Make the package resolvable from the profile (pnpm `file:` dependency, or a junction into `$DSH_HOME/profiles/node_modules`).

3. Restart `dsh web`.

> Note: the plugin's `dsh.client` declaration registers its browser half with the client-modules system, so the plugin-set change takes effect on server restart.
>
> **After editing the plugin source**, the profile's `node_modules/dsh-notify` copy must be refreshed (pnpm treats `file:` deps as up to date): copy `lib/` and `package.json` over it, or reinstall with `pnpm install --force`.

### Required host allowlist patch (once)

dsh deliberately refuses to serve **any** settings namespace not listed in `WEB_SETTINGS_NAMESPACES` in `@deepseek-ai/dsh-host-apiproxy/lib/index.js` — a third-party namespace answers `settings-not-exposed` even when its owner registered it (the code comment calls moving this to `settings.register()` "deferred work"). The settings page of an unlisted plugin therefore renders but **every control appears unresponsive**.

This machine's install has been patched to include `dsh-notify` and `dsh-deepseek-balance` (the local out-of-tree plugins) in that allowlist. If dsh is ever reinstalled/updated, re-apply:

```js
const WEB_SETTINGS_NAMESPACES = [
	"agent-loop",
	"shell",
	"locale",
	"permission",
	"ui-conversation",
	"ui-theme",
	"web-search-deepseek",
	"dsh-notify",
	"dsh-deepseek-balance"
];
```

The patch is what lets the settings mirror land in `settings.yaml`; the plugin itself works without it (localStorage).

### First-use checklist (browser)

1. Open **Settings → 通知 (Notifications)**.
2. Click **请求权限 (Request permission)** and allow notifications for the site.
3. Click anywhere on the page once (browser autoplay policy), then use the **试听** buttons to confirm both chimes play.
4. That's it — the plugin starts alerting on the next run completion / question.

## Configuration

Preferences are edited in the **Settings → 通知 (Notifications)** page and persist in the browser's `localStorage` (key `dsh-notify/settings/v1`). With the host allowlist patch applied, each change is also mirrored into the `dsh-notify:` section of `$DSH_HOME/settings.yaml`:

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Master switch for notifications + chimes. |
| `soundEnabled` | `true` | Play the chime (notification still shows when off). |
| `volume` | `60` | Chime volume, 0–100. |
| `doneSound` | `chime` | Done preset: `chime` (ascending arpeggio) or `cascade` (descending). |
| `questionSound` | `triple` | Question preset: `triple` (urgent beeps) or `pulse` (double pulse). |
| `onlyWhenHidden` | `false` | Only alert while the page is in another window/tab (quiet in the foreground). |

## 其他设备能用吗？(Can it be used on other devices?)

**结论：可以，而且比其他插件更宽松 —— 任何设备、任何浏览器都能用。** 插件没有主机路由、不需要 API Key，通知与提示音全部在浏览器侧完成；唯一有设备依赖的是「设置镜像写入 `settings.yaml`」这一可选功能。

### 换到新设备需要做的 3 件事

| # | 事项 | 说明 |
|---|---|---|
| 1 | 安装 DeepSeek Harness | 新设备需要装好 `dsh` 并至少启动过一次 `dsh web`。 |
| 2 | 让 `@deepseek-ai/*` 依赖可解析 | 本包通过 `node_modules/@deepseek-ai` 解析 dsh 的包。**本机是一个 junction**（指向 `D:\nodejs\node_global\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai`）—— 这是本机路径，换机后不存在。新设备上要么重建 junction 指向该机的 dsh 安装，要么把本包放进 dsh 工作区用 pnpm 正常安装。 |
| 3 | 注册到 web profile | 在 `$DSH_HOME/profiles/web/cordis.patch.yml` 加入插件条目（见上方「Installation」），或 `dsh plugin --profile web add dsh-notify --link <此包路径>`。 |

> 设置镜像（写入 `$DSH_HOME/settings.yaml`）依赖上文的 `WEB_SETTINGS_NAMESPACES` 补丁，而**补丁是打在 dsh 安装上的**：dsh 升级或换机后需重新应用。未补丁时只是设置不会镜像到 `settings.yaml` —— 插件本身照常工作（localStorage 持久化）。

### 远程浏览器 / 其他浏览器

- 插件**没有主机路由**，所以通过局域网或远程访问同一 web UI 的其他设备浏览器也能**完整使用**：通知、提示音、设置都正常（每台设备各存各的 localStorage）。
- 浏览器要求：支持 **Notifications API**（Chrome / Edge / Firefox / Safari 均支持）与 **Web Audio**。
- 提示音可能受浏览器自动播放策略影响 —— 首次使用请先点击页面任意位置一次（见「First-use checklist」）。

### 换机验证清单

- [ ] Settings → 通知 → 请求权限并允许
- [ ] 点击页面任意处后，两个「试听」按钮都能出声
- [ ] 运行一个任务，完成时收到通知 + 提示音（`done`）
- [ ] 触发一次提问 / 计划审批，收到不同音色的提示音（`question`）
- [ ] 换一台设备的浏览器访问同一 web UI，同样能收到通知（localStorage 相互独立）
- [ ] （可选）`$DSH_HOME/settings.yaml` 出现 `dsh-notify:` 段（未重新打补丁则跳过此项）

## Layout

```
dsh-notify/
├── package.json      # dsh.client declaration + exports ("./client" bundle)
└── lib/
    ├── index.js      # host half: user-settings section (schema, mirror target)
    └── client.js     # browser half: watcher, notifications, Web-Audio chimes,
                      #   localStorage settings store (+ optional settings mirror), settings page
```

The browser half subscribes to `ctx.sessions.list` (the same list snapshot the sidebar uses) and registers into the `settings.section` slot (`id: "notify"`).

## Development

Headless tests (no browser needed) verify the module structure, the settings-page render, the watcher's event logic, the settings persistence, and the host settings registration:

```sh
node test/smoke-test.cjs    # client bundle structure (apply/inject roster)
node test/render-test.cjs   # server-renders the settings page via react-dom (real primitives)
node test/watcher-test.cjs  # drives snapshot transitions; asserts done/question events
                           # with distinctly different synthesized sounds, plus option
                           # suppression (enabled=false, onlyWhenHidden) and debounce
node test/store-test.cjs    # localStorage persistence: write -> save -> reload -> rehydrate,
                           # sanitization of bad values, corrupt-storage fallback
node test/host-test.cjs     # host apply() registers the dsh-notify settings section
```

The host half resolves its `@deepseek-ai/*` imports through a scoped junction
(`node_modules/@deepseek-ai`) pointing at the dsh installation; a normal pnpm
install of this package replaces that with real dependency links.
