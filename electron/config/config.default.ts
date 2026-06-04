import path from 'path';
import { getBaseDir } from 'ee-core/ps';
import { type AppConfig } from 'ee-core/config';

const config: () => AppConfig = () => {
  return {
    openDevTools: false,
    singleLock: true,
    windowsOption: {
      title: 'AingDesk',
      width: 1440,
      height: 900,
      minWidth: 500,
      minHeight: 300,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
      },
      frame: true,
      show: true,
      icon: path.join(getBaseDir(), 'public', 'images', 'logo-32.png'),
    },
    logger: {
      level: 'INFO',
      outputJSON: false,
      appLogName: 'ee.log',
      coreLogName: 'ee-core.log',
      errorLogName: 'ee-error.log',
    },
    remote: {
      enable: false,
      url: 'about:blank',
    },
    socketServer: {
      enable: true,
      port: 7070,
      path: "/socket.io/",
      connectTimeout: 45000,
      pingTimeout: 30000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e8,
      transports: ["polling", "websocket"],
      cors: {
        origin: true,
      },
      channel: 'socket-channel',
    },
    httpServer: {
      enable: true,
      https: {
        enable: false,
        key: '/public/ssl/localhost+1.key',
        cert: '/public/ssl/localhost+1.pem',
      },
      host: '127.0.0.1',
      port: 7071,
    },
    mainServer: {
      indexPath: '/public/dist/index.html',
    },
    loadUrl: {
      // 开发环境
      dev: `file://${path.join(__dirname, '../public/dist/index.html')}`,
      // 生产环境
      prod: `file://${path.join(__dirname, '../public/dist/index.html')}`
    }
  };
};

export default config;