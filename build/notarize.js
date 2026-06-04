// macOS 公证(notarization) afterSign 钩子
//
// 在 electron-builder 完成代码签名后自动公证 .app。
// 仅当设置了 Apple 凭证环境变量时才执行；否则直接跳过，
// 这样 CI / 没有 Apple 凭证的贡献者本地构建不会因公证失败而中断。
//
// 需要的环境变量(Apple ID 方式)：
//   APPLE_ID                    你的 Apple ID(邮箱)
//   APPLE_APP_SPECIFIC_PASSWORD App 专用密码(appleid.apple.com 生成，非登录密码)
//   APPLE_TEAM_ID               开发者团队 ID(10 位)
//
// 配合签名使用(electron-builder 读取)：
//   CSC_LINK / CSC_KEY_PASSWORD 指向 Developer ID Application 证书(.p12)

const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log('[notarize] 跳过公证：未设置 APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;
  console.log(`[notarize] 开始公证 ${appPath} ...`);

  await notarize({
    tool: 'notarytool',
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });

  console.log('[notarize] 公证完成(已 staple)');
};
