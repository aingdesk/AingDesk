<template>
    <div class="settings-wrapper">
        <n-list>
            <n-list-item>
                <div class="theme-setting w-100%">
                    <div class="flex-between">
                        <span>{{ $t("新手指引") }} </span>
                        <n-switch size="small" active-color="#000" v-model:value="guideActive"
                            @update:value="guideChange"></n-switch>
                    </div>
                </div>
            </n-list-item>
            <n-list-item>
                <div class="theme-setting w-100%">
                    <div class="flex-between">
                        <span>{{ themeMode == 'light' ? $t("浅色模式") : $t("深色模式") }} </span>
                        <n-switch size="small" active-color="#000" checked-value="dark" unchecked-value="light"
                            v-model:value="themeMode" :on-update:value="changeThemeMode"></n-switch>
                    </div>
                </div>
            </n-list-item>
            <n-list-item>
                <div class="theme-setting w-100%">
                    <div class="flex-between">
                        <span>{{ $t("数据存储位置") }} </span>
                        <div>
                            <n-input-group>
                                <n-input :value="userDataPath"></n-input>
                                <n-button @click="changeDataSavePath">{{ $t("更改") }}</n-button>
                            </n-input-group>
                        </div>
                    </div>
                </div>
            </n-list-item>
            <n-list-item>
                <div class="language-setting w-100% flex-between">
                    <span>{{ $t("语言选择") }} </span>
                    <n-select :options="languageOptions" v-model:value="currentLanguage"
                        :on-update:value="changeLanguage" style="width:120px"></n-select>
                </div>
            </n-list-item>
            <n-list-item>
                <div class="search-through-net flex-between">
                    <div>
                        {{ $t("默认搜索引擎") }}
                    </div>
                    <n-select :options='[
                        { label: $t("百度"), value: "baidu" },
                        { label: $t("搜狗"), value: "sogou" },
                        { label: $t("360搜索"), value: "360" },
                        { label: "Bocha", value: "bocha" },
                    ]' style="width:120px" v-model:value="targetNet" @update:value="setSearch" />
                </div>
            </n-list-item>
            <n-list-item>
                <div class="flex justify-between items-center">
                    <span>Github</span>
                    <n-button-group>
                        <n-button @click="toStar">
                            <template #icon>
                                <i class="i-common:star w-20 h-20"></i>
                            </template>
                            star
                        </n-button>

                        <n-button @click="toIssue">
                            <template #icon>
                                <i class="i-common:issues w-20 h-20"></i>
                            </template>
                            {{ $t("反馈") }}
                        </n-button>
                    </n-button-group>
                </div>
            </n-list-item>
            <n-list-item>
                <div class="flex justify-center flex-col items-center gap-2.5">
                    <span>{{ $t("加入AingDesk交流群") }}</span>
                    <n-image :src="wechat" width="100px" />
                </div>
            </n-list-item>
            <n-list-item>
                <div class="flex justify-center gap-2.5 text-[#5c5c5c]">
                    <span>{{ $t("当前版本") }}: v{{ version }}</span>
                    <span @click="jumpToTutorial" class="underline text-green-6 cursor-pointer">{{ $t("文档教程") }}</span>
                </div>
            </n-list-item>
        </n-list>
    </div>

</template>

<script setup lang="ts">
import { getSoftSettingsStoreData } from "../store";
import { getChatContentStoreData } from "../../ChatContent/store";

import {
    getDataSavePath,
    jumpToTutorial,
    changeDataSavePath,
    toStar,
    toIssue,
    guideChange,
    setSearch,
    changeThemeMode,
    changeLanguage
} from "@/views/SoftSettings/controller"
import i18n from "@/lang";
import wechat from "@/assets/images/wechat.png"
const $t = i18n.global.t
const {
    themeMode,
    languageOptions,
    currentLanguage,
    targetNet,
    version,
    userDataPath,
} = getSoftSettingsStoreData()
const {
    guideActive,
} = getChatContentStoreData()

// 获取用户数据存储路径
getDataSavePath()

</script>

<style scoped lang="scss">
@use "@/assets/base";

.flex-between {
    width: 100%;
    @include base.row-flex-between;
}

.settings-wrapper {


    .theme-setting {}
}
</style>
