import { nextTick } from 'vue';
import { post } from '@/api';
import Storage from '@/utils/storage';
import { eventBUS } from '@/views/Home/utils/tools';
import { sendLog } from '@/views/Home/controller';
import { message, useDialog, dialog } from '@/utils/naive-tools';
import type { ActiveKnowledgeDto, KnowledgeDocumentInfo, McpServerListDto, CloudMcpServerListDto } from '@/views/Home/dto';
import SoftSettings from '../index.vue';
import { NButton } from 'naive-ui';
import i18n, { setLang } from '@/lang';
import { getSoftSettingsStoreData } from '../store';
import { getMcpServerListForChat } from '@/views/ChatTools/controller';
const $t = i18n.global.t;

/**
 * @description 打开软件设置弹窗
 */
export function openSoftSettings() {
	const { softSettingsShow } = getSoftSettingsStoreData();
	softSettingsShow.value = true;
}

/**
 * @description 关闭软件设置弹窗
 */
export function closeSoftSettings() {
	const { softSettingsShow } = getSoftSettingsStoreData();
	softSettingsShow.value = false;
	resetMcp();
}

/**
 * @description 设置当前语言
 */
export async function setServiceLanguage(language: string) {
	await post('/index/set_language', { language });
}

/**
 * @description 获取用户数据存储位置
 */
export async function getDataSavePath() {
	const { userDataPath } = getSoftSettingsStoreData();
	try {
		const res = await post('/index/get_data_save_path');
		userDataPath.value = res.message.currentPath;
	} catch (error) {
		sendLog(error as Error);
		return false;
	}
}

/***
 * @description 更改数据存储位置
 */
export async function changeDataSavePath() {
	const { changeDataPathShow } = getSoftSettingsStoreData();
	changeDataPathShow.value = true;
}

/**
 * @description 取消更改数据存储位置
 */
export function cancelChangeDataSavePath() {
	const { changeDataPathShow } = getSoftSettingsStoreData();
	changeDataPathShow.value = false;
	getDataSavePath();
}

/**
 * @description 确认更改数据存储位置
 */
export async function confirmChangeDataSavePath() {
	const { changeDataPathShow, userDataPath } = getSoftSettingsStoreData();
	try {
		const res = await post('/index/select_folder');
		changeDataPathShow.value = false;
		if (res.code == 200) {
			userDataPath.value = res.message.folder;
			const path_change_res = await post('/index/set_data_save_path', { newPath: userDataPath.value });
			if (path_change_res.code == 200) {
				changeProgressCheck();
			} else {
				message.error(path_change_res.msg!);
				getDataSavePath();
			}
		}
	} catch (error) {
		sendLog(error as Error);
	}
}

/**
 * @description 数据存储位置进度查询
 */
export async function changeProgressCheck() {
	const { dataPathChangeCheckShow, userDataPath, dataPathChangeStatusValues } = getSoftSettingsStoreData();

	dataPathChangeCheckShow.value = true;
	let timer: any = null;
	timer = setInterval(async () => {
		const res = await post('/index/get_data_save_path');
		userDataPath.value = res.message.currentPath;
		dataPathChangeStatusValues.value = res.message.copyStatus;
		if (dataPathChangeStatusValues.value.status == -1) {
			message.error($t('数据迁移失败，请重试'));
			clearInterval(timer);
			dataPathChangeCheckShow.value = false;
		}

		if (dataPathChangeStatusValues.value.status == 2) {
			message.success($t('数据迁移成功'));
			clearInterval(timer);
			dataPathChangeCheckShow.value = false;
		}
	}, 1000);
}

/**
 * @description 获取当前语言和支持的语言列表
 */
export async function get_languages() {
	const { languageOptions, currentLanguage } = getSoftSettingsStoreData();
	const res = await post('/index/get_languages');
	languageOptions.value = res.message.languages.reduce((p: any, v: any) => {
		return [...p, { label: v.title, value: v.name }];
	}, []);
}

/**
 * @descriiption github相关跳转——星星
 */
export function toStar() {
	window.open('https://github.com/aingdesk/AingDesk');
}

/**
 * @descriiption github相关跳转——issue
 */
export function toIssue() {
	window.open('https://github.com/aingdesk/AingDesk/issues');
}

/**
 * @description 跳转教程
 */
export function jumpToTutorial() {
	window.open('https://docs.aingdesk.com/zh-Hans/');
}

// 新手指引切换
export function guideChange(val: boolean) {
	Storage.welcomeGuide = String(val);
}

/**
 * @description 设置搜索引擎并缓存
 */
export function setSearch(val: string) {
	Storage.searchEngine = val;
}

/**
 * @description 切换主题
 */
export function changeThemeMode(val: string) {
	const { themeMode } = getSoftSettingsStoreData();
	themeMode.value = val;
	Storage.themeMode = val;
	eventBUS.$emit('themeChange', val);
}

/**
 * @description 设置当前语言
 */
export function changeLanguage(val: string) {
	const { currentLanguage } = getSoftSettingsStoreData();
	setLang(val as any);
	currentLanguage.value = val;
	setServiceLanguage(val);
}

/**
 * @description 切换配置项
 */
export function changeSettingTab(tab: string) {
	const { currentSettingTab, settingPanelWidth } = getSoftSettingsStoreData();
	if (tab == 'general') {
		settingPanelWidth.value = 480;
	} else {
		settingPanelWidth.value = 780;
	}
	currentSettingTab.value = tab;
}

/**
 * @description 格式化参数
 * @param {string[]} val 参数值
 * @returns {string} 格式化后的参数值
 */
function formatArgs(val: string[]) {
	if (!Array.isArray(val)) {
		return '';
	}
	return val.join('\n');
}
/**
 * @description 格式化环境变量
 * @param {Record<string, string>} val 环境变量对象
 * @returns {string} 格式化后的环境变量数组
 */
function formatEnv(val: Record<string, string>) {
	return Object.keys(val)
		.map(key => `${key}=${val[key]}`)
		.join('\n');
}
/**
 * @description 恢复参数
 * @param {string} val 参数值
 * @returns {string[]} 恢复后的参数值
 */
function receveArgs(val: string) {
	if (val) {
		return val.split('\n');
	} else {
		return []
	}
}
/**
 * @description 恢复环境变量
 * @param {string} val 环境变量字符串
 * @returns {Record<string, string>} 恢复后的环境变量对象
 */
function receveEnv(val: string) {
	if (val === '') return {};
	if (val.indexOf('\n') > -1) {
		return val.split('\n').reduce((p: any, v: string) => {
			const [key, value] = v.split('=');
			if (key && value) {
				p[key] = value;
			} else if (key) {
				p[key] = ''; // Handle case where there is no '=' or value
			}
			return p;
		}, {});
	} else {
		const [key, value] = val.split('=');
		return { [key]: value };
	}
}
/**
 * @description 检查环境状态
 */
export async function checkEnvStatus() {
	const { envStatus } = getSoftSettingsStoreData();
	try {
		const res = await post('/mcp/get_status');
		envStatus.value = res.message;
	} catch (error) {
		sendLog(error as Error);
	}
}


/**
 * @description MCP服务列表获取(已配置)
 */
export async function getMcpServerList() {
	const { mcpServerList } = getSoftSettingsStoreData();
	try {
		const res = await post('/mcp/get_mcp_server_list');
		mcpServerList.value = res.message.map((item: any) => {
			item.args = formatArgs(item.args);
			item.env = formatEnv(item.env);
			return item;
		});
	} catch (error) {
		sendLog(error as Error);
	}
}
/**
 * @description MCP服务器（模板）
 */
export async function getMcpTempList() {
	const { mcpServerTempList, mcpServerCloud } = getSoftSettingsStoreData();
	mcpServerTempList.value = [];
	try {
		const res = await post('/mcp/get_common_server_list');
		// 列表为空获取一次云端列表，仅首次
		if (Array.isArray(res.message) && res.message.length === 0 && !mcpServerCloud.value) {
			await syncCloudMcp();
			return;
		}
		Object.keys(res.message.mcpServers).forEach(key => {
			const item = res.message.mcpServers[key];
			item.args = formatArgs(item.args);
			item.env = formatEnv(item.env);
			mcpServerTempList.value.push(item);
		});
	} catch (error) {
		sendLog(error as Error);
	}
}
/**
 * @description 检查环境状态
 */

/**
 * @description 同步云端MCP服务器列表（获取列表为空时执行）
 */
export async function syncCloudMcp() {
	const { mcpServerCloud } = getSoftSettingsStoreData();
	try {
		await post('/mcp/sync_cloud_mcp');
		mcpServerCloud.value = true;
		await getMcpTempList();
	} catch (error) {
		sendLog(error as Error);
	}
}

/**
 * @description 重置MCP信息
 */
export function resetMcp() {
	const { currentMcpChoose, currentMcpName, mcpServerFormShow, commadType } = getSoftSettingsStoreData();
	currentMcpChoose.value = {
		name: '',
		description: '',
		type: 'stdio',
		command: 'npx',
		baseUrl: '',
		env: '',
		args: '',
	};
	currentMcpName.value = '';
	mcpServerFormShow.value = false;
	commadType.value = 'npx';
}
/**
 * @description 点击添加服务器
 * @param {object} row 选中行数据
 */
export function handleAddMcp(row: CloudMcpServerListDto) {
	const { mcpServerEditMode, mcpServerFormShow, currentMcpChoose } = getSoftSettingsStoreData();
	currentMcpChoose.value = JSON.parse(JSON.stringify(row));
	mcpServerEditMode.value = false;
	mcpServerFormShow.value = true;
}
/**
 * @description 点击编辑服务器
 * @param {string} name 服务器名称
 */
export async function handleEditMcp(name: string) {
	const { mcpServerEditMode, currentMcpChoose, mcpServerFormShow, currentMcpConfigBackup, currentMcpName, commadType } = getSoftSettingsStoreData();
	mcpServerFormShow.value = true;
	mcpServerEditMode.value = true;
	const { message } = await post('/mcp/get_mcp_server_info', { name });
	currentMcpConfigBackup.value = message;
	currentMcpName.value = name;
	// 截取message.command前三个字符是否等于npx
	commadType.value = message.command.substring(0, 3) === 'npx' ? 'npx' : 'custom';
	message.args = formatArgs(message.args);
	message.env = formatEnv(message.env);
	currentMcpChoose.value = message;
}
/**
 * @description 命令类型切换
 */
export function onChangeCommadType(type: string) {
	const { currentMcpChoose } = getSoftSettingsStoreData();
	currentMcpChoose.value.command = type === 'npx' ? 'npx' : '';
}
/**
 * @description 安装环境
 * @param {string} type 环境类型
 */
export async function installEnv(type: string) {
	const envType = type == 'py' ? 'install_uv' : 'install_npx';
	const { envInstallShow } = getSoftSettingsStoreData();
	envInstallShow.value = true;
	const { code } = await post(`/mcp/${envType}`);
	if (code === 200) {
		message.success($t('环境安装成功'));
		envInstallShow.value = false;
		await checkEnvStatus();
	} else {
		message.error($t('环境安装失败'));
		envInstallShow.value = false;
	}
}
/**
 * 设置当前MCP服务器状态
 * * @param {object} row 选中行数据
 */
export async function handleCurrentMcpStatus() {
	const { currentMcpConfigBackup, currentMcpChoose } = getSoftSettingsStoreData();
	const oldMcpConfig = JSON.parse(JSON.stringify(currentMcpConfigBackup.value));
	if ('isActive' in currentMcpChoose.value) {
		oldMcpConfig.is_active = currentMcpChoose.value.isActive;
	}
	oldMcpConfig.args = receveArgs(oldMcpConfig.args);
	oldMcpConfig.env = receveEnv(oldMcpConfig.env);
	delete oldMcpConfig.isActive;
	const { msg } = await post(`/mcp/modify_mcp_server`, oldMcpConfig);
	message.success(msg || $t('操作成功'));
	await getMcpServerList();
}
/**
 * * @description 添加MCP服务器
 */
export async function handleAddMcpServer() {
	const { envStatus, mcpServerEditMode, currentMcpChoose, createMcpServerRef } = getSoftSettingsStoreData();
	if (envStatus.value.node_npx === 0) return message.error($t('请先安装Node.js环境'));
	await createMcpServerRef.value.validate();
	let _params = JSON.parse(JSON.stringify(currentMcpChoose.value)),
		_api = 'add_mcp_server';
	if (mcpServerEditMode.value) {
		_api = 'modify_mcp_server';
		_params.is_active = _params.isActive
		delete _params.isActive;
	}
	_params.args = receveArgs(_params.args);
	_params.env = receveEnv(_params.env);
	const { msg } = await post(`/mcp/${_api}`, _params);

	message.success(msg || $t('操作成功'));
	await getMcpServerList();
	if (!mcpServerEditMode.value) {
		handleEditMcp(_params.name);
	}

	// 刷新对话框工具选择
	getMcpServerListForChat()
}
/**
 * * @description 卸载MCP服务器
 * @param {string} name 服务器名称
 */
export async function handleDeleteMcpServer(name: string) {
	const { delMcpConfirmShow } = getSoftSettingsStoreData();
	delMcpConfirmShow.value = true;
}

/**
 * @description 取消卸载MCP服务器
 */
export function cancelDeleteMcpServer() {
	const { delMcpConfirmShow } = getSoftSettingsStoreData();
	delMcpConfirmShow.value = false;
}

/**
 * @description 确认删除MCP服务器
 */
export async function confirmDeleteMcpServer() {
	const { mcpServerFormShow, mcpServerEditMode, delMcpConfirmShow, currentMcpName } = getSoftSettingsStoreData();
	const res = await post('/mcp/remove_mcp_server', { name: currentMcpName.value });
	if (res.code == 200) {
		message.success($t('操作成功'));
		mcpServerFormShow.value = false;
		mcpServerEditMode.value = false;
		// 刷新对话框工具选择
		getMcpServerListForChat()
	} else {
		message.error(res.msg!);
	}
	await getMcpServerList();
	delMcpConfirmShow.value = false;
}

/**
 * * @description 打开MCP配置文件
 */
export async function openMcpConfigFile() {
	const { mcpConfigFileShow, mcpConfigFileContent } = getSoftSettingsStoreData();
	mcpConfigFileShow.value = true;
	try {
		const res = await post('/mcp/get_mcp_config_body');
		mcpConfigFileContent.value = res.message.mcp_config_body;
	} catch (error) {
		sendLog(error as Error);
	}
}

/**
 * * @description 保存MCP配置文件
 * @param {Record<string,string>} obj 配置文件内容
 */
export async function saveMcpConfigFile(obj: Record<string, string>) {
	const { mcpConfigFileShow } = getSoftSettingsStoreData();
	const res = await post('/mcp/save_mcp_config_body', obj);
	if (res.code == 200) {
		message.success($t('操作成功'));
		mcpConfigFileShow.value = false;
	} else {
		message.error(res.msg!);
	}
}
