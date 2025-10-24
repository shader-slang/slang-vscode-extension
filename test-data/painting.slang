import playground;
import rendering;

static const int MAX_BRUSH_SIZE = 64;
static const uint THREAD_COUNT = 8;

[playground::BLACK_SCREEN(1.0, 1.0)]
RWTexture2D<float> tex;

[playground::ZEROS(8)]
RWStructuredBuffer<uint> indirectBuffer;

[playground::SLIDER(10.0, 4.0, 64.0)]
uniform float brush_size;
[playground::COLOR_PICK(1.0, 0.0, 1.0)]
uniform float3 color;

[playground::MOUSE_POSITION]
uniform float4 mousePosition;

[shader("compute")]
[numthreads(1, 1, 1)]
[playground::CALL(1, 1, 1)]
void update(uint2 dispatchThreadId: SV_DispatchThreadID)
{
    indirectBuffer[0] = uint(2.0 * brush_size + THREAD_COUNT + 1.0) / THREAD_COUNT;
    indirectBuffer[1] = uint(2.0 * brush_size + THREAD_COUNT + 1.0) / THREAD_COUNT;
    indirectBuffer[2] = 1;
}

[shader("compute")]
[numthreads(THREAD_COUNT, THREAD_COUNT, 1)]
[playground::CALL_INDIRECT("indirectBuffer", 0)]
void draw(uint2 dispatchThreadId: SV_DispatchThreadID)
{
    if (mousePosition.z >= 0)
        return;

    let offset = float2(dispatchThreadId.xy) - brush_size;
    if (length(offset) > brush_size / 2)
        return;

    uint2 screenSize;
    tex.GetDimensions(screenSize.x, screenSize.y);

    var mouse_pos = int2(0, screenSize.y) + int2(1, -1) * int2(mousePosition.xy + offset);
    drawPixel(mouse_pos, (int2 screenSize) => {
        return float4(color, 1.0);
    });
}