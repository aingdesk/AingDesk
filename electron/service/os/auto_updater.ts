import { app as electronApp } from 'electron';
import { autoUpdater } from 'electron-updater';
import { is } from 'ee-core/utils';
import { logger } from 'ee-core/log';
import { pub } from '../../class/public';
import { getMainWindow, setCloseAndQuit } from 'ee-core/electron';

/**
 * AutoUpdaterService class for automatic updates
 */
class AutoUpdaterService {
    private config: {
        windows: boolean;
        macOS: boolean;
        linux: boolean;
        options: any;
        force: boolean;
    };
    constructor() {
        this.config = {
            windows: true,
            macOS: true,
            linux: true,
            options: {
                provider: 'github',
                owner: 'aingdesk',
                repo: 'aingdesk'
            },
            force: true,
        }
    }

    create() {
        logger.info('[autoUpdater] load');
        const cfg = this.config;
        if ((is.windows() && cfg.windows)
            || (is.macOS() && cfg.macOS)
            || (is.linux() && cfg.linux)) {
            // continue
        } else {
            return
        }

        // 是否检查更新
        if (cfg.force) {
            this.checkUpdate();
        }

        const status = {
            error: -1,
            available: 1,
            noAvailable: 2,
            downloading: 3,
            downloaded: 4,
        }

        const version = electronApp.getVersion();
        logger.info('[autoUpdater] current version: ', version);

        // 更新源：GitHub Releases(aingdesk/aingdesk)
        logger.info('[autoUpdater] provider: ', cfg.options.provider);

        // 强制执行开发更新
        autoUpdater.forceDevUpdateConfig = true

        // 是否后台自动下载
        autoUpdater.autoDownload = cfg.force ? true : false;

        try {
            autoUpdater.setFeedURL(cfg.options);
        } catch (error) {
            logger.error('[autoUpdater] setFeedURL error : ', error);
        }

        autoUpdater.on('checking-for-update', () => {
            this.sendStatusToWindow(pub.lang('正在检查更新...'));
        })
        autoUpdater.on('update-available', (info) => {
            this.sendStatusToWindow(info);
        })
        autoUpdater.on('update-not-available', (info) => {
            this.sendStatusToWindow(info);
        })
        autoUpdater.on('error', (err) => {
            let info = {
                status: status.error,
                desc: err
            }
            this.sendStatusToWindow(info);
        })
        autoUpdater.on('download-progress', (progressObj) => {
            let percentNumber = progressObj.percent;
            let totalSize = this.bytesChange(progressObj.total);
            let transferredSize = this.bytesChange(progressObj.transferred);
            let text = pub.lang('已下载 ') + percentNumber + '%';
            text = text + ' (' + transferredSize + "/" + totalSize + ')';

            let info = {
                status: status.downloading,
                desc: text,
                percentNumber: percentNumber,
                totalSize: totalSize,
                transferredSize: transferredSize
            }
            logger.info('[addon:autoUpdater] progress: ', text);
            this.sendStatusToWindow(info);
        })
        autoUpdater.on('update-downloaded', (info) => {
            this.sendStatusToWindow(info);
            setCloseAndQuit(true);
            autoUpdater.quitAndInstall();
        });
    }

    /**
     * 检查更新
     */
    checkUpdate() {
        autoUpdater.checkForUpdates();
    }

    /**
     * 下载更新
     */
    download() {
        autoUpdater.downloadUpdate();
    }

    /**
     * 向前端发消息
     */
    sendStatusToWindow(content: any = {}): void {
        const textJson = JSON.stringify(content);
        const channel = 'custom/app/updater';
        const win = getMainWindow();
        logger.info('[addon:autoUpdater] sendStatusToWindow: ', textJson);
        win.webContents.send(channel, textJson);
    }
    /**
     * 单位转换
     */
    bytesChange(limit) {
        let size = "";
        if (limit < 0.1 * 1024) {
            size = limit.toFixed(2) + "B";
        } else if (limit < 0.1 * 1024 * 1024) {
            size = (limit / 1024).toFixed(2) + "KB";
        } else if (limit < 0.1 * 1024 * 1024 * 1024) {
            size = (limit / (1024 * 1024)).toFixed(2) + "MB";
        } else {
            size = (limit / (1024 * 1024 * 1024)).toFixed(2) + "GB";
        }

        let sizeStr = size + "";
        let index = sizeStr.indexOf(".");
        let dou = sizeStr.substring(index + 1, index + 3);
        if (dou == "00") {
            return sizeStr.substring(0, index) + sizeStr.substring(index + 3, index + 5);
        }

        return size;
    }
}
AutoUpdaterService.toString = () => '[class AutoUpdaterService]';
const autoUpdaterService = new AutoUpdaterService();

export {
    AutoUpdaterService,
    autoUpdaterService
};