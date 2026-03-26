<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
import {
    NButton,
    NIcon,
    NDropdown,
    NTag,
} from 'naive-ui';
import { Add } from '@vicons/carbon';
import { useWebCutLibrary } from '../../../hooks/library';
import { useWebCutPlayer } from '../../../hooks';
import { useWebCutHistory } from '../../../hooks/history';
import { useWebCutContext } from '../../../hooks';
import { useT } from '../../../i18n/hooks';
import { WebCutMaterial, WebCutThingType, WebCutMaterialType } from '../../../types';

const fileList = defineModel<WebCutMaterial[]>('files', { default: [] });
const emit = defineEmits(['added', 'deleted', 'leaveItem', 'enterItem', 'clickItem']);
const props = defineProps<{
    thingType: WebCutThingType;
    materialType: WebCutMaterialType;
    disableContextMenu?: boolean;
    /** 是否开启添加素材时，如果当前项目没有选中素材，则自动添加到当前项目素材列表中 */
    enableAddToProject?: boolean;
    /** 是否开启多选模式 */
    enableMultipleSelect?: boolean;
}>();

const t = useT();

const { push, pushSeries } = useWebCutPlayer();
const { removeFile, addExistingFileToProject } = useWebCutLibrary();
const { push: pushHistory } = useWebCutHistory();
const { id: projectId, cursorTime, rails } = useWebCutContext();

// 右键菜单相关状态
const showDropdown = ref(false);
const x = ref(0);
const y = ref(0);
const currentFile = ref<any>(null);

// 多选相关状态
const selectedFiles = ref<Map<string, number>>(new Map()); // 存储选中文件ID和选择顺序
const isMultiSelectMode = ref(false); // 是否处于多选模式
const previewShapeMap = ref<Record<string, string>>({});

// 右键菜单选项
const options = computed(() => [
    {
        label: t('删除'),
        key: 'delete'
    }
]);

// 处理右键菜单点击
function handleContextMenu(e: MouseEvent, file: any) {
    e.preventDefault();
    if (props.disableContextMenu) {
        return;
    }

    showDropdown.value = false;
    currentFile.value = file;
    nextTick().then(() => {
        showDropdown.value = true;
        x.value = e.clientX;
        y.value = e.clientY;
    });
}

// 处理菜单项选择
function handleSelect(key: string | number) {
    showDropdown.value = false;
    if (key === 'delete' && currentFile.value) {
        removeFile(currentFile.value.id);
        emit('deleted', currentFile.value);
    }
}

// 点击外部关闭菜单
function onClickoutside() {
    showDropdown.value = false;
}

// 处理文件点击 - 支持多选模式
function handleFileClick(file: any, event: MouseEvent) {
    // 多选模式下不触发 clickItem 事件，避免外部执行不必要的逻辑
    if (!isMultiSelectMode.value) {
        emit('clickItem', file);
        return; // 非多选模式下只触发clickItem事件，不执行添加操作
    }

    // 如果按住Command/Ctrl键，进入多选模式
    if (event.metaKey || event.ctrlKey) {
        isMultiSelectMode.value = true;
        toggleFileSelection(file);
        // 阻止默认行为，避免立即添加
        event.preventDefault();
        return;
    }

    // 多选模式下只处理选中状态，不执行添加
    if (isMultiSelectMode.value) {
        toggleFileSelection(file);
        return;
    }
}

// 切换文件选中状态
function toggleFileSelection(file: any, event?: Event) {
    // 如果是复选框的change事件，不需要额外处理，直接切换选中状态
    if (event && event.type === 'change') {
        const fileId = file.id;
        if (selectedFiles.value.has(fileId)) {
            selectedFiles.value.delete(fileId);
        } else {
            // 添加到选中列表，记录选择顺序
            const order = selectedFiles.value.size + 1;
            selectedFiles.value.set(fileId, order);
        }
    } else {
        // 其他情况（如直接调用）的原有逻辑
        const fileId = file.id;
        if (selectedFiles.value.has(fileId)) {
            selectedFiles.value.delete(fileId);
        } else {
            // 添加到选中列表，记录选择顺序
            const order = selectedFiles.value.size + 1;
            selectedFiles.value.set(fileId, order);
        }
    }
}

// 批量添加选中的文件
async function handleBatchAdd() {
    if (selectedFiles.value.size === 0) return;

    try {
        // 按选择顺序排序文件
        const sortedFiles = Array.from(selectedFiles.value.entries())
            .sort((a, b) => a[1] - b[1])
            .map(([fileId]) => fileList.value.find(file => file.id === fileId))
            .filter((file): file is WebCutMaterial => Boolean(file));

        // 如果启用了添加到项目功能，则先添加到项目
        if (props.enableAddToProject && projectId.value) {
            for (const material of sortedFiles) {
                await addExistingFileToProject(material.id);
            }
        }

        // 使用 pushSeries 批量添加素材
        await pushSeries(
            sortedFiles.map(material => ({
                type: props.materialType,
                source: `file:${material.id}`,
            })),
            {
                startTime: getPreferredInsertStartTime(),
                thingType: props.thingType,
            }
        );

        // 触发 added 事件
        for (const material of sortedFiles) {
            emit('added', material);
        }

        // 保存历史记录
        await pushHistory();

        // 清空选中状态
        selectedFiles.value.clear();
        isMultiSelectMode.value = false;
    }
    catch (e) {
        console.error(e);
    }
}

// 单个文件添加（保留原有功能）
async function handleAdd(material: any) {
    try {
        const { id } = material;

        // 如果启用了添加到项目功能，则先添加到项目
        if (props.enableAddToProject && projectId.value) {
            await addExistingFileToProject(id);
        }

        await push(props.materialType, `file:${id}`, {
            time: {
                start: getPreferredInsertStartTime(),
            },
            thingType: props.thingType,
        });
        await pushHistory();
        emit('added', material);
    }
    catch (e) {
        console.error(e);
    }
}

// 清空选中并退出多选模式
function clearSelectionAndExit() {
    selectedFiles.value.clear();
    isMultiSelectMode.value = false;
}

function getPreferredInsertStartTime() {
    if (props.materialType !== 'image' && props.thingType !== 'image') {
        return cursorTime.value;
    }

    const targetTypes = [props.thingType, props.materialType].filter(Boolean);
    let latestEnd = -1;

    for (const rail of rails.value) {
        if (!targetTypes.includes(rail.type)) {
            continue;
        }
        for (const segment of rail.segments) {
            latestEnd = Math.max(latestEnd, segment.end);
        }
    }

    return latestEnd >= 0 ? latestEnd : cursorTime.value;
}

function setPreviewRef(fileId: string, el: Element | null) {
    if (!el) {
        return;
    }

    const host = el as HTMLElement;
    const media = host.querySelector('img, video') as HTMLImageElement | HTMLVideoElement | null;
    if (!media) {
        previewShapeMap.value[fileId] = 'wide';
        return;
    }

    const applyShape = () => {
        let width = 0;
        let height = 0;

        if (media instanceof HTMLVideoElement) {
            width = media.videoWidth;
            height = media.videoHeight;
        }
        else {
            width = media.naturalWidth;
            height = media.naturalHeight;
        }

        if (!width || !height) {
            previewShapeMap.value[fileId] = 'wide';
            return;
        }

        const ratio = width / height;
        if (ratio < 0.85) {
            previewShapeMap.value[fileId] = 'portrait';
        }
        else if (ratio < 1.15) {
            previewShapeMap.value[fileId] = 'square';
        }
        else if (ratio < 1.55) {
            previewShapeMap.value[fileId] = 'landscape';
        }
        else {
            previewShapeMap.value[fileId] = 'wide';
        }
    };

    if (media instanceof HTMLVideoElement) {
        if (media.videoWidth && media.videoHeight) {
            applyShape();
        }
        else {
            media.addEventListener('loadedmetadata', applyShape, { once: true });
        }
        return;
    }

    if (media.complete && media.naturalWidth && media.naturalHeight) {
        applyShape();
    }
    else {
        media.addEventListener('load', applyShape, { once: true });
    }
}

function getPreviewShapeClass(file: WebCutMaterial) {
    const shape = previewShapeMap.value[file.id] || 'wide';
    return `webcut-material-preview--${shape}`;
}
</script>

<template>
    <div class="webcut-material-browser">
        <div class="webcut-multiselect-info" v-if="props.enableMultipleSelect && fileList.length && isMultiSelectMode">
            <span style="margin-right: auto;">{{ t('已选{size}个', { size: selectedFiles.size }) }}</span>
            <n-button size="tiny" @click="handleBatchAdd" type="primary" :disabled="selectedFiles.size === 0" v-if="isMultiSelectMode">
                {{ t('按顺序添加') }}
            </n-button>
            <n-button size="tiny" secondary @click="clearSelectionAndExit" v-if="isMultiSelectMode">
                {{ t('退出多选') }}
            </n-button>
        </div>

        <div class="webcut-material-list">
            <slot name="prepend"></slot>

            <div
                v-for="file in fileList"
                :key="file.id"
                class="webcut-material-item"
                :class="{ 'webcut-material-selected': selectedFiles.has(file.id) }"
                @contextmenu.stop="handleContextMenu($event, file)"
                @mouseleave="emit('leaveItem', file)"
                @mouseenter="emit('enterItem', file)"
                @click="handleFileClick(file, $event)"
            >
                <div class="webcut-material-preview" :class="getPreviewShapeClass(file)" :ref="(el) => setPreviewRef(file.id, el as Element | null)">
                    <n-tag type="error" :bordered="false" size="tiny" round :color="{ color: '#f55', textColor: 'white' }" class="webcut-material-badge" v-if="file.time + 5000 > Date.now()"><small>{{ t('新') }}</small></n-tag>

                    <div v-if="isMultiSelectMode && props.enableMultipleSelect" class="webcut-checkbox-container" @click.stop="toggleFileSelection(file, $event)">
                        <div
                            v-if="!selectedFiles.has(file.id)"
                            class="webcut-checkbox-round"
                        ></div>
                        <div
                            v-else
                            class="webcut-selection-order"
                        >
                            {{ selectedFiles.get(file.id) }}
                        </div>
                    </div>

                    <slot name="preview" :file="file"></slot>
                    <slot :file="file"></slot>

                    <n-button v-if="!isMultiSelectMode" class="webcut-add-button" size="tiny" type="primary" circle :focusable="false" @click.stop="handleAdd(file)">
                        <template #icon>
                            <n-icon>
                                <Add />
                            </n-icon>
                        </template>
                    </n-button>
                </div>
            </div>

            <slot name="append"></slot>

            <div v-if="fileList.length === 0 && !$slots.append && !$slots.prepend" class="webcut-empty-materials">
                {{ t('暂无素材，请先导入素材') }}
            </div>
        </div>

        <n-dropdown placement="bottom-start" trigger="manual" :x="x" :y="y" :options="options" :show="showDropdown"
            :on-clickoutside="onClickoutside" size="small" @select="handleSelect" />
    </div>
</template>

<style scoped lang="less">
@import "../../../styles/library.less";
</style>
