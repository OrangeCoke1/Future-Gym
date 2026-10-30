# Future-Gym · 未来健身 2126

网页版健身动作识别原型：3D 小人做动作并计数，也可以用摄像头识别真人动作。纯前端，没有后端。

## 运行

先装 [Node.js](https://nodejs.org/)（自带 npm），然后：

```
cd stickman-preview
npm install      # 第一次运行时安装依赖
npm run dev      # 启动，打开 http://localhost:8000
```

改代码后保存，浏览器会自动刷新。用 Chrome 或 Edge 打开。

## 代码在哪

全部在 `stickman-preview/src/`。大部分是普通 JavaScript，只有界面部分用到 Vue。

| 想改什么 | 去哪里 |
| --- | --- |
| 动作、计数规则 | `core/actions.js` |
| 心率、肌群等模拟数据的算法 | `sim/` |
| 摄像头识别规则（摄像头组提供，需要和他们同步） | `pose/fit.js` |
| 3D 小人的绘制 | `render/` |
| 卡片上的小图表 | `charts/` |
| 每帧的主流程（把上面这些串起来） | `engine/engine.js` |
| 界面上的文字、按钮、卡片 | `components/`（`.vue` 文件） |
| 中文 / 日文 / 英文翻译 | `i18n/messages.js` |
| 样式 | `styles/` |

## 没学过 Vue 也能看懂

一个 `.vue` 文件就是一块界面，分三段：
- `<script setup>`：普通 JavaScript；
- `<template>`：HTML，里面的 `{{ x }}` 会显示变量 `x` 的值，`@click="f()"` 表示点击时调用 `f()`；
- `<style>`（可选）：CSS。

界面不做计算。数据都由 `engine/` 里的普通 JavaScript 每帧算好，`.vue` 文件只负责显示，并把按钮操作传回去。所以改功能时一般先看 `engine/`、`core/`、`sim/`，只有改显示时才需要碰 `.vue` 文件。

## 更多

详细说明（每项功能怎么算、没有 Node.js 时怎么运行、已知问题）见 [`stickman-preview/README.md`](stickman-preview/README.md)。

人体模型 “Male Body” 作者是 Alexander Antipov，采用 [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) 许可，对外展示时请保留署名。
