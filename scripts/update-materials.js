const fs = require('fs');
const path = require('path');

/**
 * 资料管理工具 - Node.js脚本
 * 用于批量添加、更新资料数据
 */

class MaterialsManager {
    constructor() {
        this.baseDir = path.join(__dirname, '..');
        this.dataDir = path.join(this.baseDir, 'data');
        this.indexFile = path.join(this.dataDir, 'materials-index.json');
    }

    /**
     * 读取JSON文件
     */
    readJSON(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error(`读取文件失败: ${filePath}`, error.message);
            return null;
        }
    }

    /**
     * 写入JSON文件
     */
    writeJSON(filePath, data) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error(`写入文件失败: ${filePath}`, error.message);
            return false;
        }
    }

    /**
     * 添加新期数资料
     * @param {string} category - 彩种 'macao' | 'hongkong'
     * @param {string} code - 资料代码
     * @param {string} period - 期号 '001'
     * @param {string} date - 日期 '2026-09-03'
     * @param {Object} options - 可选参数
     */
    addNewPeriod(category, code, period, date, options = {}) {
        const jsonPath = path.join(this.dataDir, category, `${code}.json`);
        const data = this.readJSON(jsonPath);
        
        if (!data) {
            console.error(`❌ 资料文件不存在: ${category}/${code}.json`);
            return false;
        }

        // 检查期号是否已存在
        const exists = data.items.some(item => item.period === period);
        if (exists) {
            console.warn(`⚠️  期号 ${period} 已存在，跳过添加`);
            return false;
        }

        // 计算星期几
        const dateObj = new Date(date);
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const dayOfWeek = weekdays[dateObj.getDay()];

        // 获取当前年份
        const year = dateObj.getFullYear();

        // 构建新记录
        const newItem = {
            id: `${category}-${code}-${year}-${period}`,
            period: period,
            year: year,
            date: date,
            dayOfWeek: dayOfWeek,
            title: `第${period}期${data.name}`,
            imageUrl: options.imageUrl || `https://cdn.example.com/materials/${category}/${code}/${year}/${period}.jpg`,
            imagePath: options.imagePath || `assets/images/materials/${category}/${code}/${year}/${period}.jpg`,
            uploadTime: options.uploadTime || new Date().toISOString().replace('T', ' ').substring(0, 19),
            status: options.status || 'published',
            viewCount: options.viewCount || 0,
            tags: options.tags || []
        };

        // 添加到数组开头（最新的在前）
        data.items.unshift(newItem);
        
        // 更新总数
        data.totalCount = data.items.length;

        // 更新年份列表
        if (!data.years.includes(year)) {
            data.years.unshift(year);
            data.years.sort((a, b) => b - a); // 降序排列
        }

        // 保存文件
        if (this.writeJSON(jsonPath, data)) {
            console.log(`✅ 成功添加 ${data.name} 第${period}期 (${date})`);
            
            // 更新索引文件
            this.updateIndex(category, code, period, date);
            return true;
        }

        return false;
    }

    /**
     * 更新索引文件
     */
    updateIndex(category, code, latestPeriod, latestDate) {
        const index = this.readJSON(this.indexFile);
        if (!index) {
            console.error('❌ 索引文件不存在');
            return false;
        }

        const material = index.categories[category]?.materials?.find(m => m.code === code);
        if (!material) {
            console.error(`❌ 索引中找不到资料: ${category}/${code}`);
            return false;
        }

        // 更新资料信息
        material.totalPeriods = (material.totalPeriods || 0) + 1;
        material.latestPeriod = latestPeriod;
        material.latestDate = latestDate;

        // 更新索引时间
        index.lastUpdate = new Date().toISOString();

        // 更新统计
        if (index.stats) {
            index.stats.totalPeriods = (index.stats.totalPeriods || 0) + 1;
        }

        if (this.writeJSON(this.indexFile, index)) {
            console.log(`✅ 已更新索引文件`);
            return true;
        }

        return false;
    }

    /**
     * 批量添加多期资料
     */
    batchAddPeriods(category, code, periods) {
        console.log(`\n📦 开始批量添加 ${category}/${code} 资料...`);
        
        let successCount = 0;
        let failCount = 0;

        periods.forEach(periodData => {
            const { period, date, ...options } = periodData;
            if (this.addNewPeriod(category, code, period, date, options)) {
                successCount++;
            } else {
                failCount++;
            }
        });

        console.log(`\n📊 批量添加完成: 成功 ${successCount} 期, 失败 ${failCount} 期\n`);
    }

    /**
     * 创建新资料类型
     */
    createNewMaterial(category, materialData) {
        const { code, name, icon, color, description, ...otherData } = materialData;

        // 创建资料JSON文件
        const newMaterialData = {
            code: code,
            name: name,
            category: category,
            categoryName: category === 'macao' ? '澳门彩' : '香港彩',
            icon: icon || '📋',
            color: color || '#4A9EFF',
            description: description || '',
            totalCount: 0,
            years: [],
            items: []
        };

        const filePath = path.join(this.dataDir, category, `${code}.json`);
        
        if (fs.existsSync(filePath)) {
            console.error(`❌ 资料文件已存在: ${category}/${code}.json`);
            return false;
        }

        if (this.writeJSON(filePath, newMaterialData)) {
            console.log(`✅ 创建资料文件: ${category}/${code}.json`);

            // 添加到索引
            const index = this.readJSON(this.indexFile);
            if (index && index.categories[category]) {
                index.categories[category].materials.push({
                    code: code,
                    name: name,
                    icon: icon || '📋',
                    color: color || '#4A9EFF',
                    description: description || '',
                    totalPeriods: 0,
                    latestPeriod: '',
                    latestDate: '',
                    dataFile: `data/${category}/${code}.json`,
                    sortOrder: index.categories[category].materials.length + 1,
                    isHot: false,
                    tags: []
                });

                index.lastUpdate = new Date().toISOString();
                index.stats.totalMaterials++;

                if (this.writeJSON(this.indexFile, index)) {
                    console.log(`✅ 已添加到索引`);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 删除某期资料
     */
    deletePeriod(category, code, period) {
        const jsonPath = path.join(this.dataDir, category, `${code}.json`);
        const data = this.readJSON(jsonPath);
        
        if (!data) {
            return false;
        }

        const index = data.items.findIndex(item => item.period === period);
        if (index === -1) {
            console.warn(`⚠️  期号 ${period} 不存在`);
            return false;
        }

        data.items.splice(index, 1);
        data.totalCount = data.items.length;

        if (this.writeJSON(jsonPath, data)) {
            console.log(`✅ 已删除 ${data.name} 第${period}期`);
            return true;
        }

        return false;
    }

    /**
     * 显示资料统计
     */
    showStats() {
        const index = this.readJSON(this.indexFile);
        if (!index) {
            return;
        }

        console.log('\n📊 资料库统计信息\n');
        console.log(`更新时间: ${index.lastUpdate}`);
        console.log(`总分类数: ${index.stats.totalCategories}`);
        console.log(`总资料数: ${index.stats.totalMaterials}`);
        console.log(`总期数: ${index.stats.totalPeriods}\n`);

        for (const [key, cat] of Object.entries(index.categories)) {
            console.log(`${cat.icon} ${cat.name}: ${cat.materials.length} 种资料`);
            cat.materials.forEach(m => {
                console.log(`  ${m.icon} ${m.name}: ${m.totalPeriods} 期`);
            });
            console.log('');
        }
    }
}

// CLI使用示例
if (require.main === module) {
    const manager = new MaterialsManager();
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case 'add':
            // node update-materials.js add macao paogoutu 006 2026-09-04
            if (args.length >= 5) {
                manager.addNewPeriod(args[1], args[2], args[3], args[4]);
            } else {
                console.log('用法: node update-materials.js add <category> <code> <period> <date>');
            }
            break;

        case 'batch':
            // 批量添加示例
            manager.batchAddPeriods('macao', 'paogoutu', [
                { period: '006', date: '2026-09-04', tags: ['最新'] },
                { period: '007', date: '2026-09-05', tags: ['最新'] }
            ]);
            break;

        case 'create':
            // node update-materials.js create macao xinshui "新水" "🌊"
            if (args.length >= 5) {
                manager.createNewMaterial(args[1], {
                    code: args[2],
                    name: args[3],
                    icon: args[4],
                    description: args[5] || ''
                });
            } else {
                console.log('用法: node update-materials.js create <category> <code> <name> <icon> [description]');
            }
            break;

        case 'delete':
            // node update-materials.js delete macao paogoutu 001
            if (args.length >= 4) {
                manager.deletePeriod(args[1], args[2], args[3]);
            } else {
                console.log('用法: node update-materials.js delete <category> <code> <period>');
            }
            break;

        case 'stats':
            manager.showStats();
            break;

        default:
            console.log(`
资料管理工具 v1.0.0

用法:
  node update-materials.js <command> [options]

命令:
  add <category> <code> <period> <date>     添加新期数
  batch                                      批量添加（需编辑脚本）
  create <category> <code> <name> <icon>    创建新资料类型
  delete <category> <code> <period>         删除某期资料
  stats                                      显示统计信息

示例:
  node update-materials.js add macao paogoutu 006 2026-09-04
  node update-materials.js stats
  node update-materials.js create macao xinshui "新水" "🌊"
            `);
    }
}

module.exports = MaterialsManager;
