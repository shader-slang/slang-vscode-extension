import type { Bindings } from "../../shared/playgroundInterface";

export class ComputePipeline {
    pipeline: GPUComputePipeline | undefined;
    pipelineLayout: GPUPipelineLayout | "auto" | undefined;

    device;
    bindGroup: GPUBindGroup | undefined;

    // thread group size (array of 3 integers)
    threadGroupSize: [number, number, number] | undefined;

    // resource name (string) -> binding descriptor 
    resourceBindings: Bindings | undefined;

    constructor(device: GPUDevice) {
        this.device = device;
    }

    setThreadGroupSize(size: [number, number, number]) {
        this.threadGroupSize = size;
    }

    createPipelineLayout(resourceDescriptors: Bindings) {
        this.resourceBindings = resourceDescriptors;

        const entries: GPUBindGroupLayoutEntry[] = [];
        for (const binding of Object.values(this.resourceBindings)) {
            entries.push(binding);
        }
        const bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
            label: 'compute pipeline bind group layout',
            entries: entries,
        };

        const bindGroupLayout = this.device.createBindGroupLayout(bindGroupLayoutDescriptor);
        const layout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

        this.pipelineLayout = layout;
    }

    createPipeline(shaderModule: GPUShaderModule, entryPoint: string) {
        if (this.pipelineLayout == undefined)
            throw new Error("Cannot create pipeline without layout");
        const pipeline = this.device.createComputePipeline({
            label: 'compute pipeline',
            layout: this.pipelineLayout,
            compute: { module: shaderModule, entryPoint },
        });

        this.pipeline = pipeline;
    }

    createBindGroup(allocatedResources: Map<string, GPUObjectBase>) {
        if (this.resourceBindings == undefined)
            throw new Error("No resource bindings");
        if (this.pipeline == undefined)
            throw new Error("No pipeline");

        const entries: GPUBindGroupEntry[] = [];
        for (const [name, resource] of allocatedResources) {
            const bindInfo = this.resourceBindings[name];

            if (bindInfo) {
                if (bindInfo.buffer) {
                    if (!(resource instanceof GPUBuffer)) {
                        throw new Error("Invalid state");
                    }
                    entries.push({ binding: bindInfo.binding, resource: { buffer: resource } });
                }
                else if (bindInfo.storageTexture) {
                    if (!(resource instanceof GPUTexture)) {
                        throw new Error("Invalid state");
                    }
                    entries.push({ binding: bindInfo.binding, resource: resource.createView() });
                }
                else if (bindInfo.sampler) {
                    if (!(resource instanceof GPUSampler)) {
                        throw new Error("Invalid state");
                    }
                    entries.push({ binding: bindInfo.binding, resource: resource });
                }
                else if (bindInfo.texture) {
                    if (!(resource instanceof GPUTexture)) {
                        throw new Error("Invalid state");
                    }
                    entries.push({ binding: bindInfo.binding, resource: resource.createView() });
                }
            }
        }

        // Check that all resources are bound
        if (entries.length != Object.keys(this.resourceBindings).length) {
            let missingEntries: string[] = []
            // print out the names of the resources that aren't bound
            for (const [name, resource] of Object.entries(this.resourceBindings)) {
                if (!entries.find(entry => entry.binding == resource.binding)) {
                    missingEntries.push(name);
                }
            }

            throw new Error("Cannot create bind-group. The following resources are not bound: " + missingEntries.join(", "));
        }

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: entries,
        });
    }
}
