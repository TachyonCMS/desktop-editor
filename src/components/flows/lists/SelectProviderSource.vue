<template>
  <q-item
    clickable
    v-ripple
    @click="onSelectRootDir"
    v-if="$q.platform.is.electron"
  >
    <q-item-section avatar>
      <q-icon name="folder" />
    </q-item-section>

    <q-item-section>
      <q-item-label
        >{{ flowSourceMsg
        }}<q-tooltip v-if="flowSource">{{
          flowSource
        }}</q-tooltip></q-item-label
      >
    </q-item-section>
  </q-item>
</template>

<script>
import { defineComponent, ref, computed } from "vue";

import useFlows from "../../../composables/useFlows";

export default defineComponent({
  name: "SelectProviderSourceList",

  setup() {
    //const
  },

  // Register possible form components
  components: {},
});
</script>
