# 🎰 Lottery Materials Crawler

香港六合彩和澳门六合彩素材自动爬取系统

## 📋 功能

- 🇭🇰 香港六合彩历史数据爬取
- 🇲🇴 澳门六合彩历史数据爬取
- ⏰ 自动定时爬取（每天UTC 15:00）
- 📊 数据自动提交到仓库
- 🔔 失败通知

## 🚀 使用方法

### 手动触发

在 GitHub Actions 页面，选择对应的 workflow，点击 "Run workflow"

### 自动运行

系统每天会自动运行：
- 香港六合彩：UTC 15:00（北京时间 23:00）
- 澳门六合彩：UTC 15:00（北京时间 23:00）

## 📁 数据存储

数据存储在 `data/` 目录：
- `data/hongkong/` - 香港六合彩数据
- `data/macao/` - 澳门六合彩数据

## ⚙️ 配置

在仓库的 Settings → Secrets 中配置：
- `GITHUB_TOKEN` - 自动提供，无需配置

## 📝 日志

所有运行日志保存在 GitHub Actions 的运行记录中
