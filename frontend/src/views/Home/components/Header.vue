<template>
    <div class="header-wrapper" v-if="!activeKnowledge || (siderWidth == 0 && knowledgeSiderWidth == 0)">
        <div class="comunication-tit flex justify-between items-center">
            <div class="flex items-center">
                <i class="i-common:expand w-18 h-18 mr-10 cursor-pointer" v-if="isFold" @click="doExpand"></i>
            </div>
            <!-- modelList -->
            <div class="flex justify-start items-center gap-2.5">
                <span class="text-14px min-w-40px inline-block">{{ $t("模型") }}:</span>
                <NDropdown trigger="hover" :options="modelList" @select="changeCurrentModel" key-field="value"
                    label-field="label" class="model-list-drop" scrollable>
                    <NButton icon-placement="right">
                        {{ showModel?showModel:$t("请选择或安装接入模型") }}
                        <template #icon>
                            <i class="i-carbon:caret-down ml-5 "></i>
                        </template>
                    </NButton>
                </NDropdown>
                <!-- <NSelect :options="modelList" class="min-w-300px" v-model:value="currentModel" :placeholder="$t('请选择或安装接入模型')" key-field="value" label-field="title"></NSelect> -->
                <!-- <div v-if="!showModel" class="text-[var(--bt-notice-text-color)] text-14px">
                    <span v-if="modelList.length == 0">{{ $t("请选择或安装接入模型") }}</span>
                </div> -->
            </div>
        </div>
        <div class="right-tools">
            <NButton type="success" @click="shareShow = true" >
                <template #icon><i class="i-common:share w-16 h-16"></i></template>
                {{ $t("分享") }}
            </NButton>
        </div>
    </div>
</template>

<script lang="tsx" setup>
import { NButton, NDropdown, NSelect } from "naive-ui";
import { get_model_list, setServiceLanguage, createShare } from "../controller";
import useIndexStore from "../store";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { computed, watch } from "vue";
import { eventBUS } from "../utils/tools";

const { t: $t } = useI18n()
const indexStore = useIndexStore()
const {
    modelList,
    currentModel,
    isFold,
    siderWidth,
    currentChatTitle,
    languageOptions,
    currentLanguage,
    shareShow,
    activeKnowledge,
    currentSupplierName,
    knowledgeSiderWidth,
    chatMask
} = storeToRefs(indexStore)



/**
 * @description 获取模型列表
 */
get_model_list()

/**
 * @descript 打开侧边栏
 */
function doExpand() {
    siderWidth.value = 220
    isFold.value = false
}

/**
 * @description 从modelList中找出currentModel对应的label
 */
const showModel = computed(() => {
    return modelList.value.find((item: any) => (item.value === currentModel.value && item.supplierName == currentSupplierName.value))?.label
})

watch(showModel, (val) => {
    if (val) {
        chatMask.value = {
            status: false,
            notice: ""
        }
    } else {
        chatMask.value = {
            status: true,
            notice: $t("当前对话使用的模型已被禁用或删除，请重新启用或切换模型", [currentModel.value])
        }
    }
}, { immediate: true })

/**
 * @description 切换模型
 */
function changeCurrentModel(model: string, option: any) {
    currentModel.value = model
    currentSupplierName.value = option.supplierName
}



</script>

<style lang="scss">
.header-wrapper {
    height: 65px;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .comunication-tit {
        font-size: 18px;
        // font-weight: bold;
    }

    .right-tools {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        // min-width: 360px;
    }
}

.model-list-drop {
    max-height: 300px;
}
</style>