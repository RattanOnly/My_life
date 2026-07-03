# 我的灿烂人生 / My Life

这是一个基于 [Hexo](https://hexo.io/) 的个人博客项目，用来记录生活、写作和一些个人化的前端/发布流程实验。

This is a personal blog built with Hexo. It keeps my writing, life notes, theme customizations, and publishing workflow in an open repository.

## 项目内容

- `source/_posts/`：博客文章内容
- `source/images/`：主题图标、头像等仍随站点构建的轻量本地媒体资源
- `https://assets.lovezvv.com/blog/`：文章图片和博客音乐使用的 Cloudflare R2 公共资源域
- `source/_data/`：主题覆盖与自定义片段
- `scripts/`、`tools/`：本地开发、构建和环境辅助脚本
- `themes/next/`：基于 NexT 主题的站点外观

## 本地运行

环境要求：

- Node.js 18+
- npm

安装依赖：

```bash
npm install
```

启动本地预览：

```bash
npm run server
```

生成静态文件：

```bash
npm run build
```

清理生成结果：

```bash
npm run clean
```

如果需要 Algolia 搜索配置，可以参考 `.env.example` 设置本地环境变量。

## 部署

项目使用 Cloudflare Pages 托管静态站点。正式发布建议在 Cloudflare Pages 里连接 GitHub 仓库，并设置：

- 构建命令：`npm run build`
- 输出目录：`public`
- 生产分支：`main`

本地发布前建议先执行：

```bash
npm run clean
npm run build
```

生产站点由 Cloudflare Pages 连接 GitHub 自动构建；除非排查发布问题，不建议手动上传生产版本。

## 维护说明

这是一个个人博客项目，但仓库保持公开，主要价值在于：

- 以开放形式记录一个真实的个人博客从内容、主题到部署的完整结构；
- 保留 Hexo + NexT 的个性化配置、样式覆盖和发布脚本；
- 为其他想搭建个人静态博客的人提供可参考的项目结构和维护方式。

## 许可协议

仓库中的代码、配置和脚本采用 MIT License，详见 [LICENSE](./LICENSE)。

博客文章、图片、音频、视频等个人内容和媒体资源除非另有说明，版权归作者所有，不授权直接转载或商用。
