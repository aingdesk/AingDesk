import { ElectronEgg } from 'ee-core';
import { Lifecycle } from './preload/lifecycle';
import { preload } from './preload';
import { totalService } from './service/total';
import mcp from './controller/mcp';


// New app
const app = new ElectronEgg();

// Register lifecycle
const life = new Lifecycle();
app.register("ready", life.ready);
app.register("electron-app-ready", life.electronAppReady);
app.register("window-ready", life.windowReady);
app.register("before-close", life.beforeClose);
// Register preload
app.register("preload", preload);


// Register service
setTimeout(() => {
    const {mcpService} = require('./service/mcp');

    // RAG后台任务
    const { RagTask } = require('./rag/rag_task');
    let ragTaskObj = new RagTask()
    ragTaskObj.parseTask()

    // 创建索引
    ragTaskObj.switchToCosineIndex()

    // 同步MCP服务器列表
    mcpService.sync_cloud_mcp()
    
}, 1000);

// 启动统计服务
totalService.start();







// Run
app.run();