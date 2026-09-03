/**
 * 批量生成资料工具
 * 根据 material-types-config.json 批量生成资料JSON文件
 */

const fs = require('fs');
const path = require('path');

class MaterialsGenerator {
    constructor() {
        this.configPath = path.join(__dirname, '../data/material-types-config.json');
        this.indexPath = path.join(__dirname, '../data/materials-index.json');
        this.dataBasePath = path.join(__dirname, '../data');
    }

    // 读取资料类型配置
    loadConfig() {
        try {
            const content = fs.readFileSync(this.configPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.error('❌ 读取配置文件失败:', error.message);
            return null;
        }
    }

    // 读取现有索引
    loadIndex() {
        try {
            const content = fs.readFileSync(this.indexPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.error('❌ 读取索引文件失败:', error.message);
            return null;
        }
    }

    // 生成单个资料的JSON数据
    generateMaterialData(typeConfig, periodCount = 3) {
        const periods = [];
        const currentDate = new Date();
        
        // 生成最近3期的数据
        for (let i = 0; i < periodCount; i++) {
            const period = (246 - i).toString().padStart(3, '0');
            const date = new Date(currentDate);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const periodData = {
                period: period,
                date: dateStr,
                title: `${period}期◆${typeConfig.name}◆`,
                items: [],
                views: Math.floor(Math.random() * 3000) + 500,
                likes: Math.floor(Math.random() * 200) + 50,
                tags: i === 0 ? ['最新', '热门'] : ['历史']
            };

            // 根据资料类型生成内容
            if (typeConfig.dataType === 'image') {
                periodData.items.push({
                    type: 'image',
                    title: `${typeConfig.name}彩色图纸`,
                    imagePath: `assets/images/materials/${typeConfig.category}/${typeConfig.code}/${period}.jpg`,
                    thumbnail: `assets/images/materials/${typeConfig.category}/${typeConfig.code}/${period}_thumb.jpg`,
                    hasRealImage: false
                });
            } else if (typeConfig.dataType === 'numbers') {
                periodData.items.push({
                    type: 'numbers',
                    title: '推荐号码',
                    numbers: this.generateRandomNumbers(6),
                    description: '精准推荐号码'
                });
            } else if (typeConfig.dataType === 'mixed') {
                // 图文混合
                if (typeConfig.templates && typeConfig.templates.length > 0) {
                    typeConfig.templates.forEach(template => {
                        periodData.items.push({
                            type: Math.random() > 0.5 ? 'image' : 'text',
                            title: template,
                            content: template.includes('肖') ? `推荐生肖: 龙、虎` : `推荐号码: ${this.generateRandomNumbers(2).join(', ')}`,
                            imagePath: `assets/images/materials/${typeConfig.category}/${typeConfig.code}/${period}-${template}.jpg`,
                            hasRealImage: false
                        });
                    });
                }
            }

            periods.push(periodData);
        }

        return {
            materialCode: typeConfig.code,
            materialName: typeConfig.name,
            category: typeConfig.category,
            dataType: typeConfig.dataType,
            icon: typeConfig.icon,
            color: typeConfig.color,
            description: typeConfig.description,
            totalPeriods: periodCount,
            latestPeriod: '246',
            latestDate: currentDate.toISOString().split('T')[0],
            periods: periods
        };
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

    // 创建目录（如果不存在）
    ensureDir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`📁 创建目录: ${dirPath}`);
        }
    }

    // 生成所有资料
    generateAll(options = {}) {
        const config = this.loadConfig();
        if (!config) return;

        const index = this.loadIndex();
        if (!index) return;

        console.log('🚀 开始批量生成资料...\n');

        const types = Object.values(config.types);
        let successCount = 0;
        let skipCount = 0;

        types.forEach(typeConfig => {
            const category = typeConfig.category || 'macao';
            const outputDir = path.join(this.dataBasePath, category);
            const outputFile = path.join(outputDir, `${typeConfig.code}.json`);

            // 检查是否已存在
            if (fs.existsSync(outputFile) && !options.overwrite) {
                console.log(`⏭️  跳过 ${typeConfig.name} (已存在)`);
                skipCount++;
                return;
            }

            // 确保目录存在
            this.ensureDir(outputDir);

            // 生成数据
            const materialData = this.generateMaterialData(typeConfig, options.periodCount || 3);

            // 写入文件
            try {
                fs.writeFileSync(outputFile, JSON.stringify(materialData, null, 2), 'utf-8');
                console.log(`✅ 生成 ${typeConfig.name} -> ${outputFile}`);
                successCount++;

                // 创建图片目录
                if (typeConfig.dataType === 'image' || typeConfig.dataType === 'mixed') {
                    const imgDir = path.join(__dirname, `../assets/images/materials/${category}/${typeConfig.code}`);
                    this.ensureDir(imgDir);
                }

            } catch (error) {
                console.error(`❌ 生成失败 ${typeConfig.name}:`, error.message);
            }
        });

        console.log(`\n📊 生成完成:`);
        console.log(`   ✅ 成功: ${successCount}`);
        console.log(`   ⏭️  跳过: ${skipCount}`);
        console.log(`   📁 总计: ${types.length}`);

        // 更新索引
        this.updateIndex(config, index);
    }

    // 更新材料索引
    updateIndex(config, index) {
        console.log('\n🔄 更新资料索引...');

        const types = Object.values(config.types);
        const categoryMap = {};

        // 按分类分组
        types.forEach(typeConfig => {
            const category = typeConfig.category || 'macao';
            if (!categoryMap[category]) {
                categoryMap[category] = [];
            }

            // 检查JSON文件是否存在
            const jsonPath = path.join(this.dataBasePath, category, `${typeConfig.code}.json`);
            let totalPeriods = 0;
            let latestPeriod = '';
            let latestDate = '';

            if (fs.existsSync(jsonPath)) {
                try {
                    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
                    totalPeriods = data.totalPeriods || 0;
                    latestPeriod = data.latestPeriod || '';
                    latestDate = data.latestDate || '';
                } catch (e) {
                    console.warn(`⚠️  无法读取 ${jsonPath}`);
                }
            }

            categoryMap[category].push({
                code: typeConfig.code,
                name: typeConfig.name,
                icon: typeConfig.icon,
                color: typeConfig.color,
                description: typeConfig.description,
                dataType: typeConfig.dataType,
                totalPeriods: totalPeriods,
                latestPeriod: latestPeriod,
                latestDate: latestDate,
                dataFile: `data/${category}/${typeConfig.code}.json`,
                sortOrder: typeConfig.priority || 999,
                isHot: typeConfig.isHot || false,
                isNew: typeConfig.priority <= 5,
                tags: this.generateTags(typeConfig)
            });
        });

        // 更新索引中的分类
        Object.keys(categoryMap).forEach(category => {
            if (index.categories[category]) {
                // 合并新旧资料，避免覆盖已有的
                const existingCodes = index.categories[category].materials.map(m => m.code);
                const newMaterials = categoryMap[category].filter(m => !existingCodes.includes(m.code));
                
                index.categories[category].materials.push(...newMaterials);
                
                // 按sortOrder排序
                index.categories[category].materials.sort((a, b) => a.sortOrder - b.sortOrder);
            }
        });

        // 更新统计
        let totalMaterials = 0;
        let totalPeriods = 0;
        Object.values(index.categories).forEach(cat => {
            totalMaterials += cat.materials.length;
            cat.materials.forEach(m => {
                totalPeriods += m.totalPeriods || 0;
            });
        });

        index.stats.totalMaterials = totalMaterials;
        index.stats.totalPeriods = totalPeriods;
        index.lastUpdate = new Date().toISOString();

        // 保存索引
        try {
            fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
            console.log('✅ 索引文件已更新');
        } catch (error) {
            console.error('❌ 更新索引失败:', error.message);
        }
    }

    // 生成标签
    generateTags(typeConfig) {
        const tags = [];
        if (typeConfig.dataType === 'image') tags.push('图库');
        if (typeConfig.dataType === 'numbers') tags.push('号码');
        if (typeConfig.dataType === 'kill') tags.push('杀码');
        if (typeConfig.isHot) tags.push('热门');
        if (typeConfig.priority <= 5) tags.push('精准');
        return tags;
    }
}

// 命令行参数解析
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        overwrite: false,
        periodCount: 3
    };

    args.forEach(arg => {
        if (arg === '--overwrite' || arg === '-o') {
            options.overwrite = true;
        }
        if (arg.startsWith('--periods=')) {
            options.periodCount = parseInt(arg.split('=')[1]) || 3;
        }
    });

    return options;
}

// 主函数
function main() {
    console.log('═══════════════════════════════════════');
    console.log('📦 资料批量生成工具 v1.0.0');
    console.log('═══════════════════════════════════════\n');

    const options = parseArgs();
    const generator = new MaterialsGenerator();
    generator.generateAll(options);

    console.log('\n✨ 任务完成！\n');
    console.log('💡 使用提示:');
    console.log('   - 使用 --overwrite 覆盖已存在的文件');
    console.log('   - 使用 --periods=5 指定生成期数');
    console.log('\n');
}

// 执行
if (require.main === module) {
    main();
}

module.exports = MaterialsGenerator;
