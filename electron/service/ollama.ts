
import { pub } from '../class/public';
import * as path from 'path';
import axios from 'axios';
import * as fs from 'fs';
import { logger } from 'ee-core/log';
import { getOllamaDownloadInfo as getOllamaUpstreamInfo } from '../class/bin_assets';
// const { exec, execSync } = require('child_process');
import { exec, execSync } from 'child_process';

// 存储每个模型的下载速度和进度信息，键为模型全名，值为包含下载信息的对象
let ModelDownloadSpeed = new Map<string, Object>();
// 模型下载断开重连标志，若模型下载速度变得很慢，可设置该标志重连下载
let ReconnectModelDownload = false;
let ReconnectOllamaDownload = false;
// 下载速度列表
let ModelDownLoadSpeedList:number[] = [];
// 最近10秒钟的下载速度列表
let ModelDownLoadSpeedList10s:number[] = [];

// 存储 Ollama 本身的下载速度和进度信息
let OllamaDownloadSpeed = {
    total: 0,
    completed: 0,
    speed: 0,
    progress: 0,
    status: 0
};


/**
 * OllamaService 类，提供与 Ollama 相关的操作，如获取版本、管理模型、安装 Ollama 等
 */
class OllamaService {
    /**
     * 获取 Ollama 可执行文件的路径
     * @returns {string[]} 包含 Ollama 可执行文件路径的数组
     */
    get_ollama_bin(): string[] {
        if (pub.is_windows()) {
					// 获取当前用户的本地应用数据目录
					const localAppData = process.env['LOCALAPPDATA'];

					// 构建 Windows 系统下 Ollama 可执行文件的完整路径
					// C:\Users\Jack\AppData\Local\Programs\Ollama
					const ollamaBin = `${localAppData}\\Programs\\Ollama\\ollama.exe`;

					// console.log(ollamaBin);
					// 检查该文件是否存在
					if (pub.file_exists(ollamaBin)) {
						return [ollamaBin, 'ollama'];
					}

					return ['ollama'];
		}

        // 构建 Linux OR macos 系统下 Ollama 可执行文件的完整路径
        let result:string[] = [];
        let bins = ['/usr/local/bin/ollama','/usr/bin/ollama','/sbin/ollama'];
        for (let bin of bins) {
            if (pub.file_exists(bin)) {
                result.push(bin);
            }
        }

        result.push('ollama');
        return result;
    }

    /**
     * 获取 Ollama 的版本信息
     * @returns {string} 若成功获取到版本信息则返回版本号，否则返回空字符串
     */
    async version(): Promise<string> {
        try {
            try{
                // 尝试从11434端口获取版本信息
                let url = `${pub.get_ollama_host()}/api/version`;
                let res = await pub.httpRequest(url,{
                    timeout: 1000,
                    method: 'GET',
                    json: true
                });
                
                if (res.statusCode === 200) {
                    if(res.body && res.body.version){
                        return res.body.version;
                    }
                }
            }catch(e){
                logger.error('Get ollama version error:',e);
            }

            // 尝试从命令行获取版本信息
            const ollamaBinList = this.get_ollama_bin();
            for (const bin of ollamaBinList) {
                // 执行命令获取 Ollama 版本信息
                const res = pub.exec_shell(`${bin} --version`);
                // 使用正则表达式匹配版本信息
                const versionRegex = /version is (\S+)/;
                const match = res.match(versionRegex);
                if (match) {
                    return match[1];
                }
            }
            return '';
        } catch (error) {
            logger.error(pub.lang('获取 ollama 版本时出错:'), error);
            return '';
        }
    }

    /**
     * 检查 Ollama 是否正在运行
     * @returns {Promise<boolean>} 若 Ollama 正在运行则返回 true，否则返回 false
     */
    async is_running(): Promise<boolean> {
        try{
            const ollama = pub.init_ollama();
            await ollama.ps();
            logger.info('Ollama is running');
            return true;
        }catch(e){
            logger.warn('Ollama is not running');
            return false;
        }
    }

    /**
     * 启动 Ollama 服务
     * @returns {Promise<boolean>} 若 Ollama 启动成功则返回 true，否则返回 false
     */
    async start(): Promise<boolean> {
        if (pub.is_windows()) {
            exec('"ollama app"');
        }else if (pub.is_linux()) {
            exec('systemctl start ollama');
        }else if (pub.is_mac()) {
            exec('open /Applications/Ollama.app');
        }
        
        await pub.sleep(5000);

        return true;
    }


    /**
     * 获取嵌套模型列表
     * @returns {Promise<any[]>} 包含模型信息的数组，若出错则返回空数组
     */
    async get_embedding_model_list(): Promise<any[]> {
        const models  = await this.model_list();

        // 过滤出支持嵌套的模型
        let result = models.filter((model) => {
            return model.install && model.capability.includes('embedding');
        });

        // 构建模型信息
        result = result.map((model) => {
            let supplierName = "ollama";
            let title = `${supplierName}/${model.full_name}`;
            
            let modelInfo = {
                title: title,
                supplierName,
                model: model.full_name,
                size: model.size,
                contextLength: 512
            }
            return modelInfo;
        });

        return result;
        
    }


    /**
     * 获取 Ollama 模型列表
     * @returns {Promise<any[]>} 包含模型信息的数组，若出错则返回空数组
     */
    async model_list(): Promise<any[]> {
        try {
            // 构建模型列表文件的完整路径
            const modelListFile = path.resolve(pub.get_resource_path(), 'ollama_model.json');
            // 初始化模型源列表
            let modelListSrc: any[] = [];
            // 检查模型列表文件是否存在
            if (pub.file_exists(modelListFile)) {
                // 读取文件内容
                const modelListData = pub.read_file(modelListFile);
                // 解析 JSON 数据
                modelListSrc = JSON.parse(modelListData);
            }
            // 获取 Ollama 服务中的模型列表
            const ollama = pub.init_ollama();
            const { models } = await ollama.list();

            let isCn = pub.get_language() == 'zh';

            // 将models中存在，但modelListSrc中不存在的模型添加到modelListSrc中
            for (let model of models) {
                let isExist = false;
                for (let modelSrc of modelListSrc) {
                    // 转小写后比较
                    let srcName = modelSrc['full_name'].toLowerCase();
                    let dstName = model.name.toLowerCase();
                    if (srcName === dstName) {
                        isExist = true;
                        break;
                    }
                }

                if (!isExist) {
                    let arr = model.name.split(':');
                    let modelSrc = {
                        full_name: model.name,
                        name: arr[1],
                        parameters: '',
                        size: pub.bytesChange(model.size),
                        msg: '',
                        zh_cn_msg: '',
                        link: '',
                        pull_count: 0,
                        tag_count: 0,
                        updated: '',
                        updated_time: 0,
                        capability: [],
                    }
                    
                    // 读取模型的详细信息
                    for(let modelInfo of modelListSrc){
                        if (modelInfo['name'].toLowerCase() === arr[0]){
                            modelSrc['pull_count'] = modelInfo.pull_count;
                            modelSrc['tag_count'] = modelInfo.tag_count;
                            modelSrc['updated'] = modelInfo.updated;
                            modelSrc['updated_time'] = modelInfo.updated_time;
                            modelSrc['capability'] = modelInfo.capability;
                            modelSrc['zh_cn_msg'] = modelInfo.zh_cn_msg;
                            modelSrc['msg'] = modelInfo.msg;
                            modelSrc['link'] = modelInfo.link;
                            break;
                        }
                    }

                    modelListSrc.push(modelSrc);
                }
            }



            // 处理模型信息，添加安装状态等信息
            const modelList = modelListSrc.map((modelInfoSrc) => {
                const modelInfo = {
                    full_name: modelInfoSrc['full_name'],
                    model: modelInfoSrc['name'],
                    parameters: modelInfoSrc['parameters'],
                    download_size: modelInfoSrc['size'],
                    size: 0,
                    msg: modelInfoSrc['msg'],
                    title: isCn?modelInfoSrc['zh_cn_msg']:modelInfoSrc['msg'],
                    link: modelInfoSrc['link'],
                    pull_count: modelInfoSrc['pull_count'],
                    tag_count: modelInfoSrc['tag_count'],
                    updated: modelInfoSrc['updated'],
                    updated_time: modelInfoSrc['updated_time'],
                    capability: modelInfoSrc['capability'],
                    install: false,
                    running: false,
                    memory_size: 0,
                    memory_require: 0,
                    need_gpu: false,
                    performance: -1
                };
                // 检查模型是否已安装
                const installedModel = models.find((m) => {
                    return m.name.toLowerCase() === modelInfoSrc['full_name'].toLowerCase()
                });
                if (installedModel) {
                    modelInfo.install = true;
                    modelInfo.size = installedModel.size;
                }
                return modelInfo;
            });

            return modelList;
        } catch (error) {
            logger.error(pub.lang('获取 Ollama 模型列表时出错:'), error);
            return [];
        }
    }

    /**
     * 下载速度监控
     * @param fullModel <string> 模型全名，如：deepseek-r1:1.5b
     * @returns 
     */
    download_speed_monitoring(fullModel:string) {
        // 获取模型下载信息
        let data:any = null;
        if (fullModel === 'ollama') {
            data = OllamaDownloadSpeed;
        }else{
            data = ModelDownloadSpeed.get(fullModel);
            if (!data) {
                return;
            }
        }

        // 如果下载状态不是正在下载，则不进行检测
        if (data.status !== 1) {
            return;
        }

        // 如果下载速度列表长度小于60，则不进行检测
        if(ModelDownLoadSpeedList.length < 60){
            return;
        }

        // 获取最近1分钟的平均下载速度和最近10秒钟的平均下载速度
        let {average, average10s} = this.get_average_speed();
        
        
        // 如果最近10秒钟的平均下载速度小于最近1分钟的平均下载速度的1/3，则认为下载速度很慢，重新下载
        if (average10s < average / 3) {
            logger.warn(pub.lang('检测到下载速度异常，正在尝试重新连接下载节点...'));
            if (fullModel === 'ollama') {
                this.reconnect_ollama_download();
            }else{
                this.reconnect_model_download();
            }
            
            ModelDownLoadSpeedList = [];
            ModelDownLoadSpeedList10s = [];
        }
    }

    /**
     * 添加下载速度到列表 
     * @param speed <number> 下载速度
     */
    append_speed_to_list(speed:number) {
        // 存储最近1分钟的下载速度
        ModelDownLoadSpeedList.push(speed);
        if (ModelDownLoadSpeedList.length > 60) {
            ModelDownLoadSpeedList.shift();
        }

        // 存储最近10秒钟的下载速度
        ModelDownLoadSpeedList10s.push(speed);
        if (ModelDownLoadSpeedList10s.length > 10) {
            ModelDownLoadSpeedList10s.shift();
        }
    }

    /**
     * 获取平均下载速度
     * @returns 
     */
    get_average_speed() {

        // 最近1分钟的平均下载速度
        let total:number = 0;
        for (let i = 0; i < ModelDownLoadSpeedList.length; i++) {
            total += ModelDownLoadSpeedList[i];
        }

        let average = total / ModelDownLoadSpeedList.length;

        // 最近10秒钟的平均下载速度
        total = 0;
        for (let i = 0; i < ModelDownLoadSpeedList10s.length; i++) {
            total += ModelDownLoadSpeedList10s[i];
        }

        let average10s = total / ModelDownLoadSpeedList10s.length;

        return {average, average10s};
    }


    /**
     * 安装指定模型
     * @param {string} model 模型名称，如：deepseek-r1
     * @param {string} parameters 模型参数规模，如：1.5b
     * @returns {Promise<boolean>} 安装成功返回 true，否则返回 false
     */
    async install_model(model: string, parameters: string): Promise<boolean> {
        // 构建模型全名
        let fullModel = `${model}:${parameters}`;
        // 若该模型的下载信息已存在，则删除
        
        if (ModelDownloadSpeed.has(fullModel) && !ReconnectModelDownload) {
            ModelDownloadSpeed.delete(fullModel);
        }

        ReconnectModelDownload = false;
        try {
            // 发起模型拉取请求，并开启流式响应
            const ollama = pub.init_ollama();
            let stream = await ollama.pull({ model: fullModel, stream: true });
            let lastTime = pub.time();
            let lastCompleted = 0;
            let speed = 0;
            let setEnd = false;
            for await (let part of stream) {
                if (part.digest) {
                    // 计算完成百分比
                    let percent = 0;
                    if (part.completed && part.total) {
                        percent = Math.round((part.completed / part.total) * 100);
                    }
                    // 计算每秒速度
                    let currentTime = pub.time();
                    if (currentTime - lastTime > 0) {
                        let completed = part.completed - lastCompleted;
                        speed = completed / (currentTime - lastTime);
                        lastTime = currentTime;
                        lastCompleted = part.completed;
                        this.append_speed_to_list(speed);
                        this.download_speed_monitoring(fullModel);
                    }
                    if (speed < 0) {
                        speed = 0;
                    }
                    // 构建包含下载信息的对象
                    let data = {
                        digest: part.digest,
                        status: setEnd ? 2 : 1,
                        progress: percent,
                        speed,
                        total: part.total,
                        completed: part.completed,

                    };
                    if (setEnd) {
                        data.status = 2;
                        data.progress = 100;
                        data.speed = speed;
                    }
                    if (percent === 100 && !setEnd) {
                        setEnd = true;
                        // 可在此处添加检查模型配置完成的逻辑
                    }
                    // 更新该模型的下载信息
                    ModelDownloadSpeed.set(fullModel, data);

                    // 检查是否断开重新下载，PS: 断点续传
                    if(ReconnectModelDownload) {
                        stream.abort();
                        setTimeout(() => {
                            this.install_model(model, parameters);
                        }, 200);
                        return true;
                    }
                } else if (part.status === 'success') {
                    ModelDownLoadSpeedList = [];
                    ModelDownLoadSpeedList10s = [];
                    // 模型安装成功，更新下载信息
                    let data = {
                        digest: '',
                        status: 3,
                        progress: 100,
                        speed: 0,
                        total: 0,
                        completed: 0
                    };
                    ModelDownloadSpeed.set(fullModel, data);
                }
            }
            return true;
        } catch (error) {
            logger.error(pub.lang('安装模型时出错:'), error);
            return false;
        }
    }


    /**
     * 重连模型下载
     */
    reconnect_model_download() {
        ReconnectModelDownload = true;
        ReconnectOllamaDownload = true;
    }


    /**
     * 重连 Ollama 下载
     */
    reconnect_ollama_download() {
        ReconnectOllamaDownload = true;
    }

    /**
     * 获取模型安装进度
     * @param {string} model 模型名称，如：deepseek-r1
     * @param {string} parameters 模型参数规模，如：1.5b
     * @returns {Object} 包含模型下载进度和速度等信息的对象
     */
    get_model_install_progress(model: string, parameters: string): Object {
        const fullModel = `${model}:${parameters}`;
        const data = ModelDownloadSpeed.get(fullModel);
        if (data) {
            return data;
        }
        return {
            digest: '',
            status: 0,
            progress: 0,
            speed: 0,
            total: 0,
            completed: 0
        };
    }

    /**
     * 删除指定模型
     * @param {string} model 模型名称，如：deepseek-r1
     * @param {string} parameters 模型参数规模，如：1.5b
     * @returns {Promise<any>} 删除操作的结果
     */
    async remove_model(model: string, parameters: string): Promise<any> {
        const fullModel = `${model}:${parameters}`;
        try {
            const ollama = pub.init_ollama();
            return await ollama.delete({ model: fullModel });
        } catch (error) {
            logger.error(pub.lang('删除模型时出错:'), error);
            return null;
        }
    }

    
    async ollama_download_end(downloadFile:string) {
        try {
            const installed = await this.installOllamaAfterDownload(downloadFile);
            if (installed) {
                logger.info(pub.lang('安装完成'));
            }
        } catch (error) {
            logger.error(pub.lang('安装过程中出现错误:'), error);
        }
    }


    /**
     * 安装 Ollama
     * @returns {Promise<boolean>} 安装成功返回 true，否则返回 false
     */
    async install_ollama(): Promise<boolean> {
        ReconnectOllamaDownload = false;
        // 根据不同操作系统确定下载 URL 和文件路径
        const { downloadUrl, downloadFile } = await this.getOllamaDownloadInfo();
        // 创建写入流
        const writer = fs.createWriteStream(downloadFile,{flags:'a'});
        try {
            if (!downloadUrl || !downloadFile) {
                return false;
            }
            // 如果文件已存在，获取文件大小，准备断点续传
            let downloadBytes = 0;
            if (pub.file_exists(downloadFile)) {
                downloadBytes = pub.filesize(downloadFile);
            }
            
            // 发起下载请求
            let headers = {
                'User-Agent': 'AingDesk/' + pub.version()
            };

            if (downloadBytes > 0) {
                headers['Range'] = `bytes=${downloadBytes}-`;
            }

            let abort = new AbortController();
            const response = await axios({
                url: downloadUrl,
                method: 'GET',
                headers: headers,
                responseType: 'stream',
                signal: abort.signal,
                // 禁止使用代理
                proxy: false
            });

            // 初始化下载速度信息
            OllamaDownloadSpeed = {
                total: 0,
                completed: 0,
                speed: 0,
                progress: 0,
                status: 0
            }

            // 获取文件大小
            OllamaDownloadSpeed.total = parseInt(response.headers['content-length'], 10);

            if (downloadBytes > 0) {
                OllamaDownloadSpeed.completed = downloadBytes;
                OllamaDownloadSpeed.total += downloadBytes;
            }


            let downloadSize = 0;
            let startTime = pub.time();
            let speed = 0;
            // 更新下载进度和速度的函数
            const updateProgress = () => {
                const currentTime = pub.time();
                if (currentTime - startTime > 0) {
                    OllamaDownloadSpeed.speed = speed / (currentTime - startTime);
                    startTime = currentTime;
                    speed = 0;

                    // 更新下载速度
                    this.append_speed_to_list(OllamaDownloadSpeed.speed);
                    this.download_speed_monitoring('ollama');
                }
                OllamaDownloadSpeed.status = 1;
                OllamaDownloadSpeed.progress = Math.round((OllamaDownloadSpeed.completed / OllamaDownloadSpeed.total) * 100);

                // 检查是否断开重新下载，PS: 断点续传
                if(ReconnectOllamaDownload) {
                    abort.abort();
                    setTimeout(() => {
                        this.install_ollama();
                    }, 200);
                }
                
            };

            // 监听数据事件，更新下载进度
            response.data.on('data', (chunk) => {
                OllamaDownloadSpeed.completed += chunk.length;
                downloadSize += chunk.length;
                speed += chunk.length;
                updateProgress();
            });
            // 监听流结束事件，开始安装 Ollama
            response.data.on('end', async () => {
                writer.close();
                await this.ollama_download_end(downloadFile);
            });
            // 监听错误事件，处理下载错误
            const handleError = async (error) => {
                if (error.code === 'ERR_CANCELED') {
                    return;
                }
                logger.error(pub.lang('下载过程中出现错误:'), error);
                OllamaDownloadSpeed.status = -1;
                
                
            };
            response.data.on('error', handleError);
            writer.on('error', handleError);
            // 将响应数据写入文件
            response.data.pipe(writer);


            return true;
        } catch (error:any) {
            // 检查是否Request failed with status code 416错误
            if (error.code === 'ERR_BAD_REQUEST' || error.status == 416){
                OllamaDownloadSpeed.status = 2;
                OllamaDownloadSpeed.progress = 100;
                OllamaDownloadSpeed.completed = OllamaDownloadSpeed.total;
                writer.close();
                this.ollama_download_end(downloadFile);
                return true;
            }else if(error.code === 'ERR_CANCELED'){
                return false;
            }else{
                logger.error(pub.lang('安装过程中出现未知错误:'), error);
                return false;
            }
        }
    }

    /**
     * 获取 Ollama 安装进度
     * @returns {Object} 包含 Ollama 下载进度和速度等信息的对象
     */
    get_ollama_install_progress(): Object {
        return OllamaDownloadSpeed;
    }

    /**
     * 设置 Ollama 模型存储目录
     * @param {string} save_path 模型存储目录的路径
     * @returns {boolean} 设置成功返回 true，否则返回 false
     */
    set_ollama_model_save_path(save_path: string): boolean {
        try {
            if (pub.is_windows()) {
                // 修改 Windows 环境变量
                execSync(`setx OLLAMA_MODELS "${save_path}"`, { shell: 'cmd.exe' });
                process.env.OLLAMA_MODELS = save_path;
                logger.info(pub.lang('Windows 环境变量设置成功。'));
                // 结束 Ollama 进程
                this.killOllamaProcess('cmd.exe');
                // 重新启动 Ollama
                exec('"ollama app"');
                logger.info(pub.lang('Ollama 已重新启动。'));
            } else if (pub.is_linux()) {
                // 修改 Linux 环境变量
                const shellConfigFile = `${process.env.HOME}/.bashrc`;
                const configContent = `export OLLAMA_MODELS="${save_path}"`;
                execSync(`echo "${configContent}" >> ${shellConfigFile}`);
                process.env.OLLAMA_MODELS = save_path;
                logger.info(pub.lang('Linux 环境变量设置成功。'));
                // 结束 Ollama 进程
                this.killOllamaProcess('/bin/bash');
                // 重新启动 Ollama
                execSync('ollama serve &', { shell: '/bin/bash' });
                logger.info(pub.lang('Ollama 已重新启动。'));
            } else if (pub.is_mac()) {
                // 修改 macOS 环境变量
                const shellConfigFile = `${process.env.HOME}/.zshrc`;
                const configContent = `export OLLAMA_MODELS="${save_path}"`;
                execSync(`echo "${configContent}" >> ${shellConfigFile}`);
                process.env.OLLAMA_MODELS = save_path;
                logger.info(pub.lang('macOS 环境变量设置成功。'));
                // 结束 Ollama 进程
                this.killOllamaProcess('/bin/zsh');
                // 重新启动 Ollama
                execSync('ollama serve &', { shell: '/bin/zsh' });
                logger.info(pub.lang('Ollama 已重新启动。'));
            } else {
                logger.info(pub.lang('不支持的操作系统'));
                return false;
            }
            return true;
        } catch (error) {
            logger.error(pub.lang('设置 Ollama 模型存储目录或重启服务时出错:'), error);
            return false;
        }
    }

    /**
     * 根据操作系统获取 Ollama 的下载信息
     * @returns {downloadUrl: string, downloadFile: string } 包含下载 URL 和文件路径的对象
     */
    private async getOllamaDownloadInfo(): Promise<{ downloadUrl: string , downloadFile: string }> {
        // 从 Ollama 官方上游(GitHub Releases) 直连下载，按操作系统/架构选择资产
        const info = getOllamaUpstreamInfo();
        if (!info) {
            logger.info(pub.lang('不支持的操作系统'));
            return { downloadUrl: "", downloadFile: "" };
        }
        return {
            downloadUrl: info.url,
            downloadFile: path.resolve(pub.get_resource_path(), info.filename)
        };
    }

    /**
     * 下载完成后安装 Ollama
     * @param {string} downloadFile 下载的文件路径
     * @returns {Promise<boolean>} 安装成功返回 true，否则返回 false
     */
    private async installOllamaAfterDownload(downloadFile: string): Promise<boolean> {
        return new Promise((resolve) => {
            const checkInstallStatus = () => {
                setTimeout(async () => {
                    const version = await this.version();
                    if (version.length > 0) {
                        OllamaDownloadSpeed.status = 3;
                        logger.info('Ollama install successify');
                        pub.delete_file(downloadFile);
                        resolve(true);
                    } else {
                        OllamaDownloadSpeed.status = -1;
                        logger.error('Ollama install failed');
                        // pub.delete_file(downloadFile);
                        resolve(false);
                    }
                }, 5000);
            };

            setTimeout(() => {
                OllamaDownloadSpeed.status = 2;
                if (pub.is_windows()) {
                    // 设置环境变量 OLLAMA_HOST=127.0.0.1
                    exec('setx OLLAMA_HOST "127.0.0.1"', () => {
                        exec(`"${downloadFile}" /SILENT /NORESTART`, (error: any, stdout: any, stderr: any) => {
                            if (error) {
                                logger.error(`ollama install error: ${error.message}`);
                                resolve(false);
                            }
                            if (stderr) {
                                logger.error(`ollama install stderr: ${stderr}`);
                                resolve(false);
                            }
                            if (stdout) {
                                logger.info(`ollama install stdout: ${stdout}`);
                            }

                            OllamaDownloadSpeed = {
                                total: 0,
                                completed: 0,
                                speed: 0,
                                progress: 0,
                                status: 0

                            }

                            checkInstallStatus();
                        });
                    });
                } else if (pub.is_mac()) {
                    try {
                        pub.exec_shell(`unzip -o ${downloadFile} -d /Applications`);
                        // 启动 Ollama 服务
                        pub.exec_shell('open /Applications/Ollama.app');
                        if (pub.file_exists('/Applications/Ollama.app')) {
                            checkInstallStatus();
                        }
                    } catch (error) {
                        logger.error('Error during Ollama DMG installation:', error);
                        resolve(false);
                    }
                } else if (pub.is_linux()) {
                    try {
                        pub.exec_shell(`tar -xzf ${downloadFile} -C /usr/local`);
                        const shellConfigFile = '/etc/systemd/system/ollama.service';
                        const currentUser = pub.exec_shell('whoami').trim();
                        const shellConfigContent = `[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=${currentUser}
Group=${currentUser}
Restart=always
RestartSec=3
Environment="PATH=$PATH"

[Install]
WantedBy=default.target
`;
                        pub.write_file(shellConfigFile, shellConfigContent);
                        pub.exec_shell('systemctl daemon-reload');
                        pub.exec_shell('systemctl enable ollama');
                        pub.exec_shell('systemctl start ollama');
                        checkInstallStatus();
                    } catch (error) {
                        logger.error('Error during Ollama Linux installation:', error);
                        resolve(false);
                    }
                }
            }, 4000);
        });
    }

    /**
     * 结束 Ollama 进程
     * @param {string} shell 要使用的 shell 类型
     */
    private killOllamaProcess(shell: string) {
        try {
            if (pub.is_windows()) {
                execSync('taskkill /F /IM "ollama app.exe"', { shell });
                execSync('taskkill /F /IM "ollama.exe"', { shell });
            } else {
                execSync('pkill -f ollama', { shell });
            }
            logger.info(pub.lang('Ollama 进程已结束。'));
        } catch (killError: any) {
            logger.warn(pub.lang('结束 Ollama 进程时可能未找到进程:'), killError.message);
        }
    }


    private async test_ollama_host(ollamaHost: string): Promise<boolean> {
        try{
            // 尝试从11434端口获取版本信息
            let url = `${ollamaHost}/api/version`;
            let res = await pub.httpRequest(url,{
                timeout: 1000,
                method: 'GET',
                json: true
            });
            
            return res.statusCode === 200

        }catch(e){
            logger.error('Get ollama version error:',e);
            return false
        }
    }


    /**
     * 设置ollama地址和密钥
     * @param {string} ollamaHost - ollama地址
     * @returns {Promise<boolean>} 设置成功返回 true，否则返回 false
     */
    async set_ollama_host(ollamaHost: string): Promise<boolean> {
        if(await this.test_ollama_host(ollamaHost)){
            pub.C('ollama_host', ollamaHost);
            return true;
        }
        return false;
    }
}

// 重写 toString 方法，方便调试和日志输出
OllamaService.toString = () => '[class OllamaService]';
// 创建 OllamaService 实例
const ollamaService = new OllamaService();

// 导出类和实例
export {
    OllamaService,
    ollamaService,
};