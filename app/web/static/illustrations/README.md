# 页面插画素材

三张插画使用内置 imagegen 工具生成，保存在本目录，均为本地 WebP 素材（1200×800，每张约 100 KB），运行时无需联网。图片通过 illustrations.js 按页面语境插入；学生概览页头的插画由 student.js 直接写入。作为装饰设置空 alt 和 aria-hidden，不参与题目、评分和导出；统一 lazy 加载，移动端缩小，打印时隐藏。

- teaching.webp：登录、教师工作台、备课、资源与指南。
- animals.webp：课堂活动、拓展工具、动物课堂与答辩封面。
- learning.webp：练习、发布、反馈、学生概览与家长页面。

> 单词与词卡的小图（`/static/words/*.webp`）是另一套素材，来源与许可见 `static/words/CREDITS.md`。

## 原始生成提示词

2026-11-09 验证：46/46 功能回归通过。浏览器检查了登录、教师工作台、备课、活动、指南、课堂、答辩、工作坊及子页、完整版、学生与家长页面，以及 390px 窄屏的四个页面，共 16 组页面/视口；图片均成功加载，最终检查未发现页面横向溢出或 JavaScript 页面异常。窄屏下备课表格在自身容器内横向滚动。

### teaching

Use case: illustration-story. Asset type: polished editorial illustration for AI4En, an elementary English teaching web app. Style: warm hand-painted gouache, subtle paper grain, clean silhouettes, sophisticated playful picture book, refined rounded shapes. Palette: misty pine green #4f8777, deep green #2f5c51, sage, warm sand #f0e5d4, ivory, small muted terracotta accents. Transparent background, isolated scene with generous clear edges; no frame, no text, no letters, no watermark. Landscape 3:2 composition, friendly expressive characters, high quality. An East Asian woman teacher in a sage cardigan at a desk with an open lesson book and laptop, a tiny friendly cream robot learning companion beside her, floating picture cards of a cat and panda and a small leafy plant. Calm, welcoming, optimistic educational atmosphere. Clear balanced compact composition.

### animals

Use case: illustration-story. Asset type: polished editorial illustration for AI4En, an elementary English teaching web app. Style: warm hand-painted gouache, subtle paper grain, clean silhouettes, sophisticated playful picture book, refined rounded shapes. Palette: misty pine green #4f8777, deep green #2f5c51, sage, warm sand #f0e5d4, ivory, small muted terracotta accents. Transparent background, isolated scene with generous clear edges; no frame, no text, no letters, no watermark. Landscape 3:2 composition, friendly expressive characters, high quality. Four charming animals, an orange cat, a warm brown puppy, a black and white panda and a sage green frog, gathered around an open ivory book on a tiny grassy island, leaves and small golden stars. Each animal clearly recognizable and anatomically simple. Joyful English vocabulary discovery. No humans.

### learning

Use case: illustration-story. Asset type: polished editorial illustration for AI4En, an elementary English teaching web app. Style: warm hand-painted gouache, subtle paper grain, clean silhouettes, sophisticated playful picture book, refined rounded shapes. Palette: misty pine green #4f8777, deep green #2f5c51, sage, warm sand #f0e5d4, ivory, small muted terracotta accents. Transparent background, isolated scene with generous clear edges; no frame, no text, no letters, no watermark. Landscape 3:2 composition, friendly expressive characters, high quality. An East Asian schoolchild and a caring adult sitting together with an open exercise book, a little cream robot offering a sage pencil, a small growing plant in a sand-colored pot and three floating stepping leaves suggesting progress. Gentle cheerful collaborative learning, no text or graphs.


