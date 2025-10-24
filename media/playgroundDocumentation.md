# Slang Playground

Welcome to Slang Playground Extension. Here you can write, compile and run Slang shaders locally.
No data is sent to any server.

## Compiling Shaders (the "Compile" button)

You can compile shaders to many targets supported by Slang here, including SPIR-V, HLSL, GLSL, Metal, CUDA, and
WGSL.
Generating DXIL requires DXC, which doesn't run in the browser so it's not supported here. You will have the opportunuty to select entrypoints for targets that don't support multiple entrypoints.
You can compile shaders with either the button in the top right of the editor, or the command `Slang Compile`.

## Run Shaders (the "Run" button)

In addition to compiling shaders, this playground extension can also run simple shaders via WebGPU.
You can run shaders with either the button in the top right of the editor, or the command `Run Playground`.
The playground supports running compute shaders that produce an image, text output, or both. All runnable shaders must be compute shaders marked with the `[shader("compute")]` attribute. You can use `import rendering` or `import printing` to display shader results.

### Rendering

The `rendering` module provides the following function:

`void drawPixel(uint2 location, IFunc<float4, int2> renderFunction)`

This will render to the output at the provided location based on the result of the provided function. The provided function takes in the screen size as an `int2`. It also creates an `outputTexture` texture, so you can create an entrypoint that executes for every pixel like so:

```slang
import playground;
import rendering;

[shader("compute")]
[numthreads(16, 16, 1)]
[playground::CALL::SIZE_OF("outputTexture")]
void imageMain(uint2 dispatchThreadID: SV_DispatchThreadID)
{
    drawPixel(dispatchThreadID, (int2 _) => float4(0.3, 0.7, 0.55, 1.0));
}
```

### Printing

The `printing` module provides the following function:

### `void printf<T>(String format, expand each T values) where T : IPrintf`

Prints the values formatted according to the format.

## Shader Commands

WebGPU shaders can use certain commands to specify how they will run. Requires `import playground;`.

### `[playground::ZEROS(512)]`

Initialize a `float` buffer with zeros of the provided size.

### `[playground::BLACK(512, 512)]`

Initialize a `float` texture with zeros of the provided size.

### `[playground::BLACK_SCREEN(1.0, 1.0)]`

Initialize a `float` texture with zeros with a size proportional to the screen size.

### `[playground::SAMPLER]`

Initialize a sampler state with linear filtering and repeat address mode for sampling textures.

### `[playground::URL("https://example.com/image.png")]`

Initialize a texture with image from URL.

### `[playground::RAND(1000)]`

Initialize a `float` buffer with uniform random floats between 0 and 1.

### `[playground::TIME]`

Gives a `float` uniform the current time in milliseconds.

### `[playground::FRAME_ID]`

Gives a `float` uniform the current frame index (starting from 0).

### `[playground::MOUSE_POSITION]`

Gives a `float4` uniform mouse data.

* `xy`: mouse position (in pixels) during last button down
* `abs(zw)`: mouse position during last button click
* `sign(mouze.z)`: button is down
* `sign(mouze.w)`: button is clicked

### `[playground::KEY("KeyA")]`

Sets a scalar uniform to `1` if the specified key
is pressed, `0` otherwise. Key name comes from either javascript [`event.code`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code) or [`event.key`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key).

### `[playground::SLIDER(0.3, 0.0, 1.0)]`

Control a `float` uniform with a provided default, minimum, and maximum.

### `[playground::COLOR_PICK(0.5, 0.5, 0.5)]`

Control a `float3` color uniform with a provided default color.

### `[playground::CALL::SIZE_OF("RESOURCE-NAME")]`

Dispatch a compute pass using the resource size to determine the work-group size.

### `[playground::CALL(512, 512, 1)]`

Dispatch a compute pass with the given grid of threads.
The number of work-groups will be determined by dividing by the number of threads per work-group and rounding up.

### `[playground::CALL_INDIRECT("BUFFER-NAME", 0)]`

Dispatch a compute pass with an indirect command buffer and an offset in bytes.

### `[playground::CALL::ONCE]`

Only dispatch the compute pass once at the start of rendering. Should be used in addition to another CALL command.

## Shader Reflection

You can see reflection data for your shaders with either the button in the top right of the editor, or the command `Show Reflection`.
