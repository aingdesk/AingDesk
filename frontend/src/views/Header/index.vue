<template>
    <div class="header-wrapper" v-if="!activeKnowledge || (siderWidth == 0 && knowledgeSiderWidth == 0)">
        <div class="comunication-tit flex justify-between items-center">
            <div class="flex items-center">
                <i class="i-common:expand w-18 h-18 mr-10 cursor-pointer" v-if="isFold" @click="doExpand"></i>
            </div>

            <!-- 选择模型 -->
            <ChooseModel v-model="currentModel" v-model:supplier="currentSupplierName"
                @addModelChoose="addModelChoose" />
        </div>
    </div>


</template>

<script lang="tsx" setup>
import ChooseModel from "./components/ChooseModel.vue";
import { get_model_list, } from "@/views/Settings/controller"
import { doExpand } from "@/views/Header/controller"
import { useI18n } from "vue-i18n";
import { getHeaderStoreData } from "./store";
import { getSiderStoreData } from "../Sider/store";
import { getKnowledgeStoreData } from "../KnowleadgeStore/store";
import { getThirdPartyApiStoreData } from "../ThirdPartyApi/store";
import { getChatToolsStoreData } from "../ChatTools/store";
import { getRandomStringFromSet } from "@/utils/tools";

const { t: $t } = useI18n()

const { currentModel, multipleModelList } = getHeaderStoreData()
const { isFold, siderWidth, } = getSiderStoreData()
const { activeKnowledge, knowledgeSiderWidth, } = getKnowledgeStoreData()
const { currentSupplierName } = getThirdPartyApiStoreData()
const { compare_id } = getChatToolsStoreData()

/**
 * @description 获取模型列表
 */
get_model_list()

/**
 * @description 添加模型选择器
 */
function addModelChoose() {
    multipleModelList.value.push({
        model: "",
        supplierName: ""
    })
    compare_id.value = getRandomStringFromSet(16)
}


</script>

<style lang="scss" scoped>
@use "@/assets/base.scss";

.header-wrapper {
    height: 65px;
    display: flex;
    align-items: center;
    justify-content: space-between;



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