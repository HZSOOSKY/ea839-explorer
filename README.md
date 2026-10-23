# 保时捷 EA839 4.0 V8 · 交互式拆解可视化

基于 three.js 的浏览器端 3D 可视化：把一台 4.0L 双涡轮 V8 发动机程序化建模出来，可拆解、可单件查看、可点火运转。

## 在线访问

**https://hzsoosky.github.io/ea839-explorer/**

打开即用，无需安装。建议使用桌面版 Chrome / Edge / Firefox（支持 WebGL2）。

## 功能

| 功能 | 说明 |
| --- | --- |
| 整机拆解 | 滑块 0–100%，可停在任意中间状态观察装配关系 |
| 单件独显 | 点击部件单独查看，其余半透明；附带材料 / 工艺 / 性能参数 |
| 点火运转 | 曲轴、连杆、活塞、凸轮轴、气门联动，含排气火焰；转速 0–2000 rpm 可调 |
| 分组浏览 | 9 大分组、30+ 部件，支持中英文搜索 |
| 标注开关 | 部件标签可整体显示 / 隐藏 |

操作：左键拖拽旋转，滚轮缩放，右键平移。

## 本地运行

需要通过 HTTP 访问（ES Modules 不支持 `file://` 协议）：

```bash
python -m http.server 8080
# 打开 http://localhost:8080/
```

three.js r169 已内置在 `vendor/`，无需 `npm install`、无需联网。

## 技术栈

- [three.js](https://threejs.org/) r169（MIT）— 渲染、OrbitControls、EffectComposer + UnrealBloomPass
- 原生 ES Modules + Import Map，零构建步骤
- 几何体全部由代码程序化生成，不加载外部模型文件

## 说明

- 几何为**程序化近似建模**，依据公开技术资料整理，非官方 CAD 数据，尺寸与结构经过简化，不可用于工程用途。
- 第三方授权：three.js（MIT），版权声明保留在 `vendor/` 各文件头部。
- 本仓库为在线演示站；完整开发源码与文档归档在 `3dcodinglabs` 仓库的 `projects/EA834-Workbuddy/`。
