/**
 * 自动更新资料到新期号
 * 每天自动运行，为所有资料添加新期号
 */

const fs = require('fs');
const path = require('path');

class AutoUpdater {
    constructor() {
        this.dataDir = path.join(__dirname, '../data/macao');
        this.indexFile = path.join(__dirname, '../data/materials-index.json');
    }

    // 获取下一期号
    getNextPeriod(currentPeriod) {
        const num = parseInt(currentPeriod);
        return (num + 1).toString().padStart(3, '0');
    }

    // 获取今天日期
    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }

    // 生成新期数据
    generateNewPeriod(material, period) {
        return {
            period: period,
            date: this.getTodayDate(),
            title: `${period}期◆${material.materialName}◆`,
            items: this.generateItemsForType(material, period),
            views: Math.floor(Math.random() * 500) + 100,
            likes: Math.floor(Math.random() * 50) + 10,
            tags: ['最新', '今日']
        };
    }

    // 根据资料类型生成内容
    generateItemsForType(material, period) {
        const items = [];

        if (material.dataType === 'image') {
            items.push({
                type: 'image',
                title: `${material.materialName}彩色图纸`,
                imagePath: `assets/images/materials/${material.category}/${material.materialCode}/${period}.jpg`,
                thumbnail: `assets/images/materials/${material.category}/${material.materialCode}/${period}_thumb.jpg`,
                hasRealImage: false
            });
        } else if (material.dataType === 'numbers') {
            items.push({
                type: 'numbers',
                title: '推荐号码',
                numbers: this.generateRandomNumbers(6),
                description: '精准推荐号码'
            });
        } else if (material.dataType === 'mixed') {
            // 从现有数据中复制模板
            if (material.periods && material.periods[0] && material.periods[0].items) {
                material.periods[0].items.forEach(item => {
                    items.push({
                        ...item,
                        imagePath: item.imagePath.replace(/\d{3}/, period)
                    });
                });
            }
        }

        return items;
    }

    // 生成随机号码
    generateRandomNumbers(count) {
        const numbers = [];
        while (numbers.length < count) {
            const num = Math.floor(Math.random() * 49) + 1;
            if (!numbers.includes(num)) {
                numbers.push(num);
            }
        }
        return numbers.sort((a, b) => a - b);
    }

    // 更新单个资料文件
    updateMaterialFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const material = JSON.parse(content);

            // 判断是旧格式（items）还是新格式（periods）
            const isOldFormat = material.items && !material.periods;
            const materialName = material.materialName || material.name;

            // 获取当前最新期号
            let currentPeriod;
            if (isOldFormat) {
                // 旧格式：从items数组获取
                currentPeriod = material.items[0].period;
            } else {
                // 新格式：从latestPeriod获取
                currentPeriod = material.latestPeriod;
            }

            const nextPeriod = this.getNextPeriod(currentPeriod);
            console.log(`📝 更新 ${materialName}: ${currentPeriod} → ${nextPeriod}`);

            if (isOldFormat) {
                // 更新旧格式
                const newItem = {
                    id: `macao-${material.code}-2026-${nextPeriod}`,
                    period: nextPeriod,
                    year: 2026,
                    date: this.getTodayDate(),
                    dayOfWeek: this.getDayOfWeek(),
                    title: `第${nextPeriod}期${materialName}`,
                    imageUrl: `https://cdn.example.com/materials/macao/${material.code}/2026/${nextPeriod}.jpg`,
                    imagePath: `assets/images/materials/macao/${material.code}/2026/${nextPeriod}.jpg`,
                    imageSize: "256KB",
                    imageWidth: 800,
                    imageHeight: 600,
                    uploadTime: `${this.getTodayDate()} 20:30:00`,
                    status: "published",
                    viewCount: 0,
                    tags: ["最新", "热门"]
                };

                // 添加到items数组前面
                material.items.unshift(newItem);

                // 只保留最近10期
                if (material.items.length > 10) {
                    material.items = material.items.slice(0, 10);
                }

                // 更新元数据
                material.totalCount = material.items.length;

            } else {
                // 更新新格式
                const newPeriodData = this.generateNewPeriod(material, nextPeriod);

                // 添加到periods数组前面
                material.periods.unshift(newPeriodData);

                // 只保留最近10期
                if (material.periods.length > 10) {
                    material.periods = material.periods.slice(0, 10);
                }

                // 更新元数据
                material.latestPeriod = nextPeriod;
                material.latestDate = this.getTodayDate();
                material.totalPeriods = material.periods.length;
            }

            // 保存文件
            fs.writeFileSync(filePath, JSON.stringify(material, null, 2), 'utf-8');
            
            return {
                name: materialName,
                period: nextPeriod,
                success: true
            };

        } catch (error) {
            console.error(`❌ 更新失败 ${filePath}:`, error.message);
            return {
                name: path.basename(filePath),
                success: false,
                error: error.message
            };
        }
    }

    // 获取星期几
    getDayOfWeek() {
        const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        return days[new Date().getDay()];
    }

    // 更新所有资料
    async updateAll() {
        console.log('🚀 开始自动更新资料...\n');
        console.log(`📅 日期: ${this.getTodayDate()}\n`);

        const files = fs.readdirSync(this.dataDir).filter(f => f.endsWith('.json'));
        const results = [];

        for (const file of files) {
            const filePath = path.join(this.dataDir, file);
            const result = this.updateMaterialFile(filePath);
            results.push(result);
        }

        // 更新索引
        this.updateIndex();

        // 统计结果
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        console.log('\n📊 更新完成:');
        console.log(`   ✅ 成功: ${successCount}`);
        console.log(`   ❌ 失败: ${failCount}`);
        console.log(`   📁 总计: ${files.length}`);

        if (successCount > 0) {
            console.log('\n✨ 所有资料已更新到最新期号！');
        }

        return results;
    }

    // 更新索引文件
    updateIndex() {
        try {
            const index = JSON.parse(fs.readFileSync(this.indexFile, 'utf-8'));
            
            // 更新lastUpdate
            index.lastUpdate = new Date().toISOString();

            // 重新统计
            let totalPeriods = 0;
            Object.values(index.categories).forEach(category => {
                category.materials.forEach(material => {
                    // 读取实际文件更新统计
                    const materialFile = material.dataFile;
                    if (fs.existsSync(materialFile)) {
                        const data = JSON.parse(fs.readFileSync(materialFile, 'utf-8'));
                        material.latestPeriod = data.latestPeriod;
                        material.latestDate = data.latestDate;
                        material.totalPeriods = data.totalPeriods;
                        totalPeriods += data.totalPeriods;
                    }
                });
            });

            index.stats.totalPeriods = totalPeriods;

            fs.writeFileSync(this.indexFile, JSON.stringify(index, null, 2), 'utf-8');
            console.log('✅ 索引文件已更新');

        } catch (error) {
            console.error('❌ 更新索引失败:', error.message);
        }
    }
}

// 命令行执行
if (require.main === module) {
    const updater = new AutoUpdater();
    updater.updateAll().then(() => {
        console.log('\n🎉 任务完成！');
        process.exit(0);
    }).catch(error => {
        console.error('\n❌ 发生错误:', error);
        process.exit(1);
    });
}

module.exports = AutoUpdater;
