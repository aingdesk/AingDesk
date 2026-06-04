import path from 'path';
import fs from 'fs';
import { pub } from './public';
import { logger } from 'ee-core/log';

/**
 * 运行期二进制依赖的下载地址解析与解压工具
 *
 * 历史上这些二进制（uv/bun/ollama/poppler）托管在宝塔官网 CDN(aingdesk.bt.cn)，
 * 现已 404 下架。此模块统一改为从各项目的官方上游(GitHub Releases 等)直连下载，
 * 并处理上游压缩包格式(zip/tar.gz)与内层目录结构和本地期望布局的差异。
 *
 * process.arch 取值为 'x64' | 'arm64'，需映射成各上游的命名。
 */

const GH = 'https://github.com';

export type ArchiveFormat = 'zip' | 'tgz';

/**
 * uv (astral-sh/uv) 下载信息
 * - Windows: zip，根目录含 uv.exe / uvx.exe
 * - macOS/Linux: tar.gz，内层 uv-<target>/uv、uvx
 */
export function getUvDownloadInfo(): { url: string; format: ArchiveFormat } {
    const a = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
    const base = `${GH}/astral-sh/uv/releases/latest/download`;
    if (pub.is_windows()) {
        return { url: `${base}/uv-${a}-pc-windows-msvc.zip`, format: 'zip' };
    }
    if (pub.is_mac()) {
        return { url: `${base}/uv-${a}-apple-darwin.tar.gz`, format: 'tgz' };
    }
    return { url: `${base}/uv-${a}-unknown-linux-gnu.tar.gz`, format: 'tgz' };
}

/**
 * bun (oven-sh/bun) 下载信息
 * - 全部为 zip，内层 bun-<platform>/bun(.exe)
 * - Windows 上游仅提供 x64 构建
 */
export function getBunDownloadInfo(): { url: string; format: ArchiveFormat } {
    const base = `${GH}/oven-sh/bun/releases/latest/download`;
    if (pub.is_windows()) {
        return { url: `${base}/bun-windows-x64.zip`, format: 'zip' };
    }
    const a = process.arch === 'arm64' ? 'aarch64' : 'x64';
    const platform = pub.is_mac() ? 'darwin' : 'linux';
    return { url: `${base}/bun-${platform}-${a}.zip`, format: 'zip' };
}

/**
 * Ollama 安装包下载信息
 * - Windows: OllamaSetup.exe(安装器，直接运行)
 * - macOS: Ollama-darwin.zip
 * - Linux: ollama-linux-<amd64|arm64>.tgz
 */
export function getOllamaDownloadInfo(): { url: string; filename: string } | null {
    const base = `${GH}/ollama/ollama/releases/latest/download`;
    if (pub.is_windows()) {
        return { url: `${base}/OllamaSetup.exe`, filename: 'OllamaSetup.exe' };
    }
    if (pub.is_mac()) {
        return { url: `${base}/Ollama-darwin.zip`, filename: 'ollama-darwin.zip' };
    }
    if (pub.is_linux()) {
        const a = process.arch === 'arm64' ? 'arm64' : 'amd64';
        return { url: `${base}/ollama-linux-${a}.tgz`, filename: `ollama-linux-${a}.tgz` };
    }
    return null;
}

const POPPLER_WINDOWS_FALLBACK =
    `${GH}/oschwartz10612/poppler-windows/releases/download/v26.02.0-0/Release-26.02.0-0.zip`;

/**
 * 解析 poppler-windows 最新 release 的 zip 资产地址(资产名带版本号)。
 * 失败时回退到已知版本。仅 Windows 使用；mac/linux 走系统 poppler-utils。
 */
export async function getPopplerWindowsDownloadUrl(): Promise<string> {
    try {
        const res = await pub.httpRequest(
            'https://api.github.com/repos/oschwartz10612/poppler-windows/releases/latest',
            { timeout: 10000, headers: { 'User-Agent': 'AingDesk/' + pub.version() }, json: true }
        );
        let body = res.body;
        if (typeof body === 'string') body = JSON.parse(body);
        const asset = (body.assets || []).find((x: any) => /^Release-.*\.zip$/.test(x.name));
        if (asset && asset.browser_download_url) {
            return asset.browser_download_url;
        }
    } catch (e) {
        logger.error('获取 poppler-windows 最新版本失败，使用回退版本:', e);
    }
    return POPPLER_WINDOWS_FALLBACK;
}

/**
 * 解压压缩包到目标目录
 * - zip: 使用 unzipper
 * - tgz: 使用系统 tar(仅 mac/linux 会用到 tgz)
 */
export async function extractArchive(archiveFile: string, destDir: string, format: ArchiveFormat): Promise<void> {
    if (!pub.file_exists(destDir)) {
        pub.mkdir(destDir);
    }
    if (format === 'tgz') {
        pub.exec_shell(`tar -xzf "${archiveFile}" -C "${destDir}"`);
        return;
    }
    const unzip = require('unzipper');
    await new Promise<void>((resolve, reject) => {
        fs.createReadStream(archiveFile)
            .pipe(unzip.Extract({ path: destDir }))
            .on('close', () => resolve())
            .on('error', (e: any) => reject(e));
    });
}

/**
 * 在目录树中按文件名递归查找第一个匹配的文件，返回其完整路径。
 */
export function findFileRecursive(dir: string, name: string): string | null {
    let entries: any[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return null;
    }
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            const found = findFileRecursive(full, name);
            if (found) return found;
        } else if (e.name === name) {
            return full;
        }
    }
    return null;
}

/**
 * 移动文件(同盘 rename，失败则 copy+unlink)。
 */
export function moveFile(src: string, dst: string): void {
    if (pub.file_exists(dst)) {
        pub.delete_file(dst);
    }
    try {
        fs.renameSync(src, dst);
    } catch {
        fs.copyFileSync(src, dst);
        try { fs.unlinkSync(src); } catch { /* ignore */ }
    }
}

/**
 * 递归拷贝目录内容到目标目录。
 */
export function copyDirContents(srcDir: string, dstDir: string): void {
    if (!pub.file_exists(dstDir)) {
        pub.mkdir(dstDir);
    }
    for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const s = path.join(srcDir, e.name);
        const d = path.join(dstDir, e.name);
        if (e.isDirectory()) {
            copyDirContents(s, d);
        } else {
            fs.copyFileSync(s, d);
        }
    }
}
