# DMA 练习实验室

NM6004 Design Methodology & Automation 的中文复习工具。根据提供的 Exercise Notes 1–7 与正式 Tutorial 整理，包含 19 组原题、80 个小问。

- 每题有完整条件、必要图示、交互实验、答案和掌握重点。
- 138 页 PDF：第 2–81 页为独立作答页，答案从第 82 页开始。
- 收藏、笔记和掌握状态仅保存在浏览器；没有账户或后台数据库。
- 原笔记中可辨认的划去小问作为选做保留，重复题合并，不补造未出现的小问。

## 本地运行

```sh
npm install
npm run dev
```

## 检查与构建

```sh
npm test
npm run build
```

构建会检查题库数量、数学渲染和图示资源。核心实验使用独立的穷举与不变量测试。

`src/data/questions.json` 是整理后的完整题库。`src/labs` 保存各题的计算引擎和交互界面。`public/dma-workbook.pdf` 是可直接打印的练习册。发布目录为 `docs/`，使用相对资源路径和 hash 路由兼容 GitHub Pages。

## 模型与核对说明

布尔仿真使用题目指定的变量顺序；stuck-at 故障为单故障模型。时序实验明确区分正常电路、持续故障电路与未知初态。延迟仿真用于理解题目给定的理想离散模型，并非器件模拟。

T4-P4 中固定自由变量 `{x1,x3}` 的课堂切分使用三个 4-LUT；允许重新划分时可用两个。答案区说明两种问题约束的区别。其他已识别的原笔记笔误在对应题目答案中注明。

题目与原始图示来自用户提供的课程材料。中文解析、整理和交互实现用于学习复习。

公开网站：https://andyzr-coder.github.io/dma-exercise-lab/

Lecture 实验室：https://andyzr-coder.github.io/dma-test-lab/
