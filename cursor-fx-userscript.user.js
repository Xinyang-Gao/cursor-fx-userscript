// ==UserScript==
// @name         Cursor FX
// @name:zh-CN   自定义鼠标光标特效
// @namespace    https://github.com/Xinyang-Gao/cursor-fx-userscript
// @version      2.1.0
// @description  Smooth custom cursor: delayed ring follow, hover fitting, text caret mode, click spring scale, scroll trail. GPU-composited, frame-rate independent, auto-pauses when idle. Settings panel via the Tampermonkey menu.
// @description:zh-CN  隐藏系统指针，使用圆点 + 圆环自定义光标：延迟跟随、悬停贴合、文本竖条、点击弹性缩放、滚动拖尾。transform 合成层定位，帧率无关平滑，空闲自动暂停。点击篡改猴菜单中的「⚙ 光标设置」打开设置面板，实时调节、自动保存。
// @author       Xinyang-Gao
// @license      MIT
// @match        *://*/*
// @run-at       document-start
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @noframes
// @homepageURL  https://github.com/Xinyang-Gao/cursor-fx-userscript
// @supportURL   https://github.com/Xinyang-Gao/cursor-fx-userscript/issues
// @downloadURL  https://raw.githubusercontent.com/Xinyang-Gao/cursor-fx-userscript/main/cursor-fx-userscript.user.js
// @updateURL    https://raw.githubusercontent.com/Xinyang-Gao/cursor-fx-userscript/main/cursor-fx-userscript.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // ================= 可调参数（默认） =================
    const DEFAULTS = {
        DOT_SIZE: 8,            // 圆点直径 (px)
        RING_SIZE: 40,          // 圆环默认直径 (px)
        RING_BORDER: 1.5,       // 圆环边框宽度 (px)
        RING_ALPHA: 0.9,        // 圆环基础不透明度
        TEXT_RING_ALPHA: 0.4,   // 文本区圆环不透明度
        TEXT_RING_SIZE: 24,     // 文本区圆环直径 (px)
        MAX_FIT_SIZE: 200,      // 元素宽高同时超过此值则不贴合 (px)
        FIT_PADDING: 6,         // 贴合时向外留白，视觉更透气 (px)
        TEXT_BAR_W: 2,          // 文本竖条宽度 (px)
        TEXT_BAR_H: 22,         // 文本竖条高度 (px)
        FOLLOW_SPEED: 16,       // 自由跟随平滑速度（越大越跟手，/秒）
        FIT_SPEED: 26,          // 贴合吸附平滑速度
        SHAPE_SPEED: 18,        // 圆环尺寸/圆角变化平滑速度
        SCROLL_MAX: 30,         // 滚动拖尾最大偏移 (px)
        SCROLL_DECAY: 7,        // 拖尾衰减速度（越大越快收回）
        CLICK_SCALE: 0.78,      // 按下时缩放
        SPRING_K: 520,          // 点击弹簧刚度
        SPRING_DAMP: 21,        // 点击弹簧阻尼（越小回弹越明显）
        IDLE_PAUSE_MS: 2500,    // 空闲多久后自动暂停 rAF
    };
    const CFG = { ...DEFAULTS };   // 运行时实际生效值 = 默认值 + 用户设置（+ 减少动态效果覆盖）

    const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

    // 触屏设备无需光标特效，直接退出
    if (matchMedia('(pointer: coarse)').matches) return;

    // ---------- 设置存储：优先 GM 存储，(降级 localStorage+ ----------
    const store = {
        read(k, fb) {
            try {
                if (typeof GM_getValue === 'function') {
                    const v = GM_getValue(k, null);
                    return v == null ? fb : JSON.parse(v);
                }
                const v = localStorage.getItem('CursorFX.' + k);
                return v == null ? fb : JSON.parse(v);
            } catch { return fb; }
        },
        write(k, v) {
            try {
                const s = JSON.stringify(v);
                if (typeof GM_setValue === 'function') GM_setValue(k, s);
                else localStorage.setItem('CursorFX.' + k, s);
            } catch { /* 隐私模式等场景静默失败 */ }
        },
        erase(k) {
            try {
                if (typeof GM_deleteValue === 'function') GM_deleteValue(k);
                else localStorage.removeItem('CursorFX.' + k);
            } catch { /* ignore */ }
        },
    };

    // ---------- 设置 ----------
    const FIELDS = [
        { g: '外观', key: 'DOT_SIZE',        label: '圆点大小',   min: 2,    max: 24,    step: 1,    unit: 'px' },
        { g: '外观', key: 'RING_SIZE',       label: '圆环大小',   min: 16,   max: 96,    step: 2,    unit: 'px' },
        { g: '外观', key: 'RING_BORDER',     label: '圆环粗细',   min: 0.5,  max: 6,     step: 0.5,  unit: 'px' },
        { g: '外观', key: 'RING_ALPHA',      label: '圆环透明度', min: 0.1,  max: 1,     step: 0.05, unit: ''   },
        { g: '贴合', key: 'FIT_PADDING',     label: '贴合留白',   min: 0,    max: 24,    step: 1,    unit: 'px' },
        { g: '贴合', key: 'MAX_FIT_SIZE',    label: '最大贴合尺寸', min: 80, max: 480,   step: 10,   unit: 'px' },
        { g: '跟随', key: 'FOLLOW_SPEED',    label: '跟随速度',   min: 2,    max: 40,    step: 1,    unit: ''   },
        { g: '跟随', key: 'FIT_SPEED',       label: '吸附速度',   min: 4,    max: 80,    step: 1,    unit: ''   },
        { g: '跟随', key: 'SHAPE_SPEED',     label: '形变速度',   min: 4,    max: 80,    step: 1,    unit: ''   },
        { g: '点击', key: 'CLICK_SCALE',     label: '按下缩放',   min: 0.4,  max: 1,     step: 0.02, unit: ''   },
        { g: '点击', key: 'SPRING_K',        label: '回弹刚度',   min: 100,  max: 1200,  step: 20,   unit: ''   },
        { g: '点击', key: 'SPRING_DAMP',     label: '回弹阻尼',   min: 5,    max: 40,    step: 1,    unit: ''   },
        { g: '滚动', key: 'SCROLL_MAX',      label: '拖尾幅度',   min: 0,    max: 80,    step: 2,    unit: 'px' },
        { g: '滚动', key: 'SCROLL_DECAY',    label: '拖尾回收',   min: 1,    max: 20,    step: 0.5,  unit: ''   },
        { g: '文本', key: 'TEXT_BAR_W',      label: '竖条宽度',   min: 1,    max: 6,     step: 0.5,  unit: 'px' },
        { g: '文本', key: 'TEXT_BAR_H',      label: '竖条高度',   min: 12,   max: 40,    step: 1,    unit: 'px' },
        { g: '文本', key: 'TEXT_RING_SIZE',  label: '文本环大小', min: 12,   max: 64,    step: 2,    unit: 'px' },
        { g: '文本', key: 'TEXT_RING_ALPHA', label: '文本环透明度', min: 0.1, max: 1,    step: 0.05, unit: ''   },
        { g: '其他', key: 'IDLE_PAUSE_MS',   label: '空闲暂停',   min: 500,  max: 10000, step: 250,  unit: 'ms' },
    ];
    const FMAP = {};
    FIELDS.forEach(f => FMAP[f.key] = f);

    // 读取已保存的覆盖项（只保留合法键并钳制范围，脏数据自动丢弃）
    const overrides = {};
    {
        const raw = store.read('overrides', {});
        for (const f of FIELDS) {
            const v = raw[f.key];
            if (typeof v === 'number' && isFinite(v)) overrides[f.key] = clamp(v, f.min, f.max);
        }
    }

    // 尊重系统"减少动态效果"设置（仅作用于运行时，不污染用户保存的值）
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const RM_PATCH = RM ? {
        FOLLOW_SPEED: 1e4, FIT_SPEED: 1e4, SHAPE_SPEED: 1e4,
        SCROLL_MAX: 0, SPRING_K: 1e4, SPRING_DAMP: 1e4,
    } : null;

    // ---------- 样式：尽早注入，第一时间隐藏原生指针 ----------
    // 定位只使用 transform（合成器层，不触发布局回流）
    const style = document.createElement('style');
    function renderCSS() {
        style.textContent = `
            *, *::before, *::after { cursor: none !important; }
            .cc-dot, .cc-ring {
                position: fixed; left: 0; top: 0;
                pointer-events: none;
                z-index: 2147483647;
                mix-blend-mode: difference;
                will-change: transform;
                opacity: 0;
            }
            .cc-dot {
                width: ${CFG.DOT_SIZE}px; height: ${CFG.DOT_SIZE}px;
                background: #fff; border-radius: 50%;
                transition: opacity .3s ease, width .22s ease, height .22s ease, border-radius .22s ease;
            }
            .cc-ring {
                width: ${CFG.RING_SIZE}px; height: ${CFG.RING_SIZE}px;
                border: ${CFG.RING_BORDER}px solid rgb(255 255 255 / var(--ccA, ${CFG.RING_ALPHA}));
                border-radius: 50%;
                transition: opacity .3s ease, border-color .25s ease;
            }
            .cc-live { opacity: 1; }
        `;
    }

    // 合并设置 → 渲染样式 → 通知主循环强制重写
    let commitQueued = false, api = null;
    function commit() {
        Object.assign(CFG, DEFAULTS, overrides);
        if (RM_PATCH) Object.assign(CFG, RM_PATCH);
        if (commitQueued) return;
        commitQueued = true;
        requestAnimationFrame(() => {
            commitQueued = false;
            renderCSS();
            if (api) api.refresh();
        });
    }

    Object.assign(CFG, DEFAULTS, overrides);
    if (RM_PATCH) Object.assign(CFG, RM_PATCH);
    renderCSS();
    (document.head || document.documentElement).appendChild(style);

    // ---------- 创建元素 ----------
    function spawn() {
        const dot = document.createElement('div');
        const ring = document.createElement('div');
        dot.className = 'cc-dot';
        ring.className = 'cc-ring';
        document.body.append(ring, dot);   // dot 后插入，层级压在环上方
        run(dot, ring);
    }
    document.body ? spawn() : document.addEventListener('DOMContentLoaded', spawn, { once: true });

    function run(dot, ring) {
        // ----- 选择器 -----
        const SEL_INTERACTIVE = 'a, button, [role="button"], [tabindex]:not([tabindex="-1"]), [onclick]';
        const SEL_TEXT = [
            'input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([type="range"]):not([type="color"]):not([type="file"])',
            'textarea',
            '[contenteditable="true"]',
            '[contenteditable=""]',
            '[contenteditable="plaintext-only"]',
            '[role="textbox"]',
        ].join(',');

        // ----- 状态 -----
        let mx = innerWidth / 2, my = innerHeight / 2;              // 指针真实位置
        let rx = mx, ry = my;                                       // 环当前位置
        let rw = CFG.RING_SIZE, rh = CFG.RING_SIZE, rr = CFG.RING_SIZE / 2; // 环当前尺寸/圆角
        let lastW = -1, lastH = -1, lastR = -1;                     // 上次写入值（用于跳过冗余写入）
        let tw, th, tr;                                             // 环目标尺寸/圆角
        let sX = 0, sY = 0;                                         // 滚动拖尾偏移
        let dotS = 1, ringS = 1, dotV = 0, ringV = 0;               // 点击弹簧状态
        let pressed = false;
        let hoverEl = null, hoverRad = 0;                           // 鼠标悬停的交互元素
        let focusEl = null, focusRad = 0;                           // 键盘聚焦的交互元素
        let textEl = null, dotIsBar = false, ringDim = false;
        let lastInput = 0, lastT = 0, rafId = 0;
        let shown = false, inside = true;
        const dotCache = {}, ringCache = {};

        // 判断元素是否可贴合，并缓存圆角（避免每帧读 computedStyle）
        function measure(el) {
            const r = el.getBoundingClientRect();
            if (r.width > CFG.MAX_FIT_SIZE && r.height > CFG.MAX_FIT_SIZE) return null;
            const br = getComputedStyle(el).borderRadius || '0px';
            return br.indexOf('%') > -1
                ? parseFloat(br) / 100 * Math.min(r.width, r.height)  // 百分比圆角（圆形/胶囊）换算
                : parseFloat(br) || 0;
        }

        // ----- 显示 / 隐藏 -----
        function show() {
            if (shown) return;
            shown = true;
            dot.classList.add('cc-live');
            ring.classList.add('cc-live');
        }
        function hide() {
            if (!shown) return;
            shown = false;
            dot.classList.remove('cc-live');
            ring.classList.remove('cc-live');
        }

        // ----- 唤醒主循环（任何输入事件统一入口） -----
        function wake() {
            lastInput = performance.now();
            show();
            if (!rafId) { lastT = lastInput; rafId = requestAnimationFrame(tick); }
        }

        // ----- 指针：只记录坐标，样式写入统一交给 rAF -----
        addEventListener('pointermove', (e) => {
            if (e.pointerType === 'touch') return;   // 混合屏上触摸不拖动光标
            mx = e.clientX; my = e.clientY;
            if (focusEl) focusEl = null;             // 鼠标接管键盘焦点状态
            wake();
        }, { passive: true });

        addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; pressed = true; wake(); });
        addEventListener('pointerup', () => { pressed = false; wake(); });
        addEventListener('pointercancel', () => { pressed = false; wake(); });

        // ----- 滚动拖尾：归一化 deltaMode（行/页模式），钳制单帧增量防跳变 -----
        addEventListener('wheel', (e) => {
            if (hoverEl || focusEl) return;
            const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? innerHeight : 1);
            sX = clamp(sX - clamp(e.deltaX * unit, -80, 80), -CFG.SCROLL_MAX, CFG.SCROLL_MAX);
            sY = clamp(sY - clamp(e.deltaY * unit, -80, 80), -CFG.SCROLL_MAX, CFG.SCROLL_MAX);
            wake();
        }, { passive: true });

        // ----- 悬停检测：mouseover 一次性重算状态，无需 mouseout 配对 -----
        document.addEventListener('mouseover', (e) => {
            const t = e.target;
            if (!t || t.nodeType !== 1) return;

            const txt = t.closest(SEL_TEXT) || null;
            if (txt !== textEl) {
                textEl = txt;
                setDotShape(!!txt);
                setRingAlpha(!!txt);
            }

            const inter = t.closest(SEL_INTERACTIVE);
            if (inter !== hoverEl) {
                let next = null, rad = 0;
                if (inter && !inter.matches(SEL_TEXT)) {
                    const m = measure(inter);
                    if (m !== null) { next = inter; rad = m; }
                }
                hoverEl = next; hoverRad = rad;
            }
        });

        // ----- 键盘 Tab 聚焦时圆环同样贴合（无障碍增强） -----
        document.addEventListener('focusin', (e) => {
            const t = e.target;
            if (!t || t.nodeType !== 1 || t.matches(SEL_TEXT) || !t.matches(SEL_INTERACTIVE)) return;
            const m = measure(t);
            if (m !== null) { focusEl = t; focusRad = m; wake(); }
        });
        document.addEventListener('focusout', (e) => {
            if (focusEl === e.target) { focusEl = null; wake(); }
        });

        // ----- 指针离开窗口自动隐藏；窗口失焦时隐藏（缓解跨域 iframe 内光标冻结） -----
        const docEl = document.documentElement;
        docEl.addEventListener('mouseenter', () => { inside = true; wake(); });
        docEl.addEventListener('mouseleave', () => { inside = false; hide(); });
        addEventListener('blur', hide);
        addEventListener('focus', () => { if (inside) wake(); });

        // ----- 圆点形状 / 圆环透明度 -----
        function setDotShape(bar) {
            if (dotIsBar === bar) return;
            dotIsBar = bar;
            dot.style.width = (bar ? CFG.TEXT_BAR_W : CFG.DOT_SIZE) + 'px';
            dot.style.height = (bar ? CFG.TEXT_BAR_H : CFG.DOT_SIZE) + 'px';
            dot.style.borderRadius = bar ? '2px' : '50%';
        }
        function setRingAlpha(dim) {
            if (ringDim === dim) return;
            ringDim = dim;
            ring.style.setProperty('--ccA', dim ? CFG.TEXT_RING_ALPHA : CFG.RING_ALPHA);
        }

        // ----- transform 写入缓存：字符串不变则跳过 -----
        function setT(el, x, y, s, cache) {
            const v = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) translate(-50%,-50%) scale(' + s.toFixed(3) + ')';
            if (cache.v !== v) { cache.v = v; el.style.transform = v; }
        }

        // 初始位置先写好，避免首帧闪现
        setT(dot, mx, my, 1, dotCache);
        setT(ring, rx, ry, 1, ringCache);

        // ----- 暴露给设置面板：参数变更后强制全量重写一次样式 -----
        api = {
            refresh() {
                const b = dotIsBar; dotIsBar = !b; setDotShape(b);
                const d = ringDim; ringDim = !d; setRingAlpha(d);
                lastW = lastH = lastR = -1;
                dotCache.v = ringCache.v = '';
                wake();
            }
        };

        // ----- 主循环：所有 DOM 写入集中在此 -----
        function tick(t) {
            rafId = 0;
            const dt = clamp((t - lastT) / 1000, 0, 0.05) || 0.016;
            lastT = t;

            let el = hoverEl || focusEl;
            const elRad = hoverEl ? hoverRad : focusRad;
            if (el && !el.isConnected) {          // 元素被移出 DOM → 释放
                if (hoverEl === el) hoverEl = null;
                if (focusEl === el) focusEl = null;
                el = null;
            }

            // 1) 拖尾衰减（帧率无关）
            if (sX !== 0 || sY !== 0) {
                const d = Math.exp(-CFG.SCROLL_DECAY * dt);
                sX *= d; sY *= d;
                if (Math.abs(sX) < 0.05) sX = 0;
                if (Math.abs(sY) < 0.05) sY = 0;
            }

            // 2) 环目标：贴合模式实时读元素位置，滚动/动画导致的位移自动跟上
            let tx = mx + sX, ty = my + sY, speed = CFG.FOLLOW_SPEED;
            tw = textEl ? CFG.TEXT_RING_SIZE : CFG.RING_SIZE;
            th = tw; tr = tw / 2;

            if (el) {
                const r = el.getBoundingClientRect();
                if (r.width > CFG.MAX_FIT_SIZE && r.height > CFG.MAX_FIT_SIZE) {
                    if (hoverEl === el) hoverEl = null;
                    if (focusEl === el) focusEl = null;
                } else {
                    tx = r.left + r.width / 2;
                    ty = r.top + r.height / 2;
                    tw = r.width + CFG.FIT_PADDING * 2;
                    th = r.height + CFG.FIT_PADDING * 2;
                    tr = Math.min(elRad + CFG.FIT_PADDING, Math.min(tw, th) / 2);
                    speed = CFG.FIT_SPEED;
                }
            }

            // 3) 帧率无关平滑 + 临近吸附（避免无止境的小数写入）
            const k = 1 - Math.exp(-speed * dt);
            rx += (tx - rx) * k; ry += (ty - ry) * k;
            if (Math.abs(tx - rx) < 0.05) rx = tx;
            if (Math.abs(ty - ry) < 0.05) ry = ty;

            const ks = 1 - Math.exp(-CFG.SHAPE_SPEED * dt);
            rw += (tw - rw) * ks; rh += (th - rh) * ks; rr += (tr - rr) * ks;
            if (Math.abs(tw - rw) < 0.1) rw = tw;
            if (Math.abs(th - rh) < 0.1) rh = th;
            if (Math.abs(tr - rr) < 0.1) rr = tr;

            // 4) 点击弹簧（松开时带轻微回弹）
            const sT = pressed ? CFG.CLICK_SCALE : 1;
            dotV = (dotV + (sT - dotS) * CFG.SPRING_K * dt) * Math.exp(-CFG.SPRING_DAMP * dt);
            dotS = Math.max(0.2, dotS + dotV * dt);
            ringV = (ringV + (sT - ringS) * CFG.SPRING_K * dt) * Math.exp(-CFG.SPRING_DAMP * dt);
            ringS = Math.max(0.2, ringS + ringV * dt);

            // 5) 批量写入（缓存跳过 + 吸附跳过）
            setT(dot, mx, my, dotS, dotCache);
            setT(ring, rx, ry, ringS, ringCache);
            if (rw !== lastW) { ring.style.width = rw + 'px'; lastW = rw; }
            if (rh !== lastH) { ring.style.height = rh + 'px'; lastH = rh; }
            if (rr !== lastR) { ring.style.borderRadius = rr + 'px'; lastR = rr; }

            // 6) 空闲自动暂停：长时间无输入且所有动画已收敛 → 停止 rAF，事件再唤醒
            const settled =
                rw === tw && rh === th && rr === tr &&
                !el && sX === 0 && sY === 0 &&
                Math.abs(dotS - sT) < 0.002 && Math.abs(dotV) < 0.01 &&
                Math.abs(ringS - sT) < 0.002 && Math.abs(ringV) < 0.01;
            if (settled && t - lastInput > CFG.IDLE_PAUSE_MS) return;

            rafId = requestAnimationFrame(tick);
        }
    }

    // ================= 设置面板（篡改猴菜单入口，Shadow DOM 隔离页面样式） =================
    let panelHost = null, panelOpen = false;

    const decimals = f => String(f.step).includes('.') ? String(f.step).split('.')[1].length : 0;
    const fmt = (v, f) => (+v).toFixed(decimals(f)) + (f.unit ? ' ' + f.unit : '');
    const curVal = f => (f.key in overrides ? overrides[f.key] : DEFAULTS[f.key]);

    function rowsHTML() {
        let html = '', lastG = '';
        for (const f of FIELDS) {
            if (f.g !== lastG) {
                if (lastG) html += '</section>';
                html += '<section><h3>' + f.g + '</h3>';
                lastG = f.g;
            }
            const v = curVal(f);
            const p = ((v - f.min) / (f.max - f.min) * 100).toFixed(1);
            html +=
                '<label class="row">' +
                    '<span class="lab">' + f.label + '</span>' +
                    '<input type="range" data-k="' + f.key + '" min="' + f.min + '" max="' + f.max +
                        '" step="' + f.step + '" value="' + v + '" style="--p:' + p + '%">' +
                    '<span class="val">' + fmt(v, f) + '</span>' +
                '</label>';
        }
        return html + '</section>';
    }

    function buildPanel() {
        panelHost = document.createElement('div');
        const hs = panelHost.style;
        hs.setProperty('position', 'fixed', 'important');
        hs.setProperty('right', '20px', 'important');
        hs.setProperty('top', '50%', 'important');
        hs.setProperty('transform', 'translateY(-50%)', 'important');
        hs.setProperty('z-index', '2147483646', 'important');   // 比光标低一层
        hs.setProperty('color-scheme', 'dark', 'important');

        const sh = panelHost.attachShadow({ mode: 'closed' });
        sh.innerHTML =
            '<style>' +
                '*{box-sizing:border-box;margin:0;padding:0}' +
                '.panel{width:340px;max-height:min(620px,88vh);display:flex;flex-direction:column;' +
                    'background:rgba(18,19,23,.97);border:1px solid rgba(255,255,255,.1);border-radius:12px;' +
                    'box-shadow:0 24px 60px rgba(0,0,0,.55),0 2px 12px rgba(0,0,0,.4);' +
                    'font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;' +
                    'color:#e8e9ec;overflow:hidden;user-select:none}' +
                '.panel.pop{animation:pop .18s cubic-bezier(.2,.9,.3,1.2)}' +
                '@keyframes pop{from{opacity:0;transform:scale(.95) translateX(8px)}}' +
                'header{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 10px 16px;' +
                    'border-bottom:1px solid rgba(255,255,255,.07)}' +
                '.ttl{font:700 13px/1 ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;letter-spacing:.06em}' +
                '.ver{font:600 10px/1 ui-monospace,Menlo,Consolas,monospace;color:#8b8e98;' +
                    'background:rgba(255,255,255,.07);padding:3px 6px;border-radius:4px;margin-left:8px;vertical-align:1px}' +
                '.x{width:26px;height:26px;border:none;border-radius:7px;background:transparent;color:#9a9da6;' +
                    'font-size:13px;line-height:1;cursor:none;transition:background .15s,color .15s}' +
                '.x:hover{background:rgba(255,255,255,.09);color:#fff}' +
                '.rm{margin:10px 14px 0;padding:7px 10px;font-size:11px;color:#e8c98a;' +
                    'background:rgba(232,201,138,.08);border:1px solid rgba(232,201,138,.18);border-radius:7px}' +
                '.body{overflow-y:auto;padding:2px 16px 10px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent}' +
                '.body::-webkit-scrollbar{width:8px}' +
                '.body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:4px}' +
                'section h3{font-size:10px;font-weight:600;letter-spacing:.24em;color:#787b85;margin:14px 2px 4px}' +
                '.row{display:grid;grid-template-columns:96px 1fr 62px;gap:10px;align-items:center;padding:3px 0}' +
                '.lab{font-size:12px;color:#b7bac3;white-space:nowrap}' +
                '.val{font:500 11px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:#dfe1e6;' +
                    'text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}' +
                'input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:26px;' +
                    'background:transparent;cursor:none;margin:0}' +
                'input[type=range]::-webkit-slider-runnable-track{height:3px;border-radius:2px;' +
                    'background:linear-gradient(90deg,#fff var(--p,50%),rgba(255,255,255,.16) var(--p,50%))}' +
                'input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;margin-top:-5px;' +
                    'border-radius:50%;background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.55);transition:transform .15s ease}' +
                'input[type=range]:hover::-webkit-slider-thumb{transform:scale(1.25)}' +
                'input[type=range]:active::-webkit-slider-thumb{transform:scale(.9)}' +
                'input[type=range]::-moz-range-track{height:3px;border-radius:2px;background:rgba(255,255,255,.16)}' +
                'input[type=range]::-moz-range-progress{height:3px;border-radius:2px;background:#fff}' +
                'input[type=range]::-moz-range-thumb{width:13px;height:13px;border:none;border-radius:50%;' +
                    'background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.55)}' +
                'input[type=range]:focus-visible{outline:2px solid rgba(255,255,255,.45);outline-offset:2px;border-radius:6px}' +
                'footer{display:flex;align-items:center;gap:8px;padding:10px 14px 13px;' +
                    'border-top:1px solid rgba(255,255,255,.07)}' +
                'button{font:inherit}' +
                '.ghost{background:transparent;border:1px solid rgba(255,255,255,.16);color:#c3c6cd;font-size:12px;' +
                    'padding:6px 12px;border-radius:7px;cursor:none;transition:border-color .15s,color .15s}' +
                '.ghost:hover{border-color:rgba(255,255,255,.42);color:#fff}' +
                '.prime{background:#fff;color:#131417;border:none;font-size:12px;font-weight:650;padding:7px 16px;' +
                    'border-radius:7px;cursor:none;transition:transform .15s,box-shadow .15s}' +
                '.prime:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(255,255,255,.16)}' +
                '.prime:active{transform:translateY(0)}' +
                '.saved{flex:1;text-align:center;font-size:11px;color:#8fd6a8;opacity:0;transition:opacity .35s}' +
                '.saved.on{opacity:1}' +
            '</style>' +
            '<div class="panel" role="dialog" aria-label="Cursor FX 设置">' +
                '<header>' +
                    '<span class="ttl">Cursor FX<span class="ver">v2.1</span></span>' +
                    '<button class="x" data-act="close" aria-label="关闭">✕</button>' +
                '</header>' +
                (RM ? '<p class="rm">系统启用了「减少动态效果」，动画已自动弱化</p>' : '') +
                '<div class="body">' + rowsHTML() + '</div>' +
                '<footer>' +
                    '<button class="ghost" data-act="reset">恢复默认</button>' +
                    '<span class="saved">✓ 已保存</span>' +
                    '<button class="prime" data-act="close">完成</button>' +
                '</footer>' +
            '</div>';

        const body = sh.querySelector('.body');
        const saved = sh.querySelector('.saved');
        let saveT = 0, flashT = 0;

        function flash(msg) {
            saved.textContent = msg;
            saved.classList.add('on');
            clearTimeout(flashT);
            flashT = setTimeout(() => saved.classList.remove('on'), 1100);
        }
        function scheduleSave() {
            clearTimeout(saveT);
            saveT = setTimeout(() => { store.write('overrides', overrides); flash('✓ 已保存'); }, 350);
        }

        // 拖动滑杆：即时生效 + 防抖落盘
        body.addEventListener('input', (e) => {
            const k = e.target.dataset && e.target.dataset.k;
            if (!k) return;
            const f = FMAP[k];
            const v = clamp(parseFloat(e.target.value), f.min, f.max);
            overrides[k] = v;
            e.target.closest('.row').querySelector('.val').textContent = fmt(v, f);
            e.target.style.setProperty('--p', ((v - f.min) / (f.max - f.min) * 100).toFixed(1) + '%');
            commit();
            scheduleSave();
        });

        sh.querySelector('.panel').addEventListener('click', (e) => {
            const b = e.target.closest('[data-act]');
            if (!b) return;
            if (b.dataset.act === 'close') closePanel();
            else if (b.dataset.act === 'reset') {
                for (const k in overrides) delete overrides[k];
                store.erase('overrides');
                body.querySelectorAll('input[type=range]').forEach(inp => {
                    const f = FMAP[inp.dataset.k];
                    const v = DEFAULTS[f.key];
                    inp.value = v;
                    inp.style.setProperty('--p', ((v - f.min) / (f.max - f.min) * 100).toFixed(1) + '%');
                    inp.closest('.row').querySelector('.val').textContent = fmt(v, f);
                });
                commit();
                flash('✓ 已恢复默认');
            }
        });

        document.body.appendChild(panelHost);
    }

    function openPanel() {
        if (!panelHost) buildPanel();
        panelOpen = true;
        panelHost.style.display = 'block';
        const p = panelHost.shadowRoot.querySelector('.panel');
        p.classList.remove('pop');
        void p.offsetWidth;          // 重新触发入场动画
        p.classList.add('pop');
    }
    function closePanel() {
        if (!panelOpen) return;
        panelOpen = false;
        panelHost.style.display = 'none';
    }
    function togglePanel() {
        if (!document.body) {        // 极端情况：document-start 阶段就点了菜单
            addEventListener('DOMContentLoaded', () => togglePanel(), { once: true });
            return;
        }
        panelOpen ? closePanel() : openPanel();
    }

    // Esc 关闭；点击面板以外区域关闭
    addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
    document.addEventListener('pointerdown', (e) => {
        if (panelOpen && panelHost && !panelHost.contains(e.target)) closePanel();
    }, true);

    // 注册篡改猴菜单命令（面板入口）
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('⚙ 光标设置', togglePanel);
    }
})();