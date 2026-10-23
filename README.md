# 保时捷 EA839 4.0 V8 · 交互式拆解可视化

基于 three.js 的浏览器端 3D 可视化：把一台 4.0L 双涡轮 V8 发动机程序化建模出来，可拆解、可单件查看、可剖切、可点火运转。

## 在线访问

**https://hzsoosky.github.io/ea839-explorer/**

打开即用，无需安装。建议使用桌面版 Chrome / Edge / Firefox（支持 WebGL2）。
首次进入会自动弹出「应用介绍」，内含功能介绍、应用车型、技术规格与快捷键四页，也可按 <kbd>I</kbd> 随时打开。

## 功能

| 功能 | 说明 |
| --- | --- |
| 整机拆解 | 滑块 0–100%，可停在任意中间状态观察装配关系 |
| 单件独显 | 点击部件单独查看，其余半透明；附带材料 / 工艺 / 性能参数 |
| 点火运转 | 曲轴、连杆、活塞、凸轮轴、气门联动，含排气火焰；转速 0–2000 rpm 可调 |
| 分组浏览 | 9 大分组、31 个部件，支持中英文搜索 |
| 三态标注 | 关闭 / 智能（仅选中·悬停·已拆解）/ 全部，自动避让与限流 |
| **X 光透视** | 选中部件以外全部半透明，直视内部结构（<kbd>X</kbd>） |
| **剖切视图** | 全局裁剪平面沿纵向剖切，可拖动滑块查看截面（<kbd>C</kbd>） |
| **四向视角** | 等轴 / 正视 / 侧视 / 俯视，带缓动相机动画（<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd>） |
| **部件隐藏** | 由外向内逐层剥离遮挡件，<kbd>Shift</kbd>+<kbd>H</kbd> 一键恢复 |
| **拆解轨迹** | 显示各部件从装配位到拆解位的运动轨迹（<kbd>G</kbd>） |
| **自动导览** | 按装配顺序依次聚焦并拆解 12 个关键部件（<kbd>T</kbd>） |
| **截图导出** | 导出当前视角为 PNG（<kbd>P</kbd>） |
| **URL 预置视图** | `#explode=0.6&select=turboL&run=1&rpm=900` 复现指定状态 |
| 自适应画质 | 帧率低于阈值自动降级，也可按 <kbd>Q</kbd> 手动切换 |

操作：左键拖拽旋转，滚轮缩放，右键平移。

## 应用车型

本机型（EA839 4.0 TFSI V8，页面标定为 550 PS / 770 N·m）主要装机车型：

| 车型 | 平台 | 功率 | 扭矩 | 0–100 |
| --- | --- | --- | --- | --- |
| Porsche Panamera Turbo | 971 | 550 PS | 770 N·m | 3.8 s |
| Porsche Panamera Turbo S | 971.2 | 630 PS | 820 N·m | 3.1 s |
| Porsche Panamera GTS | 971.2 | 460–480 PS | 620 N·m | 3.9 s |
| Porsche Cayenne Turbo / Coupé | 9Y0 | 550 PS | 770 N·m | 3.9 s |
| Porsche Cayenne GTS | 9Y0.2 | 460 PS | 620 N·m | 4.5 s |
| Porsche Cayenne Turbo GT | 9Y0.2 | 640 PS | 850 N·m | 3.3 s |

同族衍生（EA825 调校分支）：Audi RS 6 / RS 7 / RS Q8 / S8、Lamborghini Urus、Bentley Continental GT V8 / Flying Spur V8 / Bentayga V8。
完整车型卡片见应用内「应用车型」页。

## 本地运行

需要通过 HTTP 访问（ES Modules 不支持 `file://` 协议）：

```bash
python -m http.server 8080
# 打开 http://localhost:8080/
```

three.js r169 已内置在 `vendor/`，无需 `npm install`、无需联网。

## 技术栈

- [three.js](https://threejs.org/) r169（MIT）— 渲染、OrbitControls、EffectComposer + UnrealBloomPass、PMREM 环境贴图
- 原生 ES Modules + Import Map，零构建步骤
- 几何体全部由代码程序化生成，不加载外部模型文件
- 性能要点：同材质几何批量合并、辉光半分辨率、阴影按需更新、射线拾取节流、运动学仅运转时重算

## 目录

```
index.html          页面结构（模型舞台 / 侧栏 / 底部控制区 / 应用介绍浮层）
css/style.css       科技风 UI 样式
js/engine.js        整机程序化建模 + 运动学
js/parts.js         31 个部件的元数据（材料 / 工艺 / 参数）
js/data.js          功能介绍 / 应用车型 / 技术规格 / 快捷键内容
js/main.js          渲染循环、交互、标注、视图模式、介绍浮层
vendor/             three.js r169（含 OrbitControls 与后处理）
```

## 说明

- 几何为**程序化近似建模**，依据公开技术资料整理，非官方 CAD 数据，尺寸与结构经过简化，不可用于工程用途。
- 车型参数依据大众集团 / 保时捷公开资料整理，不同年款与市场存在差异，仅供演示与教学参考。
- 第三方授权：three.js（MIT），版权声明保留在 `vendor/` 各文件头部。
- 本仓库为在线演示站；完整开发源码与文档归档在 `3dcodinglabs` 仓库的 `projects/EA834-Workbuddy/`。
