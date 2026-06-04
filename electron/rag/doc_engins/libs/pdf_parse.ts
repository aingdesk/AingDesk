import fs from 'fs';
import path from 'path';
import { pub } from '../../../class/public';
import { logger } from 'ee-core/log';
import axios from 'axios';
import { exec } from 'child_process';
import { initializeWorker,postProcessText,filterLowConfidenceLines,CONFIDENCE_THRESHOLD } from './image_parse';  // 这里引入了image_parse.ts中的函数，用于识别图片内容
import { getPopplerWindowsDownloadUrl, extractArchive, findFileRecursive, copyDirContents } from '../../../class/bin_assets';
// import * as pdfjsLib from 'pdfjs-dist';


// 封装错误处理和日志记录
const logError = (message: string, error: any) => {
    console.error(`${message}:`, error);
};


/**
 * PDF解析器类
 */
export class PdfParser {
    private filename: string;
    private pdfDocument: any;

    /**
     * 构造函数
     * @param filename PDF文件路径
     */
    constructor(filename: string, ragName: string) {
        this.filename = filename;
    }

    /**
     * 初始化PDF.js和加载文档
     * @returns 是否成功初始化
     */
    private async initPdfDocument(): Promise<boolean> {
        try {
            if (!fs.existsSync(this.filename)) {
                logError(`文件不存在`, this.filename);
                return false;
            }
            const pdfjsLib = await import('pdfjs-dist');
            const data = new Uint8Array(fs.readFileSync(this.filename));
            const loadingTask = pdfjsLib.getDocument({ data });
            this.pdfDocument = await loadingTask.promise;

            return true;
        } catch (error) {
            logError('初始化PDF文档失败', error);
            return false;
        }
    }


    /**
     * 解析PDF文件
     * @returns Markdown格式的内容
     */
    public async parse(): Promise<string> {
        if (!(await this.initPdfDocument()) || !this.pdfDocument) {
            return '';
        }
        let text = "";

        for (let i = 1; i <= this.pdfDocument.numPages; i++) {
            const page = await this.pdfDocument.getPage(i);
            const textContent = await page.getTextContent({ includeMarkedContent: true });
            let items: any = textContent.items;
            let isEndMarkedContent = false;
            let endMarkedContent = 0;
            let isStart = true;
            for (let item of items) {
                // 标记内容结束
                if (item.type == 'endMarkedContent') {
                    endMarkedContent++;
                }

                // 拼接文本
                if (item.fontName) {
                    text += item.str;
                    endMarkedContent = 0;
                }

                // 根据标记增加换行符，并重置标记
                if (endMarkedContent == 2) {
                    text += "\n";
                    endMarkedContent = 0;
                    isEndMarkedContent = true;
                }

                // 开始和EOL标记视结束标记情况增加换行符
                if ((item.hasEOL && isStart) || (!isEndMarkedContent && item.hasEOL)) {
                    text += "\n";
                    isStart = false;
                }
            }

            // 每页结束增加换行符
            text += "\n";

        }
        // 去掉不可见字符
        text = text.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "");
        text = text.replace(/[]/g, "");
        return text.trim();
    }
    async download_file(url: string, saveFile: string) {
        let abort = new AbortController();

        // 发起下载请求
        let headers = {
            'User-Agent': 'AingDesk/' + pub.version()
        };
        let downloadBytes = 0;
        if (pub.file_exists(saveFile)) {
            const stats = pub.stat(saveFile);
            downloadBytes = stats.size;
        }

        if (downloadBytes > 0) {
            headers['Range'] = `bytes=${downloadBytes}-`;
        }
        try {
            const response = await axios({
                url: url,
                method: 'GET',
                headers: headers,
                responseType: 'stream',
                signal: abort.signal,
                // 禁止使用代理
                proxy: false
            });

            // 检查响应头中的Content-Length字段
            const contentLength = response.headers['content-length'];
            // 检查是否已经下载完成
            if (contentLength && downloadBytes >= parseInt(contentLength) || response.status === 416) {

                logger.info(`文件 ${saveFile} 已经下载完成，跳过下载`);
                return true;
            }


            // 检查响应状态码
            if (response.status !== 200 && response.status !== 206) {
                logger.error(`下载文件失败，状态码: ${response.status}`);
                return false;
            }

            const writer = fs.createWriteStream(saveFile, { flags: 'a' });
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    resolve(true);
                });
                writer.on('error', (error) => {
                    reject(error);
                });
            });
        } catch (e) {
            if (e.message.indexOf('status code 416') !== -1) {
                logger.info(`文件 ${saveFile} 已经下载完成，跳过下载`);
                return true;
            }
            return false;
        }
    }

    /**
     * 获取当前操作系统的路径
     * @returns {string} - 返回当前操作系统的路径
     */
    get_os_path() {
        let os_path = 'win-';
        if (pub.is_mac()) {
            os_path = 'darwin-';
        } else if (pub.is_linux()) {
            os_path = 'linux-';
        }
        os_path += process.arch;
        return os_path;

    }

    async install_poppler() {
        let popplerFile = this.get_poppler_bin();
        if (pub.file_exists(popplerFile)) {
            return pub.return_success(pub.lang('已安装'));
        }
        global.popplerInstall = true;
        let popplerDir = this.get_poppler_path();        // bin/poppler
        let binParent = path.dirname(popplerDir);        // bin
        let popplerzipFile = path.resolve(binParent, 'poppler.zip');
        let extractDir = path.resolve(binParent, 'poppler-extract');

        try {
            // 从官方上游(oschwartz10612/poppler-windows) 直连下载最新 release
            let downloadUrl = await getPopplerWindowsDownloadUrl();
            const ok = await this.download_file(downloadUrl, popplerzipFile);
            if (!ok) {
                return pub.return_error(pub.lang('安装失败'));
            }
            await extractArchive(popplerzipFile, extractDir, 'zip');
            // 上游包内层为 poppler-<ver>/Library/bin/*(含 pdfimages.exe 及其依赖 dll)
            const pdfimages = findFileRecursive(extractDir, 'pdfimages.exe');
            if (!pdfimages) {
                return pub.return_error(pub.lang('安装失败'));
            }
            // 把整个 bin 目录内容(含 dll)拷到 bin/poppler
            copyDirContents(path.dirname(pdfimages), popplerDir);
            if (!pub.file_exists(popplerFile)) {
                return pub.return_error(pub.lang('安装失败'));
            }
            return pub.return_success(pub.lang('安装成功'));
        } catch (error: any) {
            logger.error('安装 poppler 失败:', error);
            return pub.return_error(pub.lang('安装失败'));
        } finally {
            pub.delete_file(popplerzipFile);
            try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch { /* ignore */ }
            global.popplerInstall = false;
        }
    }


    get_poppler_path() {
        let binPath = path.resolve(pub.get_user_data_path(), 'bin', 'poppler');
        if (!pub.file_exists(binPath)) {
            pub.mkdir(binPath);
        }
        return binPath;
    }

    get_poppler_bin() {
        
        if (pub.is_windows()) {
            let binPath = this.get_poppler_path();
            return path.resolve(binPath, 'pdfimages.exe');
        }

        // macOS 和 Linux 通过which获取系统中已存在的的pdfimages路径
        return pub.exec_shell('which pdfimages').trim();
    }

    public async pdf2Image(): Promise<string> {
        let popplerBin = this.get_poppler_bin();
        if (!pub.file_exists(popplerBin)) {
            if(!pub.is_windows()) {
                // 如果不是windows系统，不自动安装，直接返回
                return '';
            }
            await this.install_poppler();
        }
        if(!pub.file_exists(popplerBin)) {
            console.log('popplerBin', popplerBin)
            return ''
        }

        // 执行命令
        let imageTmpPath = path.resolve(pub.get_user_data_path(), 'tmp', 'pdf2image',pub.md5(this.filename));
        if (!pub.file_exists(imageTmpPath)) {
            pub.mkdir(imageTmpPath);
        }
        let command = `${popplerBin} ${this.filename} ${imageTmpPath}/tmp`;
        let result = '';

        // 使用exec执行命令防止主进程阻塞，同时等待命令执行完成，以便获取输出
        await new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`pdf to images error: ${error.message}`);
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });

        let imageList = pub.readdir(imageTmpPath)

        // 初始化 Tesseract worker
        let worker = await initializeWorker();
        
        for(let imageFile of imageList) {
            try{
                const { data } = await worker.recognize(imageFile);
                // 对识别结果进行后处理
                let cleanText = postProcessText(data.text);
            
                // 过滤低置信度行
                const lines = data.blocks || [];
                const filteredText = filterLowConfidenceLines(lines, CONFIDENCE_THRESHOLD);
            
                // 如果过滤后的文本有内容，则使用它
                if (filteredText.trim().length > 0) {
                    cleanText = filteredText;
                }

                result += cleanText + "\n";
            }catch (error) {
                logError('解析图片失败', error);
            }
        }
        // 终止 worker
        await worker.terminate();

        // 删除临时文件
        if(pub.file_exists(imageTmpPath)) {
            pub.rmdir(imageTmpPath);
        }
        return result;
    }

    /**
     * 清理资源
     */
    public dispose(): void {
        if (this.pdfDocument) {
            this.pdfDocument.destroy();
            this.pdfDocument = null;
        }
    }
}

/**
 * 将 PDF 文件解析并转换为 Markdown 格式
 * @param filename PDF 文件路径
 * @returns Markdown 格式的字符串
 */
export async function parse(filename: string, ragName: string): Promise<string> {
    try {
        const parser = new PdfParser(filename, ragName);
        let markdown = await parser.parse();
        if (markdown.trim() == "") {
            // 如果解析结果为空，则尝试将 PDF 转换为图片并进行 OCR 识别
            markdown = await parser.pdf2Image();
        }
        return markdown;
    } catch (error) {
        logError('解析 PDF 文件失败', error);
        return '';
    }
}