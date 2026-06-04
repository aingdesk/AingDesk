/**
 * ee-bin 配置
 * 仅适用于开发环境
 */
module.exports = {
  /**
   * development serve ("frontend" "electron" )
   * ee-bin dev
   */
  dev: {
    frontend: {
      directory: './frontend',
      cmd: 'npm',
      args: ['run', 'dev'],
      port: 5173,
    },
    electron: {
      directory: './',
      cmd: 'electron',
      args: ['.', '--env=local'],
      watch: true,
      delay: 1000,
    }
  },

  /**
   * 构建
   * ee-bin build
   */
  build: {
    frontend: {
      directory: './frontend',
      cmd: 'npm',
      args: ['run', 'build'],
    },
    electron: {
      type: 'typescript',
    },
    win64: {
      cmd: 'electron-builder',
      directory: './',
      args: ['--config=./cmd/builder.json', '-w=nsis', '--x64'],
    },
    win32: {
      args: ['--config=./cmd/builder.json', '-w=nsis', '--ia32'],
    },
    win_e: {
      args: ['--config=./cmd/builder.json', '-w=portable', '--x64'],
    },
    win_7z: {
      args: ['--config=./cmd/builder.json', '-w=7z', '--x64'],
    },
    mac_arm64: {
      args: ['--config=./cmd/builder-mac-arm64.json', '-m', '--arm64'],
    },
    linux: {
      args: ['--config=./cmd/builder-linux.json', '-l=deb', '--x64'],
    },
    linux_arm64: {
      args: ['--config=./cmd/builder-linux.json', '-l=deb', '--arm64'],
    },
    go_w: {
      directory: './go',
      cmd: 'go',
      args: ['build', '-o=../build/extraResources/goapp.exe'],
    },
    go_m: {
      directory: './go',
      cmd: 'go',
      args: ['build', '-o=../build/extraResources/goapp'],
    },
    go_l: {
      directory: './go',
      cmd: 'go',
      args: ['build', '-o=../build/extraResources/goapp'],
    },
    python: {
      directory: './python',
      cmd: 'python',
      args: ['./setup.py', 'build'],
    },
  },

  /**
   * 移动资源
   * ee-bin move 
   */
  move: {
    frontend_dist: {
      src: './frontend/dist',
      dest: './public/dist'
    },
    go_static: {
      src: './frontend/dist',
      dest: './go/public/dist'
    },
    go_config: {
      src: './go/config',
      dest: './go/public/config'
    },
    go_package: {
      src: './package.json',
      dest: './go/public/package.json'
    },
    go_images: {
      src: './public/images',
      dest: './go/public/images'
    },
    python_dist: {
      src: './python/dist',
      dest: './build/extraResources/py'
    },
  },  

  /**
   * 预发布模式（prod）
   * ee-bin start
   */
  start: {
    directory: './',
    cmd: 'electron',
    args: ['.', '--env=prod']
  },

  /**
   * 加密
   */  
  encrypt: {
    frontend: {
      type: 'none',
      files: [
        './public/dist/**/*.(js|json)',
      ],
      cleanFiles: ['./public/dist'],
      confusionOptions: {
        compact: true,      
        stringArray: true,
        stringArrayEncoding: ['none'],
        stringArrayCallsTransform: true,
        numbersToExpressions: true,
        target: 'browser',
      }
    },
    electron: {
      type: 'confusion',
      files: [
        './public/electron/**/*.(js|json)',
      ],
      cleanFiles: ['./public/electron'],
      specificFiles: [
        './public/electron/main.js',
        './public/electron/preload/bridge.js',
      ],
      confusionOptions: {
        compact: true,      
        stringArray: true,
        stringArrayEncoding: ['rc4'],
        deadCodeInjection: false,
        stringArrayCallsTransform: true,
        numbersToExpressions: true,
        target: 'node',
      }
    }
  },

  /**
   * 执行自定义命令
   * ee-bin exec
   */
  exec: {
    // 单独调试，air 实现 go 热重载
    go: {
      directory: './go',
      cmd: 'air',
      args: ['-c=config/.air.toml' ],
    },
    // windows 单独调试，air 实现 go 热重载 
    go_w: {
      directory: './go',
      cmd: 'air',
      args: ['-c=config/.air.windows.toml' ],
    },    
    // 单独调试，以基础方式启动 go
    go2: {
      directory: './go',
      cmd: 'go',
      args: ['run', './main.go', '--env=dev','--basedir=../', '--port=7073'],
    },     
    python: {
      directory: './python',
      cmd: 'python',
      args: ['./main.py', '--port=7074'],
      stdio: "inherit", // ignore
    },
  },  
};