import { defineComponent, h } from 'vue';
import type { WebCutExtensionPack, WebCutRail } from 'webcut';
import LipSyncLibrary from './LipSyncLibrary.vue';
import LipSyncSegment from './LipSyncSegment.vue';

const LipSyncIcon = defineComponent({
  name: 'LipSyncIcon',
  render() {
    return h('svg', {
      viewBox: '0 0 24 24',
      width: '1em',
      height: '1em',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '1.8',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    }, [
      h('path', { d: 'M4 8.5C5.7 6.8 8.1 6 12 6s6.3.8 8 2.5' }),
      h('path', { d: 'M4 15.5C5.7 17.2 8.1 18 12 18s6.3-.8 8-2.5' }),
      h('path', { d: 'M7.5 12c1.2-.8 2.7-1.2 4.5-1.2s3.3.4 4.5 1.2' }),
    ]);
  },
});

export class RhubarbLipSyncPack implements WebCutExtensionPack {
  materialConfig = {
    name: 'rhubarb-lip-sync',
    icon: LipSyncIcon,
    displayName: 'Lip Sync',
    materialType: 'image' as const,
    thingType: 'rhubarb-lip-sync',
    libraryComponent: LipSyncLibrary,
  };

  managerConfig = {
    is: (rail: WebCutRail) => rail.type === 'rhubarb-lip-sync',
    height: 68,
    segment: {
      component: LipSyncSegment,
    },
    aside: {
      lock: true,
      hide: true,
    },
  };
}
