/**
 * 模型列表生成器(维护工具，仅手动运行，不进入运行期)
 *
 * 背景：内置模型目录 build/extraResources/ollama_model.json 长期停更。项目暂无可用的
 * 远程模型列表接口，因此改为用本脚本抓取 ollama.com 官方模型库，按既有 schema 重新生成
 * 该 JSON。今后刷新模型列表只需重跑本脚本，无运行期远程依赖。
 *
 * 用法：
 *   node cmd/gen_ollama_model.js
 *
 * 说明：
 * - 仅依赖 Node 内置模块(https/zlib/fs)，无需安装 npm 依赖。
 * - 会复用旧 JSON 中已有的中文描述(zh_cn_msg)，新增模型回退为英文描述。
 * - 输出条目按「模型 × 参数规格」展开，与历史数据结构保持一致。
 */

const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT_FILE = path.resolve(__dirname, '../build/extraResources/ollama_model.json');
const LIBRARY_URL = 'https://ollama.com/library';
const CONCURRENCY = 6;

/** 简单的 HTTP GET，跟随重定向 + 解压 gzip，带重试 */
function httpGet(url, retries = 3) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'AingDesk-model-generator',
                'Accept-Encoding': 'gzip, deflate',
            },
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                const next = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : new URL(res.headers.location, url).toString();
                return resolve(httpGet(next, retries));
            }
            if (res.statusCode !== 200) {
                res.resume();
                if (retries > 0) return resolve(delay(800).then(() => httpGet(url, retries - 1)));
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            const enc = res.headers['content-encoding'];
            let stream = res;
            if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
            else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
            const chunks = [];
            stream.on('data', (c) => chunks.push(c));
            stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            stream.on('error', reject);
        });
        req.setTimeout(20000, () => req.destroy(new Error('timeout')));
        req.on('error', (e) => {
            if (retries > 0) resolve(delay(800).then(() => httpGet(url, retries - 1)));
            else reject(e);
        });
    });
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function decode(s) {
    return (s || '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();
}

function matchAll(re, str) {
    const out = [];
    let m;
    while ((m = re.exec(str)) !== null) out.push(m[1]);
    return out;
}

/** 将 "8 days ago" / "1 year ago" 形式的相对时间转成近似 unix 时间戳(秒) */
function relativeToTimestamp(rel) {
    const now = Math.floor(Date.now() / 1000);
    if (!rel) return now;
    const m = rel.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);
    if (!m) return now;
    const n = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    const secs = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2592000, year: 31536000 }[unit];
    return now - n * secs;
}

/** 解析 /library 页面，返回模型基础信息列表 */
function parseLibrary(html) {
    const blocks = html.split('<li x-test-model').slice(1);
    const models = [];
    for (const block of blocks) {
        const name = (block.match(/x-test-model-title title="([^"]+)"/) || [])[1];
        if (!name) continue;
        const msg = decode((block.match(/text-md">([\s\S]*?)<\/p>/) || [])[1]);
        const capability = matchAll(/x-test-capability[^>]*>([^<]+)<\/span>/g, block).map(decode);
        const params = matchAll(/x-test-size[^>]*>([^<]+)<\/span>/g, block).map(decode);
        const pull_count = decode((block.match(/x-test-pull-count[^>]*>([^<]+)</) || [])[1]);
        const tag_count = decode((block.match(/x-test-tag-count[^>]*>([^<]+)</) || [])[1]);
        const updated = decode((block.match(/x-test-updated[^>]*>([^<]+)</) || [])[1]);
        models.push({ name, msg, capability, params, pull_count, tag_count, updated });
    }
    return models;
}

/** 解析 /library/<name>/tags 页面，返回 tag -> {size, updated} 映射 */
function parseTags(name, html) {
    const map = {};
    const re = new RegExp(`href="/library/${escapeReg(name)}:([^"]+)"`, 'g');
    let m;
    const seen = new Set();
    while ((m = re.exec(html)) !== null) {
        const tag = m[1];
        if (seen.has(tag)) continue;
        seen.add(tag);
        // 取该 tag 链接之后最近的 "• <size> •" 与相对时间
        const seg = html.slice(m.index, m.index + 1200);
        const sizeM = seg.match(/•\s*([\d.]+\s*[KMGT]B)\s*•/i);
        const updM = seg.match(/(\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago)/i);
        map[tag] = {
            size: sizeM ? sizeM[1].replace(/\s+/g, '') : '',
            updated: updM ? updM[1] : '',
        };
    }
    return map;
}

function escapeReg(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function runPool(items, worker, concurrency) {
    const results = [];
    let i = 0;
    const runners = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
        while (i < items.length) {
            const idx = i++;
            results[idx] = await worker(items[idx], idx);
        }
    });
    await Promise.all(runners);
    return results;
}

async function main() {
    // 读取旧数据用于复用中文描述
    let oldZh = {};
    try {
        const old = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
        for (const e of old) {
            if (e.name && e.zh_cn_msg && !oldZh[e.name]) oldZh[e.name] = e.zh_cn_msg;
        }
    } catch { /* 忽略 */ }

    console.log('抓取模型库列表:', LIBRARY_URL);
    const libHtml = await httpGet(LIBRARY_URL);
    const models = parseLibrary(libHtml);
    console.log(`解析到 ${models.length} 个模型，开始抓取各模型的 tags 页...`);

    let done = 0;
    await runPool(models, async (model) => {
        try {
            const tagsHtml = await httpGet(`${LIBRARY_URL}/${model.name}/tags`);
            model.tagMap = parseTags(model.name, tagsHtml);
        } catch (e) {
            model.tagMap = {};
            console.warn(`  [warn] ${model.name} tags 抓取失败: ${e.message}`);
        }
        done++;
        if (done % 20 === 0) console.log(`  进度 ${done}/${models.length}`);
    }, CONCURRENCY);

    const result = [];
    for (const model of models) {
        const zh = oldZh[model.name] || model.msg;
        // 以卡片上的参数规格为主，逐一展开为条目
        const params = model.params && model.params.length ? model.params : Object.keys(model.tagMap || {});
        for (const param of params) {
            // 跳过云端模型(无法本地 pull，无下载体积)
            if (param === 'cloud') continue;
            const tagInfo = (model.tagMap && model.tagMap[param]) || {};
            // 没有下载体积的条目(多为云端/预览模型)不纳入本地可下载目录
            if (!tagInfo.size) continue;
            const updated = tagInfo.updated || model.updated || '';
            result.push({
                full_name: `${model.name}:${param}`,
                name: model.name,
                msg: model.msg,
                size: tagInfo.size || '',
                zh_cn_msg: zh,
                link: `https://ollama.com/library/${model.name}:${param}`,
                parameters: param,
                pull_count: model.pull_count || '',
                tag_count: model.tag_count || '',
                updated,
                updated_time: relativeToTimestamp(updated),
                capability: model.capability && model.capability.length ? model.capability : ['llm'],
            });
        }
    }

    fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.log(`完成：写入 ${result.length} 条 -> ${OUT_FILE}`);
}

main().catch((e) => {
    console.error('生成失败:', e);
    process.exit(1);
});
