// ==UserScript==
// @name         Cursor FX
// @name:zh-CN   自定义鼠标光标特效
// @namespace    https://github.com/Xinyang-Gao/cursor-fx-userscript
// @version      2.3.0
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

    // ================= I18N 配置 =================
    const LANGUAGES = {
        'zh-CN': {
            name: '简体中文',
            dict: {
                title: 'Cursor FX 设置',
                versionPrefix: 'v',
                reducedMotionMsg: '系统启用了「减少动态效果」，动画已自动弱化',
                groups: {
                    appearance: '外观',
                    fit: '贴合',
                    follow: '跟随',
                    click: '点击',
                    scroll: '滚动',
                    text: '文本',
                    other: '其他'
                },
                labels: {
                    DOT_SIZE: '圆点大小',
                    RING_SIZE: '圆环大小',
                    RING_BORDER: '圆环粗细',
                    RING_ALPHA: '圆环透明度',
                    FIT_PADDING: '贴合留白',
                    MAX_FIT_SIZE: '最大贴合尺寸',
                    FOLLOW_SPEED: '跟随速度',
                    FIT_SPEED: '吸附速度',
                    SHAPE_SPEED: '形变速度',
                    CLICK_SCALE: '按下缩放',
                    SPRING_K: '回弹刚度',
                    SPRING_DAMP: '回弹阻尼',
                    SCROLL_MAX: '拖尾幅度',
                    SCROLL_DECAY: '拖尾回收',
                    TEXT_BAR_W: '竖条宽度',
                    TEXT_BAR_H: '竖条高度',
                    TEXT_RING_SIZE: '文本环大小',
                    TEXT_RING_ALPHA: '文本环透明度',
                    IDLE_PAUSE_MS: '空闲暂停'
                },
                buttons: {
                    reset: '恢复默认',
                    close: '完成',
                    saved: '✓ 已保存',
                    restored: '✓ 已恢复默认'
                },
                settings: {
                    language: '界面语言',
                    langOptionZh: '简体中文',
                    langOptionEn: 'English'
                }
            }
        },
        'en': {
            name: 'English',
            dict: {
                title: 'Cursor FX Settings',
                versionPrefix: 'v',
                reducedMotionMsg: 'System "Reduce Motion" is enabled. Animations are minimized.',
                groups: {
                    appearance: 'Appearance',
                    fit: 'Fitting',
                    follow: 'Following',
                    click: 'Click',
                    scroll: 'Scroll',
                    text: 'Text',
                    other: 'Other'
                },
                labels: {
                    DOT_SIZE: 'Dot Size',
                    RING_SIZE: 'Ring Size',
                    RING_BORDER: 'Ring Border',
                    RING_ALPHA: 'Ring Opacity',
                    FIT_PADDING: 'Fit Padding',
                    MAX_FIT_SIZE: 'Max Fit Size',
                    FOLLOW_SPEED: 'Follow Speed',
                    FIT_SPEED: 'Fit Speed',
                    SHAPE_SPEED: 'Shape Speed',
                    CLICK_SCALE: 'Click Scale',
                    SPRING_K: 'Spring Stiffness',
                    SPRING_DAMP: 'Spring Damping',
                    SCROLL_MAX: 'Scroll Trail Max',
                    SCROLL_DECAY: 'Scroll Decay',
                    TEXT_BAR_W: 'Bar Width',
                    TEXT_BAR_H: 'Bar Height',
                    TEXT_RING_SIZE: 'Text Ring Size',
                    TEXT_RING_ALPHA: 'Text Ring Alpha',
                    IDLE_PAUSE_MS: 'Idle Pause'
                },
                buttons: {
                    reset: 'Reset Defaults',
                    close: 'Done',
                    saved: '✓ Saved',
                    restored: '✓ Defaults Restored'
                },
                settings: {
                    language: 'Interface Language',
                    langOptionZh: '简体中文',
                    langOptionEn: 'English'
                }
            }
        }
    };

    // 获取当前语言，优先读取存储，其次浏览器语言，最后默认英文
    function getInitialLang() {
        try {
            if (typeof GM_getValue === 'function') {
                const v = GM_getValue('CursorFX.lang', null);
                if (v && LANGUAGES[v]) return v;
            } else {
                const v = localStorage.getItem('CursorFX.lang');
                if (v && LANGUAGES[v]) return v;
            }
        } catch (e) {}

        // Fallback to browser language
        const browserLang = navigator.language || 'en';
        if (browserLang.startsWith('zh')) return 'zh-CN';
        return 'en';
    }

    let CURRENT_LANG = getInitialLang();

    // 翻译辅助函数
    function t(key, ...args) {
        const dict = LANGUAGES[CURRENT_LANG].dict;
        let val = key.split('.').reduce((o, i) => (o ? o[i] : null), dict);
        if (val === undefined || val === null) return key; // Fallback
        return val;
    }

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
    const CFG = { ...DEFAULTS };// 运行时实际生效值 = 默认值 + 用户设置（+ 减少动态效果覆盖）

    const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

    if (matchMedia('(pointer: coarse)').matches) return;

    // ---------- 设置存储 ----------
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
            } catch { /* ignore */ }
        },
        erase(k) {
            try {
                if (typeof GM_deleteValue === 'function') GM_deleteValue(k);
                else localStorage.removeItem('CursorFX.' + k);
            } catch { /* ignore */ }
        },
    };

    // ---------- 设置字段定义 ----------
    const FIELDS = [
        { g: 'appearance', key: 'DOT_SIZE', label: 'DOT_SIZE', min: 2, max: 24, step: 1, unit: 'px' },
        { g: 'appearance', key: 'RING_SIZE', label: 'RING_SIZE', min: 16, max: 96, step: 2, unit: 'px' },
        { g: 'appearance', key: 'RING_BORDER', label: 'RING_BORDER', min: 0.5, max: 6, step: 0.5, unit: 'px' },
        { g: 'appearance', key: 'RING_ALPHA', label: 'RING_ALPHA', min: 0.1, max: 1, step: 0.05, unit: '' },
        { g: 'fit', key: 'FIT_PADDING', label: 'FIT_PADDING', min: 0, max: 24, step: 1, unit: 'px' },
        { g: 'fit', key: 'MAX_FIT_SIZE', label: 'MAX_FIT_SIZE', min: 80, max: 480, step: 10, unit: 'px' },
        { g: 'follow', key: 'FOLLOW_SPEED', label: 'FOLLOW_SPEED', min: 2, max: 40, step: 1, unit: '' },
        { g: 'follow', key: 'FIT_SPEED', label: 'FIT_SPEED', min: 4, max: 80, step: 1, unit: '' },
        { g: 'follow', key: 'SHAPE_SPEED', label: 'SHAPE_SPEED', min: 4, max: 80, step: 1, unit: '' },
        { g: 'click', key: 'CLICK_SCALE', label: 'CLICK_SCALE', min: 0.4, max: 1, step: 0.02, unit: '' },
        { g: 'click', key: 'SPRING_K', label: 'SPRING_K', min: 100, max: 1200, step: 20, unit: '' },
        { g: 'click', key: 'SPRING_DAMP', label: 'SPRING_DAMP', min: 5, max: 40, step: 1, unit: '' },
        { g: 'scroll', key: 'SCROLL_MAX', label: 'SCROLL_MAX', min: 0, max: 80, step: 2, unit: 'px' },
        { g: 'scroll', key: 'SCROLL_DECAY', label: 'SCROLL_DECAY', min: 1, max: 20, step: 0.5, unit: '' },
        { g: 'text', key: 'TEXT_BAR_W', label: 'TEXT_BAR_W', min: 1, max: 6, step: 0.5, unit: 'px' },
        { g: 'text', key: 'TEXT_BAR_H', label: 'TEXT_BAR_H', min: 12, max: 40, step: 1, unit: 'px' },
        { g: 'text', key: 'TEXT_RING_SIZE', label: 'TEXT_RING_SIZE', min: 12, max: 64, step: 2, unit: 'px' },
        { g: 'text', key: 'TEXT_RING_ALPHA', label: 'TEXT_RING_ALPHA', min: 0.1, max: 1, step: 0.05, unit: '' },
        { g: 'other', key: 'IDLE_PAUSE_MS', label: 'IDLE_PAUSE_MS', min: 500, max: 10000, step: 250, unit: 'ms' },
    ];
    const FMAP = {};
    FIELDS.forEach(f => FMAP[f.key] = f);

    // 读取覆盖项
    const overrides = {};
    {
        const raw = store.read('overrides', {});
        for (const f of FIELDS) {
            const v = raw[f.key];
            if (typeof v === 'number' && isFinite(v)) overrides[f.key] = clamp(v, f.min, f.max);
        }
    }

    // 减少动态效果
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const RM_PATCH = RM ? {
        FOLLOW_SPEED: 1e4, FIT_SPEED: 1e4, SHAPE_SPEED: 1e4,
        SCROLL_MAX: 0, SPRING_K: 1e4, SPRING_DAMP: 1e4,
    } : null;

    // ---------- 样式 ----------
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
        document.body.append(ring, dot);
        run(dot, ring);
    }
    document.body ? spawn() : document.addEventListener('DOMContentLoaded', spawn, { once: true });

    function run(dot, ring) {
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

        function measure(el) {
            const r = el.getBoundingClientRect();
            if (r.width > CFG.MAX_FIT_SIZE && r.height > CFG.MAX_FIT_SIZE) return null;
            const br = getComputedStyle(el).borderRadius || '0px';
            return br.indexOf('%') > -1
                ? parseFloat(br) / 100 * Math.min(r.width, r.height)  // 百分比圆角（圆形/胶囊）换算
                : parseFloat(br) || 0;
        }

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

        function wake() {
            lastInput = performance.now();
            show();
            if (!rafId) { lastT = lastInput; rafId = requestAnimationFrame(tick); }
        }

        addEventListener('pointermove', (e) => {
            if (e.pointerType === 'touch') return;
            mx = e.clientX; my = e.clientY;
            if (focusEl) focusEl = null;
            wake();
        }, { passive: true });

        addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; pressed = true; wake(); });
        addEventListener('pointerup', () => { pressed = false; wake(); });
        addEventListener('pointercancel', () => { pressed = false; wake(); });

        addEventListener('wheel', (e) => {
            if (hoverEl || focusEl) return;
            const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? innerHeight : 1);
            sX = clamp(sX - clamp(e.deltaX * unit, -80, 80), -CFG.SCROLL_MAX, CFG.SCROLL_MAX);
            sY = clamp(sY - clamp(e.deltaY * unit, -80, 80), -CFG.SCROLL_MAX, CFG.SCROLL_MAX);
            wake();
        }, { passive: true });

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

        document.addEventListener('focusin', (e) => {
            const t = e.target;
            if (!t || t.nodeType !== 1 || t.matches(SEL_TEXT) || !t.matches(SEL_INTERACTIVE)) return;
            const m = measure(t);
            if (m !== null) { focusEl = t; focusRad = m; wake(); }
        });
        document.addEventListener('focusout', (e) => {
            if (focusEl === e.target) { focusEl = null; wake(); }
        });

        const docEl = document.documentElement;
        docEl.addEventListener('mouseenter', () => { inside = true; wake(); });
        docEl.addEventListener('mouseleave', () => { inside = false; hide(); });
        addEventListener('blur', hide);
        addEventListener('focus', () => { if (inside) wake(); });

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

        function setT(el, x, y, s, cache) {
            const v = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) translate(-50%,-50%) scale(' + s.toFixed(3) + ')';
            if (cache.v !== v) { cache.v = v; el.style.transform = v; }
        }

        setT(dot, mx, my, 1, dotCache);
        setT(ring, rx, ry, 1, ringCache);

        api = {
            refresh() {
                const b = dotIsBar; dotIsBar = !b; setDotShape(b);
                const d = ringDim; ringDim = !d; setRingAlpha(d);
                lastW = lastH = lastR = -1;
                dotCache.v = ringCache.v = '';
                wake();
            }
        };

        const WEB_API_VERSION = '1.0';
        function handleWebRequest(e) {
            const { action, requestId, payload } = e.detail || {};
            if (!action) return;
            let result;
            try {
                switch (action) {
                    case 'ping': result = { status: 'alive', version: WEB_API_VERSION }; break;
                    case 'getStatus': result = { visible: shown, pressed, hoverEl: !!hoverEl, focusEl: !!focusEl, textMode: dotIsBar, ringDim, scrollOffset: { x: sX, y: sY }, dotScale: dotS, ringScale: ringS }; break;
                    case 'getSettings':
                        const settings = {};
                        for (const f of FIELDS) settings[f.key] = CFG[f.key];
                        result = { settings }; break;
                    case 'setSetting':
                        const { key, value } = payload;
                        if (key && key in FMAP) {
                            const f = FMAP[key];
                            const clamped = clamp(value, f.min, f.max);
                            overrides[key] = clamped;
                            commit();
                            store.write('overrides', overrides);
                            result = { success: true, key, value: clamped };
                        } else { result = { success: false, error: 'Invalid key' }; }
                        break;
                    case 'resetSettings':
                        for (const k in overrides) delete overrides[k];
                        store.erase('overrides');
                        commit();
                        result = { success: true }; break;
                    case 'toggleVisible':
                        if (shown) hide(); else wake();
                        result = { visible: shown }; break;
                    case 'getVersion': result = { version: WEB_API_VERSION, scriptVersion: '2.3.0-i18n' }; break;
                    default: result = { error: 'Unknown action: ' + action };
                }
            } catch (err) { result = { error: err.message }; }
            if (requestId) {
                window.dispatchEvent(new CustomEvent('CURSORFX_RESPONSE', { detail: { requestId, result } }));
            }
        }
        window.addEventListener('CURSORFX_REQUEST', handleWebRequest);
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('CURSORFX_READY', { detail: { version: WEB_API_VERSION, scriptVersion: '2.3.0-i18n' } }));
        }, 0);

        function tick(t) {
            rafId = 0;
            const dt = clamp((t - lastT) / 1000, 0, 0.05) || 0.016;
            lastT = t;

            let el = hoverEl || focusEl;
            const elRad = hoverEl ? hoverRad : focusRad;
            if (el && !el.isConnected) {
                if (hoverEl === el) hoverEl = null;
                if (focusEl === el) focusEl = null;
                el = null;
            }

            if (sX !== 0 || sY !== 0) {
                const d = Math.exp(-CFG.SCROLL_DECAY * dt);
                sX *= d; sY *= d;
                if (Math.abs(sX) < 0.05) sX = 0;
                if (Math.abs(sY) < 0.05) sY = 0;
            }

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

            const k = 1 - Math.exp(-speed * dt);
            rx += (tx - rx) * k; ry += (ty - ry) * k;
            if (Math.abs(tx - rx) < 0.05) rx = tx;
            if (Math.abs(ty - ry) < 0.05) ry = ty;

            const ks = 1 - Math.exp(-CFG.SHAPE_SPEED * dt);
            rw += (tw - rw) * ks; rh += (th - rh) * ks; rr += (tr - rr) * ks;
            if (Math.abs(tw - rw) < 0.1) rw = tw;
            if (Math.abs(th - rh) < 0.1) rh = th;
            if (Math.abs(tr - rr) < 0.1) rr = tr;

            const sT = pressed ? CFG.CLICK_SCALE : 1;
            dotV = (dotV + (sT - dotS) * CFG.SPRING_K * dt) * Math.exp(-CFG.SPRING_DAMP * dt);
            dotS = Math.max(0.2, dotS + dotV * dt);
            ringV = (ringV + (sT - ringS) * CFG.SPRING_K * dt) * Math.exp(-CFG.SPRING_DAMP * dt);
            ringS = Math.max(0.2, ringS + ringV * dt);

            setT(dot, mx, my, dotS, dotCache);
            setT(ring, rx, ry, ringS, ringCache);
            if (rw !== lastW) { ring.style.width = rw + 'px'; lastW = rw; }
            if (rh !== lastH) { ring.style.height = rh + 'px'; lastH = rh; }
            if (rr !== lastR) { ring.style.borderRadius = rr + 'px'; lastR = rr; }

            const settled =
                rw === tw && rh === th && rr === tr &&
                !el && sX === 0 && sY === 0 &&
                Math.abs(dotS - sT) < 0.002 && Math.abs(dotV) < 0.01 &&
                Math.abs(ringS - sT) < 0.002 && Math.abs(ringV) < 0.01;
            if (settled && t - lastInput > CFG.IDLE_PAUSE_MS) return;

            rafId = requestAnimationFrame(tick);
        }
    }

    // ================= 设置面板 =================
    let panelHost = null, panelOpen = false;

    const decimals = f => String(f.step).includes('.') ? String(f.step).split('.')[1].length : 0;
    const fmt = (v, f) => (+v).toFixed(decimals(f)) + (f.unit ? ' ' + f.unit : '');
    const curVal = f => (f.key in overrides ? overrides[f.key] : DEFAULTS[f.key]);

    // 生成设置行 HTML
    function rowsHTML() {
        let html = '', lastG = '';
        for (const f of FIELDS) {
            if (f.g !== lastG) {
                if (lastG) html += '</section>';
                // 使用 t() 获取分组名称
                html += '<section><h3>' + t('groups.' + f.g) + '</h3>';
                lastG = f.g;
            }
            const v = curVal(f);
            const p = ((v - f.min) / (f.max - f.min) * 100).toFixed(1);
            // 使用 t() 获取标签名称
            html +=
                '<label class="row">' +
                '<span class="lab">' + t('labels.' + f.label) + '</span>' +
                '<input type="range" data-k="' + f.key + '" min="' + f.min + '" max="' + f.max +
                '" step="' + f.step + '" value="' + v + '" style="--p:' + p + '%">' +
                '<span class="val">' + fmt(v, f) + '</span>' +
                '</label>';
        }
        return html + '</section>';
    }

    // 构建面板
    function buildPanel() {
        panelHost = document.createElement('div');
        const hs = panelHost.style;
        hs.setProperty('position', 'fixed', 'important');
        hs.setProperty('right', '20px', 'important');
        hs.setProperty('top', '50%', 'important');
        hs.setProperty('transform', 'translateY(-50%)', 'important');
        hs.setProperty('z-index', '2147483646', 'important');
        hs.setProperty('color-scheme', 'dark', 'important');

        const sh = panelHost.attachShadow({ mode: 'closed' });

        // 动态生成 HTML 内容，使用 t() 进行翻译
        const titleText = t('title');
        const verText = t('versionPrefix') + '2.3';
        const rmMsg = t('reducedMotionMsg');
        const btnReset = t('buttons.reset');
        const btnClose = t('buttons.close');
        const lblLang = t('settings.language');
        const optZh = t('settings.langOptionZh');
        const optEn = t('settings.langOptionEn');

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

            /* 语言选择器样式 */
            '.lang-row{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;' +
            'border-top:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02)}' +
            '.lang-label{font-size:12px;color:#b7bac3}' +
            'select.lang-select{background:rgba(0,0,0,.3);color:#e8e9ec;border:1px solid rgba(255,255,255,.15);' +
            'border-radius:6px;padding:4px 8px;font-size:12px;outline:none;cursor:none}' +
            'select.lang-select:hover{border-color:rgba(255,255,255,.3)}' +

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
            '<div class="panel" role="dialog" aria-label="Cursor FX Settings">' +
            '<header>' +
            '<span class="ttl">' + titleText + '<span class="ver">' + verText + '</span></span>' +
            '<button class="x" data-act="close" aria-label="Close">✕</button>' +
            '</header>' +
            (RM ? '<p class="rm">' + rmMsg + '</p>' : '') +
            '<div class="body">' + rowsHTML() + '</div>' +

            // 语言切换区域
            '<div class="lang-row">' +
            '<span class="lang-label">' + lblLang + '</span>' +
            '<select class="lang-select" id="lang-selector">' +
            '<option value="zh-CN"' + (CURRENT_LANG === 'zh-CN' ? ' selected' : '') + '>' + optZh + '</option>' +
            '<option value="en"' + (CURRENT_LANG === 'en' ? ' selected' : '') + '>' + optEn + '</option>' +
            '</select>' +
            '</div>' +

            '<footer>' +
            '<button class="ghost" data-act="reset">' + btnReset + '</button>' +
            '<span class="saved">' + t('buttons.saved') + '</span>' +
            '<button class="prime" data-act="close">' + btnClose + '</button>' +
            '</footer>' +
            '</div>';

        const body = sh.querySelector('.body');
        const saved = sh.querySelector('.saved');
        const langSelect = sh.querySelector('#lang-selector');
        let saveT = 0, flashT = 0;

        function flash(msgKey) {
            saved.textContent = t(msgKey);
            saved.classList.add('on');
            clearTimeout(flashT);
            flashT = setTimeout(() => saved.classList.remove('on'), 1100);
        }
        function scheduleSave() {
            clearTimeout(saveT);
            saveT = setTimeout(() => { store.write('overrides', overrides); flash('buttons.saved'); }, 350);
        }

        // 滑动条事件
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

        // 语言切换事件
        langSelect.addEventListener('change', (e) => {
            const newLang = e.target.value;
            if (LANGUAGES[newLang]) {
                CURRENT_LANG = newLang;
                // 保存语言设置
                try {
                    if (typeof GM_setValue === 'function') GM_setValue('CursorFX.lang', newLang);
                    else localStorage.setItem('CursorFX.lang', newLang);
                } catch(err) {}

                // 重新构建面板以应用新语言
                // 注意：由于 Shadow DOM 封闭性，最简单的方法是移除旧节点并重建
                closePanel();
                buildPanel();
                openPanel();
            }
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
                flash('buttons.restored');
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
        void p.offsetWidth;
        p.classList.add('pop');
    }
    function closePanel() {
        if (!panelOpen) return;
        panelOpen = false;
        panelHost.style.display = 'none';
    }
    function togglePanel() {
        if (!document.body) {
            addEventListener('DOMContentLoaded', () => togglePanel(), { once: true });
            return;
        }
        panelOpen ? closePanel() : openPanel();
    }

    addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
    document.addEventListener('pointerdown', (e) => {
        if (panelOpen && panelHost && !panelHost.contains(e.target)) closePanel();
    }, true);

    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('⚙ Cursor FX Settings', togglePanel);
    }
})();