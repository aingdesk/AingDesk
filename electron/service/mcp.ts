import path from 'path';
import { pub } from '../class/public';
import { logger } from 'ee-core/log';
import axios from 'axios';
import fs from 'fs';
import { ServerConfig, McpConfig } from './mcp_client';
import { getBunDownloadInfo, extractArchive, findFileRecursive, moveFile } from '../class/bin_assets';


class McpService {

    /**
     * 获取MCP配置文件
     * @returns {McpConfig|null} - 返回MCP配置对象，如果文件不存在或解析失败则返回null
     */
    read_mcp_config(): McpConfig | null {
        const mcp_config_file = path.resolve(pub.get_data_path(), 'mcp-server.json');
        if (!pub.file_exists(mcp_config_file)) {
            let defaultConfig = {
                mcpServers: []
            };
            pub.write_json(mcp_config_file, defaultConfig);
            logger.info(`MCP配置文件 ${mcp_config_file} 不存在，已创建默认配置文件`);
        }

        try {
            return pub.read_json(mcp_config_file);
        } catch (error) {
            logger.error(`读取 MCP 配置文件 ${mcp_config_file} 时出错:`, error);
            return null;
        }
    }
    /**
     * 获取MCP服务器列表
     * @returns {ServerConfig[]} - 返回MCP服务器列表
     */
    get_mcp_servers(): ServerConfig[] {
        let mcpConfig = this.read_mcp_config();
        if (mcpConfig && mcpConfig.mcpServers) {
            return mcpConfig.mcpServers;
        }
        return [];
    }


    /**
     * 保存MCP配置文件
     * @param {McpConfig} mcpConfig - MCP配置对象
     */
    save_mcp_config(mcpServers: ServerConfig[]): void {
        const mcp_config_file = path.resolve(pub.get_data_path(), 'mcp-server.json');
        try {
            let mcpConfig = this.read_mcp_config();
            if (!mcpConfig) {
                mcpConfig = { mcpServers: [] };
            }
            mcpConfig.mcpServers = mcpServers;
            pub.write_json(mcp_config_file, mcpConfig);
        } catch (error) {
            logger.error(`保存 MCP 配置文件 ${mcp_config_file} 时出错:`, error);
        }
    }


    /**
     * 获取常用的MCP服务器列表
     * @returns {Promise<any>} - 返回常用的MCP服务器列表
     */
    read_common_mcp_config() {
        const common_mcp_config_file = path.resolve(pub.get_data_path(), 'common-mcp-server.json');
        if (!pub.file_exists(common_mcp_config_file)) {
            return null;
        }

        try {
            return pub.read_json(common_mcp_config_file);
        } catch (error) {
            logger.error(`读取常用 MCP 配置文件 ${common_mcp_config_file} 时出错:`, error);
            return null;
        }
    }

    /**
     * 保存常用的MCP配置文件
     * @param {any} config - 常用MCP配置对象
     */
    save_common_mcp_config(config: any) {
        const common_mcp_config_file = path.resolve(pub.get_data_path(), 'common-mcp-server.json');
        try {
            pub.write_json(common_mcp_config_file, config);
        } catch (error) {
            logger.error(`保存常用 MCP 配置文件 ${common_mcp_config_file} 时出错:`, error);
        }
    }


    get_bin_path() {
        let binPath = path.resolve(pub.get_user_data_path(), 'bin');
        if (!pub.file_exists(binPath)) {
            pub.mkdir(binPath);
        }
        return binPath;
    }

    get_bun_bin() {
        let binPath = this.get_bin_path();
        if (pub.is_windows()) {
            return path.resolve(binPath, 'bun.exe');
        }
        return path.resolve(binPath, 'bun');
    }

    get_uv_bin() {
        let binPath = this.get_bin_path();
        if (pub.is_windows()) {
            return path.resolve(binPath, 'uv.exe');
        }
        return path.resolve(binPath, 'uv');
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
        try{
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
        }catch (e) {
            if(e.message.indexOf('status code 416') !== -1) {
                logger.info(`文件 ${saveFile} 已经下载完成，跳过下载`);
                return true;
            }
            return false;
        }
    }


    /**
     * 安装 node.js环境
     * @param args - 参数对象
     */
    async install_npx() {
        let bunFile = this.get_bun_bin();
        if (pub.file_exists(bunFile)) {
            return pub.return_success(pub.lang('已安装'));
        }
        global.bunInstall = true;
        let binPath = this.get_bin_path();

        // 从官方上游(oven-sh/bun) 直连下载，上游包内层为 bun-<platform>/bun(.exe)
        const { url, format } = getBunDownloadInfo();
        let bunArchiveFile = path.resolve(binPath, 'bun-download.zip');
        let extractDir = path.resolve(binPath, 'bun-extract');

        try {
            const ok = await this.download_file(url, bunArchiveFile);
            if (!ok) {
                return pub.return_error(pub.lang('安装失败'));
            }
            await extractArchive(bunArchiveFile, extractDir, format);
            // 把内层子目录中的 bun 二进制提升到 bin 根目录
            const binName = pub.is_windows() ? 'bun.exe' : 'bun';
            const found = findFileRecursive(extractDir, binName);
            if (!found) {
                return pub.return_error(pub.lang('安装失败'));
            }
            moveFile(found, bunFile);
            if (pub.is_linux() || pub.is_mac()) {
                fs.chmodSync(bunFile, 0o755);
            }
            return pub.return_success(pub.lang('安装成功'));
        } catch (e) {
            logger.error('安装 bun 失败:', e);
            return pub.return_error(pub.lang('安装失败'));
        } finally {
            pub.delete_file(bunArchiveFile);
            try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch { /* ignore */ }
            global.bunInstall = false;
        }
    }

    /**
     * 清除node.js环境变量
     * @returns {void}
     */
    clear_node_env(){
        let env = process.env;
        let PATH_ARR = env['PATH'].split(";");
        let NEW_PATH_ARR = [];
        for (let key in PATH_ARR) {
            if (PATH_ARR[key].indexOf('node') == -1 && PATH_ARR[key].indexOf('npm') == -1) {
                NEW_PATH_ARR.push(PATH_ARR[key]);
            }
        }
        process.env['PATH'] = NEW_PATH_ARR.join(";");
    }


    /**
     * 保存 MCP 工具列表
     * @param name {string} - 工具名称
     * @param tools {any} - 工具列表
     * @returns 
     */
    save_mcp_tools(name:string,tools:any){
        let mcpToolsSavePath = path.resolve(pub.get_data_path(),'mcp_tools')
        if(!pub.file_exists(mcpToolsSavePath)){
            pub.mkdir(mcpToolsSavePath);
        }
        let mcpToolsFile = path.resolve(mcpToolsSavePath, `${name}.json`);
        try{
            pub.write_json(mcpToolsFile, tools);
        }catch (e) {
            logger.error(`保存 MCP 工具文件 ${mcpToolsFile} 时出错:`, e);
        }
    }

    /**
     * 读取 MCP 工具列表
     * @param name {string} - 工具名称
     * @returns 
     */
    read_mcp_tools(name:string){
        let mcpToolsSavePath = path.resolve(pub.get_data_path(),'mcp_tools')
        if(!pub.file_exists(mcpToolsSavePath)){
            return [];
        }
        let mcpToolsFile = path.resolve(mcpToolsSavePath, `${name}.json`);
        if(!pub.file_exists(mcpToolsFile)){
            return [];
        }
        try{
            return pub.read_json(mcpToolsFile);
        }catch (e) {
            logger.error(`读取 MCP 工具文件 ${mcpToolsFile} 时出错:`, e);
            return [];
        }
    }

    /**
     * 同步常用 MCP 服务器配置
     *
     * 原先依赖宝塔官网(aingdesk.bt.cn/config/common-mcp-server.json，现已 404)，
     * 现改为读取随包内置的 common-mcp-server.json(build/extraResources)，不再走网络。
     * @returns {Promise<any>} - 返回同步结果
     */
    async sync_cloud_mcp(){
        let bundledFile = path.resolve(pub.get_resource_path(), 'common-mcp-server.json');
        if(!pub.file_exists(bundledFile)){
            return pub.return_error(pub.lang('获取失败'));
        }

        let commonMcpConfig: any;
        try {
            commonMcpConfig = pub.read_json(bundledFile);
        } catch (e) {
            logger.error('读取内置 common-mcp-server.json 失败:', e);
            return pub.return_error(pub.lang('配置文件格式错误'));
        }

        if(!commonMcpConfig || !commonMcpConfig.mcpServers){
            return pub.return_error(pub.lang('配置文件格式错误'));
        }
        mcpService.save_common_mcp_config(commonMcpConfig);
        return pub.return_success(pub.lang('同步成功'));
    }

}

/**
 * 重写 McpService 类的 toString 方法，方便调试和日志输出
 * @returns {string} - 类的字符串表示
 */
McpService.toString = () => '[class McpService]';

/**
 * 导出 McpService 类的单例实例
 */
export const mcpService = new McpService();
