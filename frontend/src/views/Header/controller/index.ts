import { getHeaderStoreData } from "../store"
import { getThirdPartyApiStoreData } from "@/views/ThirdPartyApi/store"
import { getSiderStoreData } from "@/views/Sider/store"


/**
 * @description 切换模型
 */
export function changeCurrentModel(model: string, option: any) {
    const { currentModel, modelListShow } = getHeaderStoreData()
    const { currentSupplierName } = getThirdPartyApiStoreData()
    currentModel.value = model
    currentSupplierName.value = option.supplierName
    modelListShow.value = false
}

/**
 * @descript 打开侧边栏
 */
export function doExpand() {
    const { siderWidth, isFold } = getSiderStoreData()
    siderWidth.value = 220
    isFold.value = false
}
