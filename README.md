# 🎰 六合彩开奖数据 API

自动采集香港六合彩和澳门六合彩的开奖数据，通过 GitHub Actions 自动更新。

## 📡 API 地址

```
https://parker6263333-pixel.github.io/lottery-materials/data/lottery-data.json
```

## 🚀 特性

- ✅ **自动采集** - GitHub Actions 每小时自动运行
- ✅ **实时更新** - 开奖后自动同步最新数据
- ✅ **完全免费** - 无需注册，直接调用
- ✅ **CDN 加速** - GitHub Pages 全球加速

## 📊 数据格式

```json
{
  "version": "1.0.0",
  "lastUpdate": "2026-09-04T12:00:00Z",
  "description": "香港六合彩和澳门六合彩开奖数据",
  "source": "自动爬虫采集",
  "hongkong": [
    {
      "period": "234",
      "date": "2026-09-04",
      "numbers": [21, 46, 6, 42, 36, 44],
      "special": 15,
      "region": "hongkong"
    }
  ],
  "macao": [
    {
      "period": "245",
      "date": "2026-09-04",
      "numbers": [12, 23, 34, 45, 8, 19],
      "special": 27,
      "region": "macao"
    }
  ]
}
```

## 🔧 使用示例

### JavaScript

```javascript
fetch('https://parker6263333-pixel.github.io/lottery-materials/data/lottery-data.json')
  .then(response => response.json())
  .then(data => {
    console.log('香港最新开奖:', data.hongkong[0]);
    console.log('澳门最新开奖:', data.macao[0]);
  });
```

### Python

```python
import requests

url = 'https://parker6263333-pixel.github.io/lottery-materials/data/lottery-data.json'
response = requests.get(url)
data = response.json()

print('香港最新开奖:', data['hongkong'][0])
print('澳门最新开奖:', data['macao'][0])
```

## ⏰ 更新频率

- 每小时自动检查更新
- 开奖后立即更新（通过 webhook 触发）

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
