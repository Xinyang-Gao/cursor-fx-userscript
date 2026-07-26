// ==UserScript==
// @name         Cursor FX
// @name:zh-CN   自定义鼠标光标特效
// @namespace    https://github.com/Xinyang-Gao/cursor-fx-userscript
// @version      2.0.0
// @description  Smooth custom cursor: delayed ring follow, hover fitting, text caret mode, click spring scale, scroll trail. GPU-composited, frame-rate independent, auto-pauses when idle.
// @description:zh-CN  隐藏系统指针，使用圆点 + 圆环自定义光标：延迟跟随、悬停贴合、文本竖条、点击弹性缩放、滚动拖尾。transform 合成层定位，帧率无关平滑，空闲自动暂停。
// @author       Xinyang-Gao
// @license      MIT
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @noframes
// @homepageURL  https://github.com/Xinyang-Gao/cursor-fx-userscript
// @supportURL   https://github.com/Xinyang-Gao/cursor-fx-userscript/issues
// @downloadURL  https://raw.githubusercontent.com/Xinyang-Gao/cursor-fx-userscript/main/cursor-fx-userscript.user.js
// @updateURL    https://raw.githubusercontent.com/Xinyang-Gao/cursor-fx-userscript/main/cursor-fx-userscript.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // ================= 可调参数 =================
    const CFG = {
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
    // =============================================

    // 触屏设备无需光标特效，直接退出
    if (matchMedia('(pointer: coarse)').matches) return;

    // 尊重系统"减少动态效果"设置
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        Object.assign(CFG, {
            FOLLOW_SPEED: 1e4, FIT_SPEED: 1e4, SHAPE_SPEED: 1e4,
            SCROLL_MAX: 0, SPRING_K: 1e4, SPRING_DAMP: 1e4,
        });
    }

    // ---------- 样式：尽早注入，第一时间隐藏原生指针 ----------
    // 定位只使用 transform（合成器层，不触发布局回流）
    const style = document.createElement('style');
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

        const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

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
            if (!(t instanceof Element)) return;

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
            if (!(t instanceof Element) || t.matches(SEL_TEXT) || !t.matches(SEL_INTERACTIVE)) return;
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
})();
