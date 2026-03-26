<script setup lang="ts">
import { WebCutEditor } from 'webcut';
import 'webcut/esm/style.css';
import { RhubarbLipSyncPack } from './lipsync/RhubarbLipSyncPack';
</script>

<template>
    <WebCutEditor :packs="[RhubarbLipSyncPack]" />
</template>
