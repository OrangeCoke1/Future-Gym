# Future-Gym · 未来健身 2126

网页版健身动作识别原型：3D 小人做动作并计数，也可以用摄像头识别真人动作。纯前端，没有后端。

## 运行

先装 [Node.js](https://nodejs.org/)（自带 npm，版本要 20.19 以上或 22.12 以上），然后：

```
cd stickman-preview
npm install      # 第一次运行时安装依赖
npm run dev      # 启动，打开 http://localhost:8000（地址会变成 http://localhost:8000/#/）
```

改代码后保存，浏览器会自动刷新。用 Chrome 或 Edge 打开。

### Windows 双击运行

双击 `stickman-preview/start.bat`：没有 `dist/` 时它会先构建（需要 Node.js），然后启动本地服务器并打开 `http://localhost:8000`。它只在没有 `dist/` 时才构建，所以拉取新代码后要先在 `stickman-preview/` 里运行一次 `npm run build`（或者删掉 `dist/`），否则打开的还是旧版本。

没有 Node.js 的电脑：在装了 Node.js 的电脑上运行 `npm run build`，把生成的 `stickman-preview/dist/` 文件夹拷到这台电脑的 `stickman-preview/` 里，再双击 `start.bat`。

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
| 页面有哪些、地址是什么 | `router/index.js` |
| 页面的整体框架（顶栏、设置面板） | `layouts/AppLayout.vue` |
| 每个页面放哪些区域 | `views/`（一个页面一个文件，只属于该页面的区域放在 `views/页面名/`） |
| 界面上的文字、按钮、卡片 | `components/`（`.vue` 文件） |
| 中文 / 日文 / 英文翻译 | `i18n/messages.js` |
| 样式 | `styles/` |

## 没学过 Vue 也能看懂

一个 `.vue` 文件就是一块界面，分三段：
- `<script setup>`：普通 JavaScript；
- `<template>`：HTML，里面的 `{{ x }}` 会显示变量 `x` 的值，`@click="f()"` 表示点击时调用 `f()`；
- `<style>`（可选）：CSS。

界面不做计算。数据都由 `engine/` 里的普通 JavaScript 每帧算好，`.vue` 文件只负责显示，并把按钮操作传回去。所以改功能时一般先看 `engine/`、`core/`、`sim/`，只有改显示时才需要碰 `.vue` 文件。

## 用录好的视频测量跟随速度

`stickman-preview/tools/` 里有两个离线工具（需要 Node、ffmpeg 和 Playwright，不进网页打包）：

```
cd stickman-preview
node tools/pose-extract.mjs 视频1.mp4 视频2.mov …   # 每段视频逐帧跑 MediaPipe（和网页同一个模型），存成 tools/poses/<名字>.json
node tools/follow-bench.mjs tools/poses/*.json      # 用网页里同一套滤波和预测回放，量出小人比真人慢多少
node tools/follow-bench.mjs tools/poses/*.json --sweep   # 试一组参数，按延迟排序
```

```
node tools/count-bench.mjs tools/poses/*.json       # 用网页里的计数规则数一遍（宽松 / 标准两种），和文件名里的正确次数对比
```

视频文件名按 `动作_人编号_次数` 命名（如 `深蹲_01_9.mp4`），`count-bench` 就会自动对比；第一批 8 个人的深蹲：宽松 8/8 全对，标准 2/8。

`follow-bench` 假设摄像头延迟 50 ms、识别 35 ms（`--cam`、`--infer` 可改），把「零延迟平滑后的真实关节」和「小人当时的姿势」比：膝、髋、肘角度的延迟（ms）、误差、静止时的抖动和到底 / 到顶时冲过头的角度（°）。参数 `--minCut`、`--beta`、`--lead` 对应 面板 → 摄像头跟随。

## 更多

人体模型 “Male Body” 作者是 Alexander Antipov，采用 [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) 许可，对外展示时请保留署名。
