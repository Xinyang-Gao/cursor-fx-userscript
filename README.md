# Cursor FX

隐藏系统指针的自定义光标油猴脚本：延迟跟随圆环、悬停元素贴合、
文本区竖条、点击弹性缩放、滚动拖尾。

## 安装

需先安装 [Tampermonkey](https://www.tampermonkey.net/) 或 Violentmonkey，然后点：

**[▶ 安装脚本](https://raw.githubusercontent.com/Xinyang-Gao/cursor-fx-userscript/main/cursor-fx-userscript.user.js)**

## 特性

- 圆点 + 圆环，`mix-blend-mode: difference` 反色，任何背景可见
- 悬停链接/按钮时圆环贴合元素形状与圆角，支持键盘 Tab 聚焦
- 文本输入区圆点变竖条，圆环缩小降透明
- 点击弹簧缩放，滚动惯性拖尾
- 全程 transform 合成层定位，空闲自动暂停 rAF
