<script setup lang="ts">
import { ref, watch } from 'vue';
import { UniformController } from '../../shared/playgroundInterface';
import Slider from './ui/Slider.vue'
import Colorpick from './ui/Colorpick.vue'

declare function acquireVsCodeApi(): {
    postMessage: (msg: any) => void;
    setState: (state: any) => void;
    getState: () => any;
};
const vscode = acquireVsCodeApi();

const initialized = ref(false);
const uniformComponents = ref<UniformController[]>([])

watch(uniformComponents, (newValues, _) => {
    if (!initialized.value) return;
	vscode.postMessage({
		type: 'update',
		data: JSON.parse(JSON.stringify(newValues))
	});
}, {deep: true})

window.addEventListener('message', event => {
    if(event.data.type == "init") {
		uniformComponents.value = event.data.uniformComponents;
        initialized.value = true;
	}
});

</script>
<template>
	<div class="uniformPanel">
		<div v-for="uniformComponent in uniformComponents">
			<Slider v-if="uniformComponent.type == 'SLIDER'" :name="uniformComponent.name"
				v-model:value="uniformComponent.value" :min="uniformComponent.min" :max="uniformComponent.max" />
			<Colorpick v-if="uniformComponent.type == 'COLOR_PICK'" :name="uniformComponent.name"
				v-model:value="uniformComponent.value" />
		</div>
	</div>
</template>

<style scoped>
.uniformPanel {
    background-color: var(--vscode-editor-background);
    height: 100%;
    overflow-y: scroll;
}
</style>