/**
 * 图片管理器 - 方案A实现
 * 功能：下载、优化、管理本地图片
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class ImageManager {
    constructor() {
        this.baseDir = path.join(__dirname, '..');
        this.imageDir = path.join(this.baseDir, 'assets', 'images');
        this.materialsDir = path.join(this.imageDir, 'materials');
    }

    /**
     * 初始化目录结构
     */
    initDirectories() {
        const dirs = [
            'assets/images/materials/macao/paogoutu/2026',
            'assets/images/materials/macao/accurate-24num',
            'assets/images/materials/macao/kill-2zodiac-3num',
            'assets/images/materials/hongkong',
            'assets/images/materials/kuaile8',
            'assets/images/placeholders'
        ];

        dirs.forEach(dir => {
            const fullPath = path.join(this.baseDir, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                console.log(`✅ 创建目录: ${dir}`);
            }
        });

        console.log('📁 目录结构初始化完成');
    }

    /**
     * 下载单张图片
     */
    async downloadImage(url, savePath) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            
            // 确保目标目录存在
            const dir = path.dirname(savePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const file = fs.createWriteStream(savePath);
            
            protocol.get(url, response => {
                if (response.statusCode === 200) {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log(`✅ 下载成功: ${path.basename(savePath)}`);
                        resolve(savePath);
                    });
                } else {
                    fs.unlink(savePath, () => {});
                    reject(new Error(`下载失败: HTTP ${response.statusCode}`));
                }
            }).on('error', err => {
                fs.unlink(savePath, () => {});
                reject(err);
            });
        });
    }

    /**
     * 批量下载跑狗图
     */
    async downloadPaoGouTu() {
        console.log('🐕 开始下载跑狗图...');
        
        try {
            const dataPath = path.join(this.baseDir, 'data', 'macao', 'paogoutu.json');
            const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            
            let successCount = 0;
            let failCount = 0;

            for (const item of data.items || []) {
                if (item.imageUrl && item.imagePath) {
                    const savePath = path.join(this.baseDir, item.imagePath);
                    
                    try {
                        await this.downloadImage(item.imageUrl, savePath);
                        successCount++;
                        
                        // 避免请求过快
                        await this.sleep(1000);
                    } catch (error) {
                        console.log(`❌ 下载失败: ${item.period} - ${error.message}`);
                        failCount++;
                    }
                }
            }

            console.log(`\n📊 跑狗图下载统计:`);
            console.log(`   成功: ${successCount} 张`);
            console.log(`   失败: ${failCount} 张`);
            
        } catch (error) {
            console.error('❌ 下载过程出错:', error.message);
        }
    }

    /**
     * 生成占位图（当真实图片不存在时）
     */
    generatePlaceholder(materialName, period, savePath) {
        // 这里可以调用之前的占位图生成器
        // 或者使用 Canvas/Sharp 库生成
        console.log(`🎨 生成占位图: ${materialName} ${period}`);
        
        // 简单实现：创建一个标记文件
        const dir = path.dirname(savePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // TODO: 集成 Canvas 生成逻辑
        fs.writeFileSync(
            savePath.replace(/\.(jpg|png)$/, '.txt'),
            `占位图: ${materialName} ${period}\n生成时间: ${new Date().toISOString()}`
        );
    }

    /**
     * 检查图片文件是否存在
     */
    checkImage(imagePath) {
        const fullPath = path.join(this.baseDir, imagePath);
        return fs.existsSync(fullPath);
    }

    /**
     * 扫描并报告图片状态
     */
    scanImages() {
        console.log('🔍 扫描图片文件...\n');
        
        const configs = [
            { file: 'data/macao/paogoutu.json', name: '跑狗图' },
            { file: 'data/materials/macao/accurate-24num.json', name: '精准24码' },
            { file: 'data/materials/macao/kill-2zodiac-3num.json', name: '杀二肖三码' }
        ];

        configs.forEach(config => {
            const configPath = path.join(this.baseDir, config.file);
            
            if (!fs.existsSync(configPath)) {
                console.log(`⚠️  ${config.name}: 配置文件不存在`);
                return;
            }

            try {
                const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                const items = data.items || data.periods || [];
                
                let existCount = 0;
                let missingCount = 0;
                const missing = [];

                items.forEach(item => {
                    const imagePath = item.imagePath || item.image;
                    if (imagePath) {
                        if (this.checkImage(imagePath)) {
                            existCount++;
                        } else {
                            missingCount++;
                            if (missing.length < 3) {
                                missing.push(item.period || item.id);
                            }
                        }
                    }
                });

                console.log(`📊 ${config.name}:`);
                console.log(`   总数: ${items.length}`);
                console.log(`   存在: ${existCount} 张 ✅`);
                console.log(`   缺失: ${missingCount} 张 ❌`);
                if (missing.length > 0) {
                    console.log(`   示例: ${missing.join(', ')}...`);
                }
                console.log('');
                
            } catch (error) {
                console.log(`❌ ${config.name}: 读取失败 - ${error.message}\n`);
            }
        });
    }

    /**
     * 生成图片清单
     */
    generateManifest() {
        console.log('📝 生成图片清单...');
        
        const manifest = {
            generatedAt: new Date().toISOString(),
            baseUrl: 'https://your-github-username.github.io/your-repo-name',
            categories: {}
        };

        // 扫描所有图片目录
        const scanDir = (dir, category) => {
            const fullPath = path.join(this.materialsDir, dir);
            if (!fs.existsSync(fullPath)) return [];

            const files = fs.readdirSync(fullPath, { recursive: true });
            return files
                .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
                .map(f => ({
                    path: path.join('assets/images/materials', dir, f).replace(/\\/g, '/'),
                    size: fs.statSync(path.join(fullPath, f)).size,
                    url: `${manifest.baseUrl}/assets/images/materials/${dir}/${f}`.replace(/\\/g, '/')
                }));
        };

        manifest.categories.macao = scanDir('macao', '澳门彩');
        manifest.categories.hongkong = scanDir('hongkong', '香港彩');
        manifest.categories.kuaile8 = scanDir('kuaile8', '快乐8');

        const manifestPath = path.join(this.imageDir, 'manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        
        console.log(`✅ 清单已保存: ${manifestPath}`);
        return manifest;
    }

    /**
     * 工具：延时函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 获取图片统计信息
     */
    getStats() {
        if (!fs.existsSync(this.materialsDir)) {
            return { total: 0, size: 0 };
        }

        let total = 0;
        let size = 0;

        const scan = (dir) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            items.forEach(item => {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    scan(fullPath);
                } else if (/\.(jpg|jpeg|png|webp)$/i.test(item.name)) {
                    total++;
                    size += fs.statSync(fullPath).size;
                }
            });
        };

        scan(this.materialsDir);

        return {
            total,
            size,
            sizeFormatted: this.formatSize(size)
        };
    }

    /**
     * 格式化文件大小
     */
    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
        return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    }
}

// CLI 命令
if (require.main === module) {
    const manager = new ImageManager();
    const command = process.argv[2];

    switch (command) {
        case 'init':
            manager.initDirectories();
            break;
            
        case 'scan':
            manager.scanImages();
            break;
            
        case 'download-paogoutu':
            manager.downloadPaoGouTu();
            break;
            
        case 'manifest':
            manager.generateManifest();
            break;
            
        case 'stats':
            const stats = manager.getStats();
            console.log('📊 图片统计:');
            console.log(`   总数: ${stats.total} 张`);
            console.log(`   大小: ${stats.sizeFormatted}`);
            break;
            
        default:
            console.log(`
🎨 图片管理器 - 使用说明

命令列表:
  init                初始化目录结构
  scan                扫描并报告图片状态
  download-paogoutu   下载跑狗图
  manifest            生成图片清单
  stats               显示图片统计

用法示例:
  node scripts/image-manager.js init
  node scripts/image-manager.js scan
  node scripts/image-manager.js download-paogoutu
            `);
    }
}

module.exports = ImageManager;
