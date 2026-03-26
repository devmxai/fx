# FX Project

`FX Project` is a customized editing build based on `WebCut`, focused on a cleaner professional UI, better desktop/tablet readiness, and a simpler creator workflow for media import, timeline editing, and lip-sync composition.

This repository is the active baseline for the current edition. It replaces the earlier broken local copy and is the version that should be used for ongoing work.

## Current Focus

This edition is being rebuilt in small, controlled UI passes so the product can evolve safely without breaking the source structure.

Current direction:

- Desktop-first polish
- Tablet-friendly interaction
- Mobile-ready layout foundation
- Minimal logic disruption while improving the editing experience

## What Has Been Built

### 1. Editor Shell Refresh

The main editor UI was redesigned to feel more like a modern editing tool:

- New top `App Bar`
- `Restore / Undo / Redo` moved to the top-left
- Preview zoom controls moved to the top-center as UI controls
- `Export` moved to the top-right
- Cleaner panel separation and darker, more unified visual rhythm

Primary file:

- `/Users/mx/Documents/New project/FX Project/src/views/editor/index.vue`

### 2. Left Media Rail + Import Panel

The old library area was reshaped into a more structured two-part layout:

- Vertical tool rail for `Video`, `Audio`, `Image`, `Text`, `Transition`, and `Lip Sync`
- Dedicated adjacent import/material panel
- Card-based media browser
- Import card integrated inside the same grid
- Cleaner media cards with reduced label noise

Primary files:

- `/Users/mx/Documents/New project/FX Project/src/views/library/index.vue`
- `/Users/mx/Documents/New project/FX Project/src/styles/library.less`
- `/Users/mx/Documents/New project/FX Project/src/views/library/_shared/container.vue`
- `/Users/mx/Documents/New project/FX Project/src/views/library/_shared/import.vue`
- `/Users/mx/Documents/New project/FX Project/src/views/library/_shared/list.vue`

### 3. Timeline Toolbar Cleanup

The toolbar above the timeline was cleaned up and simplified:

- Timeline history actions removed from the lower bar after moving them to the app bar
- Editing tools reordered from the left
- Empty left gutter removed
- Toolbar spacing and border alignment improved
- Timeline tool buttons restyled closer to the main app controls

Primary files:

- `/Users/mx/Documents/New project/FX Project/src/views/manager/tool-bar/index.vue`
- `/Users/mx/Documents/New project/FX Project/src/views/manager/index.vue`

### 4. Visual System Polish

A broader UI cleanup was applied to make the product feel more coherent:

- Borders unified to a single stroke weight
- Divider color darkened and normalized across major panels
- Control buttons restyled into one visual language
- Import cards and tabs visually aligned with the rest of the editor

Primary files:

- `/Users/mx/Documents/New project/FX Project/src/hooks/index.ts`
- `/Users/mx/Documents/New project/FX Project/src/views/editor/index.vue`
- `/Users/mx/Documents/New project/FX Project/src/views/library/index.vue`
- `/Users/mx/Documents/New project/FX Project/src/styles/library.less`
- `/Users/mx/Documents/New project/FX Project/src/views/manager/container/index.vue`

### 5. Timeline Refresh / Undo Fix

An important timeline rendering bug was fixed in this edition:

- After `Split`, using `Undo` could leave stale segment visuals in the timeline
- The root cause was incomplete timeline refresh logic when segment structure changed inside the same rail
- The manager now rebuilds its visual data from rail signatures instead of only watching rail count

Primary file:

- `/Users/mx/Documents/New project/FX Project/src/views/manager/container/index.vue`

### 6. Lip Sync Example Workflow

The example app includes a simplified lip-sync workflow built around Rhubarb:

- Simplified lip-sync panel
- Image-based mouth-shape workflow
- Example template/preset support in the example app
- Example pack wiring in the Vue demo

Primary files:

- `/Users/mx/Documents/New project/FX Project/examples/vue3/lipsync/LipSyncLibrary.vue`
- `/Users/mx/Documents/New project/FX Project/examples/vue3/lipsync/LipSyncSegment.vue`
- `/Users/mx/Documents/New project/FX Project/examples/vue3/lipsync/RhubarbLipSyncPack.ts`
- `/Users/mx/Documents/New project/FX Project/examples/vue3/App.vue`

## Current Product Characteristics

This version currently emphasizes:

- Cleaner editing UI
- Faster visual review during iteration
- Safer incremental UI changes
- Preservation of the underlying WebCut structure as much as possible

## Responsive Direction

This edition is being shaped with three target modes in mind:

- Desktop
- Tablet
- Mobile

The current implemented work is mainly:

- Desktop polish
- Tablet-friendly visual structure
- Responsive groundwork for later mobile-specific layout passes

## Development

Install root dependencies:

```bash
npm install
```

Run the example editor:

```bash
cd examples/vue3
npm install
npm run dev -- --host 0.0.0.0 --port 4275
```

Type-check the project:

```bash
npm run typecheck
```

## Preview URLs

Typical local preview:

- `http://127.0.0.1:4275/`

Typical local network preview:

- `http://192.168.0.156:4275/`

## Notes

- The active working copy is `/Users/mx/Documents/New project/FX Project`
- The older broken local copy was retired and should not be used as the main baseline
- Ongoing changes should continue here in small reviewable UI steps

## Upstream Base

Originally based on:

- `WebCut` by `tangshuang`

Current repository:

- `https://github.com/devmxai/fx`

