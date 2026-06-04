import { pub } from '../class/public';
import * as path from 'path';
import { logger } from 'ee-core/log';
import { ServerConfig, ToolInfo, MCPClient ,McpConfig} from '../service/mcp_client';
import { mcpService } from '../service/mcp';
import fs from 'fs';
import { getUvDownloadInfo, extractArchive, findFileRecursive, moveFile } from '../class/bin_assets';




/**
 * mcp controller 类，用于处理MCP相关逻辑
 * @class
 */
class McpController {
    

    /**
     * 获取已安装的MCP服务器列表
     * @param args 
     * @returns {Promise<any>} - 返回已安装的MCP服务器列表
     */
    async get_mcp_server_list(args): Promise<any> {
        let mcpServers: ServerConfig[] = mcpService.get_mcp_servers();

        // 获取服务器工具列表
        for(let server of mcpServers){
            server.tools = mcpService.read_mcp_tools(server.name);
        }

        return pub.return_success(pub.lang('获取成功'), mcpServers);
    }

    /**
     * 获取常用的MCP服务器列表
     * @param args 
     * @returns {Promise<any>} - 返回常用的MCP服务器列表
     */
    async get_common_server_list(args): Promise<any> {
        let commonMcpConfig = mcpService.read_common_mcp_config();
        let mcpServers: any[] = [];
        if (commonMcpConfig && commonMcpConfig) {
            mcpServers = commonMcpConfig;

            // 判断是否已安装
            let lastMcpServers = mcpService.get_mcp_servers();
            for (let i = 0; i < mcpServers.length; i++) {
                let server = mcpServers[i];
                if (lastMcpServers && lastMcpServers.length > 0) {
                    let installedServer = lastMcpServers.find((s: ServerConfig) => s.name === server.name);
                    if (installedServer) {
                        server.is_install = true;
                    } else {
                        server.is_install = false;
                    }
                } else {
                    server.is_install = false;
                }
            }
        }

        return pub.return_success(pub.lang('获取成功'), mcpServers);
    }


    /**
     * 获取MCP服务器信息
     * @param args 
     * @returns {Promise<any>} - 返回MCP服务器信息
     */
    async get_mcp_server_info(args: { name: string }): Promise<any> {
        let mcpServers: ServerConfig[] = mcpService.get_mcp_servers();
        let server = mcpServers.find((s: ServerConfig) => s.name === args.name);
        if (!server) {
            return pub.return_error(pub.lang('未找到该服务器'));
        }

        // 获取服务器工具列表
        // todo: 需要根据服务器类型获取对应的工具列表
        let tools: ToolInfo[] = [];
        server.tools = tools;
        return pub.return_success(pub.lang('获取成功'), server);
    }

    /**
     * 修改MCP服务器信息
     * @param args.name <string> - MCP服务器名称
     * @param args.discription <string> - 描述
     * @param args.type <string> - 类型 (stdio | sse)
     * @param args.command <string> - 执行命令 (npx | uv | 其它可执行文件全路径)
     * @param args.baseUrl <string> - 服务器URL地址
     * @param args.env <object> - 环境变量
     * @param args.args <string[]> - 参数
     * @param args.is_active <boolean> - 是否可用
     * @return {Promise<any>} - 返回操作结果
     */
    async modify_mcp_server(args: {
        name: string,
        description: string,
        type: "stdio" | "sse",
        command: string,
        baseUrl: string,
        env: Record<string, string>,
        args: string[],
        is_active: boolean
    }) {


        let mcpConfig = mcpService.read_mcp_config();
        let mcpServers: ServerConfig[] = [];
        if (mcpConfig && mcpConfig.mcpServers) {
            mcpServers = mcpConfig.mcpServers;
        }

        let server = mcpServers.find((s: ServerConfig) => s.name === args.name);
        if (!server) {
            return pub.return_error(pub.lang('未找到该服务器'));
        }

        server.description = args.description;
        server.type = args.type;
        server.command = args.command;
        server.baseUrl = args.baseUrl;
        server.env = args.env;
        server.args = args.args;
        server.isActive = args.is_active;


        // 保存配置文件
        mcpService.save_mcp_config(mcpServers);
        return pub.return_success(pub.lang('修改成功'));
    }


    /**
     * 卸载MCP服务器
     * @param args.name <string> - MCP服务器名称
     * @return {Promise<any>} - 返回操作结果
     */
    async remove_mcp_server(args: { name: string }) {
        let mcpConfig = mcpService.read_mcp_config();
        let mcpServers: ServerConfig[] = [];
        if (mcpConfig && mcpConfig.mcpServers) {
            mcpServers = mcpConfig.mcpServers;
        }

        let serverIndex = mcpServers.findIndex((s: ServerConfig) => s.name === args.name);
        if (serverIndex === -1) {
            return pub.return_error(pub.lang('未找到该服务器'));
        }

        // 删除服务器
        mcpServers.splice(serverIndex, 1);

        // 保存配置文件
        mcpService.save_mcp_config(mcpServers);
        return pub.return_success(pub.lang('卸载成功'));
    }

    /**
     * 添加MCP服务器
     * @param args.name <string> - MCP服务器名称
     * @param args.description <string> - 描述
     * @param args.type <string> - 类型 (stdio | sse)
     * @param args.command <string> - 执行命令 (npx | uv | 其它可执行文件全路径)
     * @param args.baseUrl <string> - 服务器URL地址
     * @param args.env <object> - 环境变量
     * @param args.args <string[]> - 参数
     * @return {Promise<any>} - 返回操作结果
     */
    async add_mcp_server(args: {
        name: string,
        description: string,
        type: "stdio" | "sse",
        command: string,
        baseUrl: string,
        env: Record<string, string>,
        args: string[]
    }) {

        let mcpConfig = mcpService.read_mcp_config();
        let mcpServers: ServerConfig[] = [];
        if (mcpConfig && mcpConfig.mcpServers) {
            mcpServers = mcpConfig.mcpServers;
        }

        // 判断是否已存在
        let server = mcpServers.find((s: ServerConfig) => s.name === args.name);
        if (server) {
            return pub.return_error(pub.lang('该服务器已存在'));
        }

        if (typeof args.env === 'string') {
            try {
                args.env = JSON.parse(args.env);
            } catch (e) {
                return pub.return_error(pub.lang('环境变量格式错误'));
            }
        }
        if (typeof args.args === 'string') {
            try {
                args.args = JSON.parse(args.args);
            } catch (e) {
                return pub.return_error(pub.lang('参数格式错误'));
            }
        }
        

        // 添加服务器
        server = {
            name: args.name,
            description: args.description,
            type: args.type,
            command: args.command,
            baseUrl: args.baseUrl,
            env: args.env,
            args: args.args,
            isActive: true
        };

        mcpServers.push(server);

        // 保存配置文件
        mcpService.save_mcp_config(mcpServers);
        return pub.return_success(pub.lang('添加成功'));
    }

    /**
     * 修改MCP服务器工具信息
     * @param args.name <string> - MCP服务器名称
     * @param args.tools <Record<string,boolean>> - 工具可用性
     * @return {Promise<any>} - 返回操作结果
     */
    async modify_mcp_tools(args: { name: string, tools: Record<string, boolean> }) {
        let mcpConfig = mcpService.read_mcp_config();
        let mcpServers: ServerConfig[] = [];
        if (mcpConfig && mcpConfig.mcpServers) {
            mcpServers = mcpConfig.mcpServers;
        }

        let server = mcpServers.find((s: ServerConfig) => s.name === args.name);
        if (!server) {
            return pub.return_error(pub.lang('未找到该服务器'));
        }

        // 修改工具可用性
        for (let i = 0; i < server.tools.length; i++) {
            let tool = server.tools[i];
            if (args.tools[tool.name] !== undefined) {
                tool.is_active = args.tools[tool.name];
            }
        }


        // 保存配置文件
        mcpService.save_mcp_config(mcpServers);
        return pub.return_success(pub.lang('修改成功'));
    }

    


    /**
     * 获取MCP服务器工具信息
     * @param args.name <string> - MCP服务器名称
     */
    async get_mcp_tools(args:{name:string}){
        let mcpConfig = mcpService.read_mcp_config();
        let mcpServers: ServerConfig[] = [];
        if (mcpConfig && mcpConfig.mcpServers) {
            mcpServers = mcpConfig.mcpServers;
        }

        let server = mcpServers.find((s: ServerConfig) => s.name === args.name);
        if (!server) {
            return pub.return_error(pub.lang('未找到该服务器'));
        }

        let mcpClient = new MCPClient()
        let tools = await mcpClient.getTools(server);

        // 保存工具信息
        if(tools){
            mcpService.save_mcp_tools(server.name, tools);
        }

        return pub.return_success(pub.lang('获取成功'), tools);

    }



    /**
     * 检查环境状态
     * @param args - 参数对象
     */
    async get_status(args: any) {
        let bunFile = mcpService.get_bun_bin();
        let isBun = 1;
        if (!pub.file_exists(bunFile)) {
            isBun = 0;
        }

        if (isBun === 0) {
            if (global.bunInstall) {
                isBun = 2;
            }
        }

        let uvFile = mcpService.get_uv_bin();
        let isUv = 1;
        if (!pub.file_exists(uvFile)) {
            isUv = 0;
        }

        if (isUv === 0) {
            if (global.uvInstall) {
                isUv = 2;
            }
        }

        return pub.return_success(pub.lang('获取成功'), {
            node_npx: isBun,
            python_uv: isUv,
        });

    }






    /**
     * 安装 node.js环境
     * @param args - 参数对象
     */
    async install_npx(args: any) {
        return mcpService.install_npx();
    }


    /**
     * 安装 python环境
     * @param args - 参数对象
     */
    async install_uv(args: any) {
        let uvFile = mcpService.get_uv_bin();
        if (pub.file_exists(uvFile)) {
            return pub.return_success(pub.lang('已安装'));
        }
        global.uvInstall = true;
        let binPath = mcpService.get_bin_path();

        // 从官方上游(astral-sh/uv) 直连下载：
        // - Windows 为 zip，根目录含 uv.exe/uvx.exe
        // - macOS/Linux 为 tar.gz，内层 uv-<target>/uv、uvx
        const { url, format } = getUvDownloadInfo();
        let uvArchiveFile = path.resolve(binPath, format === 'tgz' ? 'uv-download.tar.gz' : 'uv-download.zip');
        let extractDir = path.resolve(binPath, 'uv-extract');

        try {
            const ok = await mcpService.download_file(url, uvArchiveFile);
            if (!ok) {
                return pub.return_error(pub.lang('安装失败'));
            }
            await extractArchive(uvArchiveFile, extractDir, format);
            // 把 uv / uvx 提升到 bin 根目录
            const exe = pub.is_windows() ? '.exe' : '';
            for (const name of [`uv${exe}`, `uvx${exe}`]) {
                const found = findFileRecursive(extractDir, name);
                if (found) {
                    const dst = path.resolve(binPath, name);
                    moveFile(found, dst);
                    if (pub.is_linux() || pub.is_mac()) {
                        fs.chmodSync(dst, 0o755);
                    }
                }
            }
            if (!pub.file_exists(uvFile)) {
                return pub.return_error(pub.lang('安装失败'));
            }
            return pub.return_success(pub.lang('安装成功'));
        } catch (error: any) {
            logger.error('安装 uv 失败:', error);
            return pub.return_error(pub.lang('安装失败'), error);
        } finally {
            pub.delete_file(uvArchiveFile);
            try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch { /* ignore */ }
            global.uvInstall = false;
        }
    }

    /**
     * 获取MCP配置文件内容
     * @param args - 参数对象
     * @returns {Promise<any>} - 返回MCP配置文件内容
     */
    async get_mcp_config_body(args: any) {
        let mcpConfig = mcpService.read_mcp_config();
        if (mcpConfig && mcpConfig.mcpServers) {
            return pub.return_success(pub.lang('获取成功'), {
                mcp_config_body: JSON.stringify(mcpConfig, null, 4),
            });
        } else {
            return pub.return_error(pub.lang('未找到MCP配置'));
        }
    }

    /**
     * 保存MCP配置文件内容
     * @param args - 参数对象
     * @returns {Promise<any>} - 返回操作结果
     */
    async save_mcp_config_body(args: { mcp_config_body: string }) {
        let mcpConfig = mcpService.read_mcp_config();
        if (mcpConfig && mcpConfig.mcpServers) {
            try{
                let newMcpConfig = JSON.parse(args.mcp_config_body);
                if(!newMcpConfig.mcpServers){
                    return pub.return_error(pub.lang('配置文件格式错误'));
                }
                let mcpServers = newMcpConfig.mcpServers;
                mcpService.save_mcp_config(mcpServers);
                return pub.return_success(pub.lang('保存成功'));
            }catch(e){
                logger.error(`保存 MCP 配置文件时出错:${e}`);
                return pub.return_error(pub.lang('配置文件格式错误'));
            }
        } else {
            return pub.return_error(pub.lang('未找到MCP配置'));
        }
    }

    /**
     * 获取pypi和npm的源列表
     * @param args - 参数对象
     * @returns 
     */
    async get_registry_list(args:any){
        let registryListFile = path.resolve(pub.get_resource_path(), 'index_list.json');
        let defaultList = {
            "pypi":[
                {
                    "name":"pypi",
                    "url":"https://pypi.python.org/simple",
                    "description":"Python官方源"
                },
                {
                    "name":"清华大学源",
                    "url":"https://pypi.tuna.tsinghua.edu.cn/simple",
                    "description":"清华大学源，适合中国用户"
                }
            ],
            "npm":[
                {
                    "name":"npm",
                    "url":"https://registry.npmjs.org",
                    "description":"npm官方源"
                },
                {
                    "name":"淘宝源",
                    "url":"https://registry.npmmirror.com",
                    "description":"淘宝源，适合中国用户"
                }
            ]

        }

        if(pub.file_exists(registryListFile)){
            defaultList = pub.read_json(registryListFile);
        }

        return pub.return_success(pub.lang('获取成功'), defaultList);
    }

    /**
     * 同步云端的MCP配置文件
     * @param args - 参数对象
     * @returns {Promise<any>} - 返回操作结果
     */
    async sync_cloud_mcp(args:any){
        return await mcpService.sync_cloud_mcp()
    }

}

/**
 * 重写 McpController 类的 toString 方法，方便调试和日志输出
 * @returns {string} - 类的字符串表示
 */
McpController.toString = (): string => '[class McpController]';

// 导出 McpController 类的实例
export default new McpController();