# Cursor FX

A Tampermonkey/Violentmonkey user script that hides the system cursor and provides a smooth, customizable cursor experience: delayed ring follow, hover fitting, text caret mode, click spring scale, scroll trail. GPU-composited, frame-rate independent, auto-pauses when idle.

[**▶ Install Script**](https://raw.githubusercontent.com/Xinyang-Gao/cursor-fx-userscript/main/cursor-fx-userscript.user.js)

---

## Features

- **Custom Cursor** – A dot + ring combo with `mix-blend-mode: difference` makes it visible on any background.
- **Hover Fitting** – Ring adapts to interactive elements (links, buttons, etc.) – matching their size and border-radius.
- **Text Caret Mode** – Dot turns into a vertical bar inside text inputs, ring shrinks and dims.
- **Click Spring** – Squeeze animation with configurable stiffness and damping.
- **Scroll Trail** – Ring drifts with inertia during scrolling.
- **Performance** – All positioning uses CSS `transform` (compositor layer), no layout thrashing. Automatically pauses `requestAnimationFrame` when idle.

---

## New in v2.1.0

- **Visual Settings Panel** – Open via the Tampermonkey menu (`⚙ 光标设置`). Adjust 19 parameters in real time with sliders. Changes apply instantly and are auto-saved.
- **Persistent Storage** – Preferences are stored using `GM_setValue` (with `localStorage` fallback), so your settings survive page reloads.
- **“Reduce Motion” Support** – Automatically respects system `prefers-reduced-motion` by softening or disabling animations.
- **One‑click Reset** – Restore all parameters to defaults from the panel.

---

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) in your browser.
2. Click the **[Install Script](https://raw.githubusercontent.com/Xinyang-Gao/cursor-fx-userscript/main/cursor-fx-userscript.user.js)** link above.
3. Confirm installation in your userscript manager.

---

## Settings Panel

After installation, a new menu item `⚙ 光标设置` appears in your userscript manager’s menu (e.g., Tampermonkey’s popup). Click it to open the settings panel.

The panel is a floating, semi‑transparent dialog styled in dark theme. It is isolated from page CSS via Shadow DOM.

### Parameters

| Group   | Parameter           | Description                         | Range / Step          |
|---------|---------------------|-------------------------------------|-----------------------|
| **Appearance** | DOT_SIZE      | Dot diameter                        | 2–24 px, step 1       |
|         | RING_SIZE           | Ring default diameter               | 16–96 px, step 2      |
|         | RING_BORDER         | Ring border width                   | 0.5–6 px, step 0.5    |
|         | RING_ALPHA          | Ring opacity (normal)               | 0.1–1.0, step 0.05    |
| **Fitting** | FIT_PADDING       | Extra padding when fitting          | 0–24 px, step 1       |
|         | MAX_FIT_SIZE        | Max element size to fit (both dims) | 80–480 px, step 10    |
| **Follow**  | FOLLOW_SPEED       | Free‑follow smoothness speed        | 2–40, step 1          |
|         | FIT_SPEED           | Fitting adhesion speed              | 4–80, step 1          |
|         | SHAPE_SPEED         | Size/radius change speed            | 4–80, step 1          |
| **Click**   | CLICK_SCALE        | Scale on press                      | 0.40–1.0, step 0.02   |
|         | SPRING_K            | Stiffness (bounciness)              | 100–1200, step 20     |
|         | SPRING_DAMP         | Damping (higher = less bounce)      | 5–40, step 1          |
| **Scroll**  | SCROLL_MAX         | Maximum trail offset                | 0–80 px, step 2       |
|         | SCROLL_DECAY        | Trail decay speed (higher = faster) | 1–20, step 0.5        |
| **Text**    | TEXT_BAR_W         | Vertical bar width in text mode     | 1–6 px, step 0.5      |
|         | TEXT_BAR_H          | Vertical bar height                 | 12–40 px, step 1      |
|         | TEXT_RING_SIZE      | Ring size in text mode              | 12–64 px, step 2      |
|         | TEXT_RING_ALPHA     | Ring opacity in text mode           | 0.1–1.0, step 0.05    |
| **Other**   | IDLE_PAUSE_MS      | Idle time before pausing rAF        | 500–10000 ms, step 250|

- All sliders are **live** – tweak and see immediate feedback.
- Values are auto‑saved after a short debounce (350 ms).
- The panel can be closed by clicking the **✕** button, pressing **Esc**, or clicking outside the panel.

---

## Keyboard & Accessibility

- **Tab** focus on interactive elements will also trigger the ring fitting (like mouse hover), improving keyboard navigation experience.
- When the system has `prefers-reduced-motion` enabled, the script automatically:
  - Sets `FOLLOW_SPEED`, `FIT_SPEED`, `SHAPE_SPEED` to extremely high values (virtually instant).
  - Disables scroll trail (`SCROLL_MAX = 0`).
  - Reduces spring effect (`SPRING_K` and `SPRING_DAMP` to high values).

---

## Compatibility

- Works on all websites (`@match *://*/*`).
- Touch devices (`pointer: coarse`) are automatically ignored.
- Runs at `document-start` to hide native cursor as early as possible.
- No iframe support (uses `@noframes`).

---

## License

MIT © [Xinyang-Gao](https://github.com/Xinyang-Gao)

---

# Cursor FX

篡改猴（Tampermonkey）/暴力猴（Violentmonkey）用户脚本，隐藏系统指针，提供流畅、可自定义的光标体验：延迟跟随圆环、悬停贴合、文本竖条、点击弹性缩放、滚动拖尾。基于 GPU 合成层，帧率无关平滑，空闲自动暂停。

[**▶ 安装脚本**](https://raw.githubusercontent.com/Xinyang-Gao/cursor-fx-userscript/main/cursor-fx-userscript.user.js)

---

## 特性

- **自定义光标** – 圆点 + 圆环，利用 `mix-blend-mode: difference` 在任何背景上都清晰可见。
- **悬停贴合** – 圆环自动适配交互元素（链接、按钮等）的尺寸和圆角。
- **文本光标模式** – 在文本输入区内圆点变为竖条，圆环缩小并降透明。
- **点击弹簧** – 按下时弹性缩放，刚度与阻尼可调。
- **滚动拖尾** – 滚动时圆环带有惯性偏移。
- **性能优化** – 全部使用 CSS `transform`（合成器层），不触发回流；空闲时自动暂停 `requestAnimationFrame`。

---

## v2.1.0 新功能

- **可视化设置面板** – 通过篡改猴菜单中的「⚙ 光标设置」打开。19 项参数滑块实时调节，即刻生效，自动保存。
- **参数持久化** – 使用 `GM_setValue` 存储（并提供 `localStorage` 降级），刷新页面设置不丢失。
- **“减少动态效果”适配** – 自动检测系统 `prefers-reduced-motion`，弱化或禁用动画。
- **一键恢复默认** – 面板内直接重置所有参数。

---

## 安装

1. 在浏览器中安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)。
2. 点击上方 **[安装脚本](https://raw.githubusercontent.com/Xinyang-Gao/cursor-fx-userscript/main/cursor-fx-userscript.user.js)** 链接。
3. 在脚本管理器中确认安装。

---

## 设置面板

安装后，在脚本管理器的菜单中会出现「⚙ 光标设置」项，点击即可打开设置面板。

面板为浮动半透明深色风格，通过 Shadow DOM 隔离，不受页面样式干扰。

### 参数列表

| 分组   | 参数                | 说明                         | 范围 / 步进          |
|--------|---------------------|------------------------------|----------------------|
| **外观** | DOT_SIZE           | 圆点直径                     | 2–24 px，步进 1      |
|        | RING_SIZE           | 圆环默认直径                 | 16–96 px，步进 2     |
|        | RING_BORDER         | 圆环边框宽度                 | 0.5–6 px，步进 0.5   |
|        | RING_ALPHA          | 圆环基础不透明度             | 0.1–1.0，步进 0.05   |
| **贴合** | FIT_PADDING        | 贴合时向外留白               | 0–24 px，步进 1      |
|        | MAX_FIT_SIZE        | 最大贴合尺寸（宽高同时超过则忽略）| 80–480 px，步进 10 |
| **跟随** | FOLLOW_SPEED       | 自由跟随平滑速度             | 2–40，步进 1         |
|        | FIT_SPEED           | 贴合吸附速度                 | 4–80，步进 1         |
|        | SHAPE_SPEED         | 尺寸/圆角变化速度            | 4–80，步进 1         |
| **点击** | CLICK_SCALE        | 按下时缩放比例               | 0.40–1.0，步进 0.02  |
|        | SPRING_K            | 回弹刚度（数值越大越弹）     | 100–1200，步进 20    |
|        | SPRING_DAMP         | 回弹阻尼（越大回弹越少）     | 5–40，步进 1         |
| **滚动** | SCROLL_MAX         | 拖尾最大偏移                 | 0–80 px，步进 2      |
|        | SCROLL_DECAY        | 拖尾衰减速度（越大回收越快） | 1–20，步进 0.5       |
| **文本** | TEXT_BAR_W         | 竖条宽度                     | 1–6 px，步进 0.5     |
|        | TEXT_BAR_H          | 竖条高度                     | 12–40 px，步进 1     |
|        | TEXT_RING_SIZE      | 文本区圆环大小               | 12–64 px，步进 2     |
|        | TEXT_RING_ALPHA     | 文本区圆环透明度             | 0.1–1.0，步进 0.05   |
| **其他** | IDLE_PAUSE_MS      | 空闲暂停 rAF 的延迟时间      | 500–10000 ms，步进 250|

- 所有滑块**实时生效**，调整后立刻看到变化。
- 参数在防抖（350 ms）后自动保存。
- 面板可通过 **✕** 按钮、按 **Esc** 键或点击面板外部关闭。

---

## 键盘与无障碍

- 使用 **Tab** 键聚焦交互元素时，圆环同样会贴合（类似鼠标悬停），改善键盘导航体验。
- 当系统启用 `prefers-reduced-motion` 时，脚本自动：
  - 将 `FOLLOW_SPEED`、`FIT_SPEED`、`SHAPE_SPEED` 设为极大值（几乎无延迟）。
  - 禁用滚动拖尾（`SCROLL_MAX = 0`）。
  - 削弱弹簧效果（将 `SPRING_K` 和 `SPRING_DAMP` 设为大值）。

---

## 兼容性

- 支持所有网站（`@match *://*/*`）。
- 触屏设备（`pointer: coarse`）自动跳过。
- 在 `document-start` 运行，尽早隐藏原生指针。
- 不支持 iframe（使用 `@noframes`）。

---

## 许可证

MIT © [Xinyang-Gao](https://github.com/Xinyang-Gao)