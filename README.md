# 六合彩资料库 - 完整资料爬虫系统

> 自动爬取香港、澳门、台湾六合彩100+种资料，基于 Cloudflare R2 + D1 的云原生架构

## ✨ 功能特点

- 🚀 **100+种资料类型** - 涵盖云储挂牌、真版射牌图、精选数据等
- 🤖 **全自动爬取** - GitHub Actions 定时任务，每天3次自动更新
- ☁️ **无服务器架构** - 基于 Cloudflare R2（存储）+ D1（数据库）
- 💰 **低成本运营** - 10000人以内每月成本不到1元
- 📱 **移动优先设计** - 响应式界面，完美适配手机端
- ⚡ **全球加速** - Cloudflare CDN，访问速度快

## 🏗️ 技术架构

```
前端: Next.js 15 + React 19 + TailwindCSS
后端: Cloudflare Workers + Hono
存储: Cloudflare R2 (S3兼容)
数据库: Cloudflare D1 (SQLite)
爬虫: Node.js + Axios + Cheerio
自动化: GitHub Actions
部署: Vercel
```

## 📊 数据库结构

- `lottery_results` - 开奖结果表
- `materials` - 资料表（100+种资料）
- `material_types_config` - 资料类型配置
- `user_favorites` - 用户收藏
- `crawler_logs` - 爬虫日志

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-username/lottery-materials.git
cd lottery-materials
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env`，填入你的 Cloudflare 配置：

```env
CLOUDFLARE_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=lottery-materials
R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev
D1_DATABASE_ID=your-database-id
```

### 4. 初始化数据库

通过 Cloudflare Dashboard 执行 `database/schema-init.sql`

### 5. 测试爬虫

```bash
# 爬取香港资料
node crawlers/hongkong/main.js

# 爬取澳门资料
node crawlers/macao/main.js
```

## 🤖 GitHub Actions 自动化

### 配置 Secrets

在 GitHub 仓库设置中添加以下 Secrets：

```
CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
D1_DATABASE_ID
```

### 定时任务

- **香港资料**: 每周二、四、六 21:00, 00:00, 03:00 (UTC+8)
- **澳门资料**: 每周一、三、五 21:30, 00:30, 03:30 (UTC+8)

### 手动触发

在 GitHub Actions 页面点击 "Run workflow" 手动触发爬虫

## 📦 部署到 Vercel

1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量（同上）
3. 点击 Deploy 一键部署

## 💰 成本估算

### Cloudflare 免费额度

- **R2 存储**: 10GB/月 免费
- **R2 操作**: 100万次A类 + 1000万次B类/月 免费
- **D1 数据库**: 5GB存储 + 每天50万次读写 免费

### 实际成本（10000人）

- **存储**: ~5GB = $0.08/月
- **带宽**: 0 成本（无出站费用）
- **数据库**: 免费额度内
- **总成本**: 约 $0.1/月（不到1块钱）

## 📁 项目结构

```
lottery-materials/
├── crawlers/               # 爬虫脚本
│   ├── hongkong/          # 香港资料爬虫
│   ├── macao/             # 澳门资料爬虫
│   └── shared/            # 共享工具
├── database/              # 数据库脚本
│   ├── schema-init.sql   # 初始化脚本
│   └── migrations/       # 迁移脚本
├── scripts/               # 维护脚本
│   ├── test/             # 测试脚本
│   └── maintenance/      # 维护工具
├── config/                # 配置文件
│   ├── materials-100-full.json  # 资料类型配置
│   └── crawler-config.json      # 爬虫配置
├── .github/workflows/     # GitHub Actions
│   ├── crawler-hongkong.yml
│   └── crawler-macao.yml
├── .env.example          # 环境变量示例
└── README.md            # 本文件
```

## 🔧 开发指南

### 添加新的资料类型

1. 在 `config/materials-100-full.json` 添加配置
2. 在爬虫脚本中添加爬取逻辑
3. 更新数据库配置

### 本地测试

```bash
# 测试 R2 上传
node scripts/test/test-r2-upload.js

# 测试数据库连接（需要 Node.js 22+）
node scripts/test/test-d1-connection.js
```

## 📝 API 文档

### 获取最新资料

```
GET /api/materials/:lotteryType/latest?period=001&year=2026
```

### 获取资料详情

```
GET /api/materials/:lotteryType/:materialType?period=001&year=2026
```

### 获取开奖结果

```
GET /api/results/:lotteryType/latest
```

## 🛠️ 故障排除

### 爬虫失败

- 检查网络连接
- 检查目标网站是否更新了结构
- 查看 GitHub Actions 日志

### R2 上传失败

- 检查 API 密钥是否正确
- 检查存储桶权限
- 检查文件大小限制

### 数据库错误

- 检查表结构是否正确初始化
- 检查 SQL 语句是否正确
- 查看 Cloudflare D1 日志

## 📄 许可证

MIT License

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

## 🙏 鸣谢

- Cloudflare 提供的免费服务
- 所有开源依赖的维护者

---

**⚠️ 免责声明**: 本项目仅供学习交流使用，请遵守相关法律法规。
