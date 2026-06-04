<template>
    <div class="content-wrapper" ref="contentWrapper" v-if="!activeKnowledge">
        <!-- 多模型对话 -->
        <div id="test">
            <n-card class="multiple-model-list" segmented v-if="multipleModelList.length > 0">
                <n-collapse arrow-placement="right" :default-expanded-names="['model-list']">
                    <n-collapse-item :title='$t("多模型对话")' name="model-list">
                        <template v-for="(item, index) in multipleModelList" :key="index">
                            <div class="multiple-model-item">
                                <ChooseModel v-model="item.model" v-model:supplier="item.supplierName" :has-minus="true"
                                    :has-plus="false" @removeModelChoose="removeModelChoose(index)" />
                            </div>
                        </template>
                    </n-collapse-item>
                </n-collapse>
            </n-card>
        </div>
        <div class="chat-window" @mouseleave="mouseLeave" ref="questionAndAnswer">
            <n-scrollbar style="height:100%;padding:0 var(--bt-pd-small)" :style="{ height: questionAndAnswerHeight }"
                ref="scrollRef" content-style="overflow: hidden;" :on-scroll="scrollCallback" id="scroll-bar">
                <!-- 新对话默认展示内容 -->
                <ChatWelcome />

                <template v-for="[key, chatContent] in chatHistory" :key="key">
                    <div style="width:100%;">
                        <!-- 提问 -->
                        <Question :question-content="key" />
                        <!-- 此处判断不对，chatContent不是数组 -->
                        <div style="width:100%;margin-bottom: 30px;" v-if="Array.isArray(chatContent.content)">
                            <n-scrollbar x-scrollable :style="{ width: answerListWidth }">
                                <div class="answer-wrapper">  
                                    <n-card style="min-width:300px;height: 100%;" v-for="(_item, _index) in chatContent.content" :key="_index">
                                        <Answer :question-content="key"
                                            :answer-content="{ content: chatContent.content[_index], id: chatContent.id, stat: (chatContent.stat! as any)[_index], search_result: chatContent.search_result, tools_result: chatContent.tools_result }"
                                            />
                                    </n-card>
                                </div>
                            </n-scrollbar>
                        </div>
                        <Answer :question-content="key" :answer-content="chatContent" v-else />
                    </div>
                </template>
            </n-scrollbar>
        </div>
    </div>
    <!-- 对话工具栏 -->
    <ChatTools />
    <!-- 模型管理弹窗 -->
    <Settings />

    <!-- 文档预览 -->
    <div class="doc-content" v-if="activeKnowledge">
        <n-scrollbar>
            <MarkdownRender :content="docContent" />
        </n-scrollbar>
    </div>
</template>

<script setup lang="tsx">
import ChooseModel from '../Header/components/ChooseModel.vue';
import ChatWelcome from '@/views/ChatWelcome/index.vue';
import Question from "@/views/Question/index.vue"
import Answer from "@/views/Answer/index.vue"
import ChatTools from "@/views/ChatTools/index.vue"
import { getChatContentStoreData } from './store';
import { getKnowledgeStoreData } from '../KnowleadgeStore/store';
import { mouseLeave, scrollCallback, scrollMove } from "@/views/ChatContent/controller"

// 附件图标
import MarkdownRender from "@/views/Answer/components/MarkdownRender.vue"
import Settings from '@/views/Settings/index.vue';
import { eventBUS } from '@/views/Home/utils/tools';
import { getHeaderStoreData } from '../Header/store';
import { getChatToolsStoreData } from '../ChatTools/store';
const moveFn = scrollMove()
const questionAndAnswer = ref<any>("100%")
const answerListWidth = ref("100%")
const { chatHistory, scrollRef, contentWrapper } = getChatContentStoreData()
const { activeKnowledge, docContent, } = getKnowledgeStoreData()
const { multipleModelList } = getHeaderStoreData()
const { compare_id } = getChatToolsStoreData()
const questionAndAnswerHeight = ref("100%")
// 监听滚动
eventBUS.$on("doScroll", () => moveFn(100))
onMounted(() => {
    const chatWindowDom = document.querySelector(".chat-window") as HTMLDivElement
    const contentWrapperDom = contentWrapper.value as HTMLDivElement
    answerListWidth.value = chatWindowDom.clientWidth + "px"
    window.onresize = () => {
        answerListWidth.value = chatWindowDom.clientWidth + "px"
    }
})

/**
 * @description 删除模型选择器
 */
function removeModelChoose(index: number) {
    multipleModelList.value.splice(index, 1)
    if (multipleModelList.value.length === 0) {
        compare_id.value = ""
    }
}

/**
 * @description 监听chat-window的高度，设置内部滚动高度
 */
onMounted(() => {
    /**
     * @description 防抖
     */
    function debounce(wait: number) {
        let timeout: any = null;
        return function (height: number) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                questionAndAnswerHeight.value = height - 10 + "px"
            }, wait);
        }
    }
    const debounceFn = debounce(1)
    const chatWindowDom = document.querySelector(".chat-window") as HTMLDivElement
    const observer = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { height } = entry.contentRect;
            debounceFn(height)
        }
    });
    observer.observe(chatWindowDom);
})


</script>

<style scoped lang="scss">
@use "@/assets/base";


.content-wrapper {
    display: grid;
    grid-template-rows: auto 1fr;
    row-gap: 20px;
    width: 100%;
    height: calc(100% - 170px);

    .chat-window {
        width: calc(100% - 80px);
        margin: var(--bt-mg-large) auto 0;
        position: relative;


        .question-edit {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: var(--bt-pd-small);
            margin: var(--bt-mg-normal) 10px var(--bt-mg-normal) 0;

            .operation-btns {
                display: flex;
                justify-content: flex-end;
                gap: var(--bt-pd-small);
            }
        }

    }


}

.answer-wrapper {
    @include base.row-flex-between;
    justify-content: flex-start;
    align-items: stretch;
    width: 100%;
    overflow-x: hidden;
}


.doc-content {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 20px;
}




// 多模型选择面板
.multiple-model-list {
    width: 100%;
    height: auto;
    background-color: base.$gray-1;
    z-index: 1000;
    // box-sizing: border-box;
    // padding: 20px;
    border-left: none;
    border-right: none;

    .multiple-model-item {
        margin-bottom: 10px;
    }
}
</style>