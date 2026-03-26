<script setup lang="ts">
import { NIcon } from 'naive-ui';
import { Video, Music, Image, StringText, Locked, Unlocked, View, ViewOff, VolumeMute, VolumeUp, Delete } from '@vicons/carbon';
import { useWebCutContext } from '../../../hooks';
import { useWebCutManager } from '../../../hooks/manager';
import { WebCutRail } from '../../../types';
import { computed } from 'vue';
import { useT } from '../../../i18n/hooks';

const props = defineProps<{
    rail: WebCutRail
}>();

const { rails, sources, current, canvas, selected, memory, findRailExtensionPack } = useWebCutContext();
const { toggleRailHidden, toggleRailMute } = useWebCutManager();
const t = useT();
const railExtensionPack = computed(() => findRailExtensionPack(props.rail));
const isLipSyncRail = computed(() => props.rail.type === 'rhubarb-lip-sync');
const areAllRailSegmentsSelected = computed(() => {
    if (!props.rail.segments.length) {
        return false;
    }
    return props.rail.segments.every(segment => selected.value.some(item => item.segmentId === segment.id && item.railId === props.rail.id));
});
const isLipSyncGroupSelectionActive = computed(() => {
    return isLipSyncRail.value
        && memory.value.__lipSyncGroupSelectionRailId === props.rail.id
        && areAllRailSegmentsSelected.value;
});
const icon = computed(() => {
    if (railExtensionPack.value?.materialConfig) {
        return railExtensionPack.value.materialConfig?.icon;
    }
    const map = {
        video: Video,
        audio: Music,
        image: Image,
        text: StringText,
    };
    // @ts-ignore
    return map[props.rail.type];
});
const enabledFeatures = computed(() => {
    if (railExtensionPack.value) {
        const { lock, hide, mute } = !!railExtensionPack.value.managerConfig?.aside || {} as any;
        return {
            lock,
            hide,
            mute,
        };
    }
    return {
        lock: true,
        hide: true,
        mute: true,
    };
});

function handleToggleLocked(rail: any) {
    const next = !rail.locked;
    rail.locked = next;

    // 设置rail上所有segment对应的source.sprite.interactable
    for (const segment of rail.segments) {
        const source = sources.value.get(segment.sourceKey);
        if (source && source.sprite) {
            if (next) {
                source.sprite.interactable = 'disabled';
                // 如果当前的segment还是被选中的状态，则取消选中
                if (selected.value.some(item => item.segmentId === segment.id)) {
                    selected.value = selected.value.filter(item => item.segmentId !== segment.id);
                }
                if (current.value === segment.id) {
                    current.value = null;
                    // 使canvas上的选中素材失活
                    canvas.value!.activeSprite = null;
                }
            } else {
                source.sprite.interactable = 'interactive';
            }
        }
    }
}

function handleDeleteRail(railId: string) {
    const railIndex = rails.value.findIndex(r => r.id === railId);
    if (railIndex > -1) {
        rails.value.splice(railIndex, 1);
    }
}

function handleSelectAllRailSegments(rail: WebCutRail) {
    if (!rail.segments.length) {
        return;
    }

    const isGroupSelectionActive = memory.value.__lipSyncGroupSelectionRailId === rail.id
        && rail.segments.every(segment => selected.value.some(item => item.segmentId === segment.id && item.railId === rail.id));
    if (isGroupSelectionActive) {
        selected.value = selected.value.filter(item => item.railId !== rail.id);
        if (current.value?.railId === rail.id) {
            current.value = null;
        }
        const activeSource = [...sources.value.values()].find(item => item.sprite === canvas.value?.activeSprite);
        if (activeSource?.railId === rail.id && canvas.value) {
            canvas.value.activeSprite = null;
        }
        memory.value.__lipSyncGroupSelectionRailId = null;
        memory.value.__keepLipSyncMultiSelectionOnce = false;
        return;
    }

    selected.value = rail.segments.map(segment => ({
        segmentId: segment.id,
        railId: rail.id,
    }));
    memory.value.__lipSyncGroupSelectionRailId = rail.id;
    memory.value.__keepLipSyncMultiSelectionOnce = true;

    const firstSegment = rail.segments[0];
    current.value = {
        segmentId: firstSegment.id,
        railId: rail.id,
    };

    const firstSource = sources.value.get(firstSegment.sourceKey);
    if (firstSource?.sprite && canvas.value) {
        canvas.value.activeSprite = firstSource.sprite;
    }
}
</script>

<template>
    <div class="webcut-manager-webcut-manager-rail-left-side" :class="{ 'webcut-manager-webcut-manager-rail-left-side--lipsync': isLipSyncRail }">
        <span v-if="!isLipSyncRail" class="webcut-manager-webcut-manager-rail-left-side-type-icon" :class="{'webcut-manager-webcut-manager-rail-left-side-main-icon': rail.main }">
            <n-icon :component="icon" v-if="icon"></n-icon>
        </span>
        <button
            v-if="isLipSyncRail"
            class="webcut-manager-webcut-manager-rail-left-side-action-chip"
            :class="{ 'webcut-manager-webcut-manager-rail-left-side-action-chip--active': isLipSyncGroupSelectionActive }"
            :title="t('Select all lip sync frames')"
            @click="handleSelectAllRailSegments(rail)"
        >
            ALL
        </button>
        <span class="webcut-manager-webcut-manager-rail-left-side-action-icon">
            <n-icon :component="Unlocked" @click="handleToggleLocked(rail)" v-if="enabledFeatures.lock && !rail.locked"></n-icon>
            <n-icon :component="Locked" @click="handleToggleLocked(rail)" v-if="enabledFeatures.lock && rail.locked"></n-icon>
        </span>
        <span class="webcut-manager-webcut-manager-rail-left-side-action-icon">
            <n-icon :component="View" @click="toggleRailHidden(rail)" v-if="enabledFeatures.hide && !rail.hidden && !['audio'].includes(rail.type)"></n-icon>
            <n-icon :component="ViewOff" @click="toggleRailHidden(rail)" v-if="enabledFeatures.hide && rail.hidden && !['audio'].includes(rail.type)"></n-icon>
        </span>
        <span class="webcut-manager-webcut-manager-rail-left-side-action-icon">
            <n-icon :component="VolumeUp" @click="toggleRailMute(rail)" v-if="enabledFeatures.mute && !rail.mute && ['video'].includes(rail.type)"></n-icon>
            <n-icon :component="VolumeMute" @click="toggleRailMute(rail)" v-if="enabledFeatures.mute && rail.mute && ['video'].includes(rail.type)"></n-icon>
            <n-icon :component="VolumeUp" @click="toggleRailHidden(rail)" v-if="enabledFeatures.mute && !rail.hidden && ['audio'].includes(rail.type)"></n-icon>
            <n-icon :component="VolumeMute" @click="toggleRailHidden(rail)" v-if="enabledFeatures.mute && rail.hidden && ['audio'].includes(rail.type)"></n-icon>
        </span>
        <span class="webcut-manager-webcut-manager-rail-left-side-action-icon" :class="{ 'webcut-manager-webcut-manager-rail-left-side-action-icon--disabled': rail.segments.length > 0 }">
            <n-icon :component="Delete" @click="rail.segments.length === 0 &&handleDeleteRail(rail.id)"></n-icon>
        </span>
    </div>
</template>

<style scoped>
.webcut-manager-webcut-manager-rail-left-side {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-left: -8px;

    span {
        width: 1em;
        height: 1em;
    }
}
.webcut-manager-webcut-manager-rail-left-side--lipsync {
    gap: 4px;
    margin-left: -2px;
}
.webcut-manager-webcut-manager-rail-left-side--lipsync .webcut-manager-webcut-manager-rail-left-side-action-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.webcut-manager-webcut-manager-rail-left-side-type-icon {
    opacity: .2;
}
.webcut-manager-webcut-manager-rail-left-side-main-icon {
    color: var(--primary-color);
}
.webcut-manager-webcut-manager-rail-left-side-action-icon {
    transition: color .2s;
}
.webcut-manager-webcut-manager-rail-left-side-action-icon:hover {
    color: var(--primary-color);
}
.webcut-manager-webcut-manager-rail-left-side-action-icon--active {
    color: var(--primary-color);
}
.webcut-manager-webcut-manager-rail-left-side-action-chip {
    width: 30px;
    height: 18px;
    border: 1px solid color-mix(in srgb, var(--primary-color) 32%, var(--border-color));
    border-radius: 999px;
    background: color-mix(in srgb, var(--webcut-background-color) 84%, transparent);
    color: var(--text-color-base);
    font-size: 9px;
    font-weight: 700;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin-right: 2px;
    cursor: pointer;
    transition: color .2s, border-color .2s, background-color .2s;
    flex: 0 0 auto;
}
.webcut-manager-webcut-manager-rail-left-side-action-chip:hover,
.webcut-manager-webcut-manager-rail-left-side-action-chip--active {
    color: var(--primary-color);
    border-color: color-mix(in srgb, var(--primary-color) 72%, var(--border-color));
    background: color-mix(in srgb, var(--primary-color) 14%, transparent);
}
.webcut-manager-webcut-manager-rail-left-side-action-icon--disabled {
    opacity: .1;
}
</style>
