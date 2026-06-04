import type { CurrentModelDto, MultipleModelListDto } from "@/views/Home/dto";
import { getThirdPartyApiStoreData } from "@/views/ThirdPartyApi/store";
import { defineStore, storeToRefs } from "pinia";
import { ref } from "vue";

const useHeaderStore = defineStore("headerStore", () => {
  // 已安裝模型列表-计算后
  const modelList = ref<any>([])
  // 已安装模型列表-计算前
  const modelListSource = ref<any>([])
  // 当前模型实体
  const currentModelDto = ref<CurrentModelDto | null>()
  // 当前使用的模型
  const currentModel = ref("")
  // 标题
  const title = ref("")
  // 选择的知识库
  const knowledges = ref([])
  // 选择模型弹窗
  const chooseModelVisible = ref(true)
  // 模型列表过滤关键字
  const modelListFilterKey = ref("")
  // 模型列表展示
  const modelListShow = ref(false)
  // 计算：从modelList中找出currentModel对应的label
  const showModel = computed(() => {
    const { currentSupplierName } = getThirdPartyApiStoreData()
    return modelList.value.find((item: any) => (item.value === currentModel.value && item.supplierName == currentSupplierName.value))?.label
  })
  // 计算：根据过滤条件生成展示模型列表
  const showModelList = computed(() => {
    const newList: any = {};
    for (const key in modelListSource.value) {
      if (key !== "commonModelList") {
        if (modelListFilterKey.value) {
          newList[key] = modelListSource.value[key].filter((item: any) => item.model.includes(modelListFilterKey.value.toLowerCase()));
        } else {
          newList[key] = modelListSource.value[key];
        }
      }
    }
    return newList;
  })

  // 多模型的对象列表
  const multipleModelList = ref<MultipleModelListDto[]>([])
  return {
    modelList,
    currentModelDto,
    currentModel,
    title,
    knowledges,
    chooseModelVisible,
    modelListSource,
    modelListFilterKey,
    showModel,
    showModelList,
    modelListShow,
    multipleModelList
  }
})

export function getHeaderStoreData() {
  return storeToRefs(useHeaderStore())
}