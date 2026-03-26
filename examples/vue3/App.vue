<script setup lang="ts">
import { WebCutEditor } from '../../src/index';
import { RhubarbLipSyncPack } from './lipsync/RhubarbLipSyncPack';
</script>

<template>
    <WebCutEditor :packs="[RhubarbLipSyncPack]" />
</template>
