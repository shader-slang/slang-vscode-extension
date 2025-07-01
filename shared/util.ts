import type { HashedStringData, ScalarType, ReflectionJSON, SlangFormat, ReflectionType, CallCommand, UniformController, ResourceCommand, ParsedCommand, Result } from './playgroundInterface.js'

export const RUNNABLE_ENTRY_POINT_NAMES = ['imageMain', 'printMain'] as const;

export class NotReadyError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export function isWebGPUSupported() {
    return 'gpu' in navigator && navigator.gpu !== null;
}

type ScalarRepresentation = `8unorm` | `${16 | 32}float` | `${8 | 16 | 32}${"sint" | "uint"}`;
function getWebGPURepresentation(scalarType: ScalarType): ScalarRepresentation {
    let size = parseInt(scalarType.replace(/^[a-z]*/, ""));
    let type = scalarType.replace(/[0-9]*$/, "");
    if (type == "int")
        type = "sint";

    return `${size}${type}` as any
}

function getScalarSize(scalarType: ScalarType): 8 | 16 | 32 | 64 {
    let size = parseInt(scalarType.replace(/^[a-z]*/, ""));
    return size as any;
}

export function getTextureFormat(componentCount: 1 | 2 | 3 | 4, scalarType: ScalarType, access: GPUStorageTextureAccess | undefined): GPUTextureFormat {
    if (access == "read-write" && componentCount > 1) {
        throw new Error("There are no texture formats available with more than 1 component that are read-write")
    }
    let scalarSize = getScalarSize(scalarType);

    if (access == "write-only" && componentCount == 2 && scalarSize != 32) {
        throw new Error("There are no non 32 bit texture formats available with 2 components that are write-only")
    }

    if (scalarSize == 64) {
        throw new Error("There are 64 bit texture formats available")
    }

    let scalarRepresentation = getWebGPURepresentation(scalarType);
    if (componentCount == 1) {
        return `r${scalarRepresentation}`
    } else if (componentCount == 2) {
        return `rg${scalarRepresentation}`
    } else {
        return `rgba${scalarRepresentation}`
    }
}

export function sizeFromFormat(format: GPUTextureFormat) {
    switch (format) {
        case "r8unorm":
        case "r8snorm":
        case "r8uint":
        case "r8sint":
            return 1;
        case "r16uint":
        case "r16sint":
        case "r16float":
        case "rg8unorm":
        case "rg8snorm":
        case "rg8uint":
        case "rg8sint":
            return 2;
        case "r32uint":
        case "r32sint":
        case "r32float":
        case "rg16uint":
        case "rg16sint":
        case "rg16float":
        case "rgba8unorm":
        case "rgba8unorm-srgb":
        case "rgba8snorm":
        case "rgba8uint":
        case "rgba8sint":
        case "bgra8unorm":
        case "bgra8unorm-srgb":
        case "rgb10a2unorm":
        case "rg11b10ufloat":
        case "rgb9e5ufloat":
            return 4;
        case "rg32uint":
        case "rg32sint":
        case "rg32float":
        case "rgba16uint":
        case "rgba16sint":
        case "rgba16float":
            return 8;
        case "rgba32uint":
        case "rgba32sint":
        case "rgba32float":
            return 16;
        default:
            throw new Error(`Could not get size of unrecognized format "${format}"`)
    }
}

export const ACCESS_MAP = {
    "readWrite": "read-write",
    "write": "write-only",
    "read": "read-only",
} as const;

const FORMAT_MAP: Partial<Record<SlangFormat, GPUTextureFormat>> = {
    "rgba32f": "rgba32float",
    "rgba16f": "rgba16float",
    "rg32f": "rg32float",
    "rg16f": "rg16float",
    "r32f": "r32float",
    "r16f": "r16float",
    "rgb10_a2": "rgb10a2unorm",
    "rgba8": "rgba8unorm",
    "rg8": "rg8unorm",
    "r8": "r8unorm",
    "rgba8_snorm": "rgba8snorm",
    "rg8_snorm": "rg8snorm",
    "r8_snorm": "r8snorm",
    "rgba32i": "rgba32sint",
    "rgba16i": "rgba16sint",
    "rgba8i": "rgba8sint",
    "rg32i": "rg32sint",
    "rg16i": "rg16sint",
    "rg8i": "rg8sint",
    "r32i": "r32sint",
    "r16i": "r16sint",
    "r8i": "r8sint",
    "rgba32ui": "rgba32uint",
    "rgba16ui": "rgba16uint",
    "rgb10_a2ui": "rgb10a2uint",
    "rgba8ui": "rgba8uint",
    "rg32ui": "rg32uint",
    "rg16ui": "rg16uint",
    "rg8ui": "rg8uint",
    "r32ui": "r32uint",
    "r16ui": "r16uint",
    "r8ui": "r8uint",
    "bgra8": "bgra8unorm"
}

export function webgpuFormatfromSlangFormat(format: SlangFormat): GPUTextureFormat {
    let gpuFormat = FORMAT_MAP[format];
    if (gpuFormat == undefined) {
        throw new Error(`Could not find webgpu format for ${format}`);
    }
    return gpuFormat;
}

function reinterpretUint32AsFloat(uint32: number) {
    const buffer = new ArrayBuffer(4);
    const uint32View = new Uint32Array(buffer);
    const float32View = new Float32Array(buffer);

    uint32View[0] = uint32;
    return float32View[0];
}

function roundUpToNearest(x: number, nearest: number) {
    return Math.ceil(x / nearest) * nearest;
}

function getSize(reflectionType: ReflectionType): number {
    if (reflectionType.kind == "resource" || reflectionType.kind == "samplerState") {
        throw new Error("unimplemented");
    } else if (reflectionType.kind == "scalar") {
        const bitsMatch = reflectionType.scalarType.match(/\d+$/);
        if (bitsMatch == null) {
            throw new Error("Could not get bit count out of scalar type");
        }
        return parseInt(bitsMatch[0]) / 8;
    } else if (reflectionType.kind == "struct") {
        const alignment = reflectionType.fields.map((f) => {
            if (f.binding.kind == "uniform") return f.binding.size;
            else throw new Error("Invalid state")
        }).reduce((a, b) => Math.max(a, b));

        const unalignedSize = reflectionType.fields.map((f) => {
            if (f.binding.kind == "uniform") return f.binding.offset + f.binding.size;
            else throw new Error("Invalid state")
        }).reduce((a, b) => Math.max(a, b));

        return roundUpToNearest(unalignedSize, alignment);
    } else if (reflectionType.kind == "vector") {
        if (reflectionType.elementCount == 3) {
            return 4 * getSize(reflectionType.elementType);
        }
        return reflectionType.elementCount * getSize(reflectionType.elementType);
    } else {
        let x: never = reflectionType;
        throw new Error("Cannot get size of unrecognized reflection type");
    }
}


/**
 * See help panel for details on commands
 */
export function getResourceCommandsFromAttributes(reflection: ReflectionJSON): Result<ResourceCommand[]> {
    let commands: { resourceName: string, parsedCommand: ParsedCommand }[] = [];

    for (let parameter of reflection.parameters) {
        if (parameter.userAttribs == undefined) continue;
        for (let attribute of parameter.userAttribs) {
            let command: ParsedCommand | null = null;

            if (!attribute.name.startsWith("playground_")) continue;

            let playground_attribute_name = attribute.name.slice(11);
            if (playground_attribute_name == "ZEROS") {
                if (parameter.type.kind != "resource" || parameter.type.baseShape != "structuredBuffer") {
                    return {
                        succ: false,
                        message: `${playground_attribute_name} attribute cannot be applied to ${parameter.name}, it only supports buffers`,
                    };
                }
                command = {
                    type: playground_attribute_name,
                    count: attribute.arguments[0] as number,
                    elementSize: getSize(parameter.type.resultType),
                };
            } else if (playground_attribute_name == "SAMPLER") {
                if (parameter.type.kind != "samplerState") {
                    return {
                        succ: false,
                        message: `${playground_attribute_name} attribute cannot be applied to ${parameter.name}, it only supports samplers`,
                    };
                }
                command = {
                    type: playground_attribute_name
                };
            } else if (playground_attribute_name == "RAND") {
                if (parameter.type.kind != "resource" || parameter.type.baseShape != "structuredBuffer") {
                    return {
                        succ: false,
                        message: `${playground_attribute_name} attribute cannot be applied to ${parameter.name}, it only supports buffers`,
                    };
                }
                if (parameter.type.resultType.kind != "scalar" || parameter.type.resultType.scalarType != "float32") {
                    return {
                        succ: false,
                        message: `${playground_attribute_name} attribute cannot be applied to ${parameter.name}, it only supports float buffers`,
                    };
                }
                command = {
                    type: playground_attribute_name,
                    count: attribute.arguments[0] as number
                };
            } else if (playground_attribute_name == "BLACK") {
                if (parameter.type.kind != "resource" || parameter.type.baseShape != "texture2D") {
                    return {
                        succ: false,
                        message: `${playground_attribute_name} attribute cannot be applied to ${parameter.name}, it only supports 2D textures`,
                    };
                }
                command = {
                    type: playground_attribute_name,
                    width: attribute.arguments[0] as number,
                    height: attribute.arguments[1] as number,
                };
            } else if (playground_attribute_name == "BLACK_SCREEN") {
                if (parameter.type.kind != "resource" || parameter.type.baseShape != "texture2D") {
                    return {
                        succ: false,
                        message: `${playground_attribute_name} attribute cannot be applied to ${parameter.name}, it only supports 2D textures`,
                    };
                }
                command = {
                    type: playground_attribute_name,
                    width_scale: attribute.arguments[0] as number,
                    height_scale: attribute.arguments[1] as number,
                };
            } else if (playground_attribute_name == "URL") {
                if (parameter.type.kind != "resource" || parameter.type.baseShape != "texture2D") {
                    return {
                        succ: false,
                        message: `${playground_attribute_name} attribute cannot be applied to ${parameter.name}, it only supports 2D textures`,
                    };
                }
                let slangAccess: keyof typeof ACCESS_MAP = parameter.type.access || "read";
                let access = ACCESS_MAP[slangAccess];

                let scalarType: ScalarType;
                let componentCount: 1 | 2 | 3 | 4;
                if (parameter.type.resultType.kind == "scalar") {
                    componentCount = 1;
                    scalarType = parameter.type.resultType.scalarType;
                } else if (parameter.type.resultType.kind == "vector") {
                    componentCount = parameter.type.resultType.elementCount;
                    if (parameter.type.resultType.elementType.kind != "scalar") return {
                        succ: false,
                        message: `Unhandled inner type for ${name}`,
                    };
                    scalarType = parameter.type.resultType.elementType.scalarType;
                } else {
                    return {
                        succ: false,
                        message: `Unhandled inner type for ${name}`,
                    };
                }

                let format: GPUTextureFormat;
                if (parameter.format) {
                    format = webgpuFormatfromSlangFormat(parameter.format);
                } else {
                    try {
                        format = getTextureFormat(componentCount, scalarType, access);
                    } catch (e) {
                        if (e instanceof Error)
                            return {
                        succ: false,
                        message: `Could not get texture format for ${name}: ${e.message}`,
                    };
                        else
                            return {
                        succ: false,
                        message: `Could not get texture format for ${name}`,
                    };
                    }
                }

                command = {
                    type: playground_attribute_name,
                    url: attribute.arguments[0] as string,
                    format,
                };
            } else if (playground_attribute_name == "TIME") {
                if (parameter.type.kind != "scalar" || !parameter.type.scalarType.startsWith("float") || parameter.binding.kind != "uniform") {
                    return {
                        succ: false,
                        message: `${playground_attribute_name} attribute cannot be applied to ${parameter.name}, it only supports floats`,
                    };
                }
                command = {
                    type: playground_attribute_name,
                    offset: parameter.binding.offset,
                };
            } else if (playground_attribute_name == "FRAME_ID") {
                if (parameter.type.kind != "scalar" || !parameter.type.scalarType.startsWith("float") || parameter.binding.kind != "uniform") {
                    return {
                        succ: false,
                        message: `${playground_attribute_name} attribute cannot be applied to ${parameter.name}, it only supports floats`,
                    };
                }
                command = {
                    type: playground_attribute_name,
                    offset: parameter.binding.offset,
                };
            } else if (playground_attribute_name == "MOUSE_POSITION") {
                if (parameter.type.kind != "vector" || parameter.type.elementCount <= 3 || parameter.type.elementType.kind != "scalar" || !parameter.type.elementType.scalarType.startsWith("float") || parameter.binding.kind != "uniform") {
                    return {
                        succ: false,
                        message: `${playground_attribute_name} attribute cannot be applied to ${parameter.name}, it only supports float vectors`,
                    };
                }
                command = {
                    type: playground_attribute_name,
                    offset: parameter.binding.offset,
                };
            } else if (playground_attribute_name == "SLIDER") {
                if (parameter.type.kind != "scalar" || !parameter.type.scalarType.startsWith("float") || parameter.binding.kind != "uniform") {
                    return {
                        succ: false,
                        message: `${playground_attribute_name} attribute cannot be applied to ${parameter.name}, it only supports floats`,
                    };
                }
                command = {
                    type: playground_attribute_name,
                    default: attribute.arguments[0] as number,
                    min: attribute.arguments[1] as number,
                    max: attribute.arguments[2] as number,
                    elementSize: parameter.binding.size,
                    offset: parameter.binding.offset,
                };
            } else if (playground_attribute_name == "COLOR_PICK") {
                if (parameter.type.kind != "vector" || parameter.type.elementCount <= 2 || parameter.type.elementType.kind != "scalar" || !parameter.type.elementType.scalarType.startsWith("float") || parameter.binding.kind != "uniform") {
                    return {
                        succ: false,
                        message: `${playground_attribute_name} attribute cannot be applied to ${parameter.name}, it only supports float vectors`,
                    };
                }
                command = {
                    type: playground_attribute_name,
                    default: attribute.arguments as [number, number, number],
                    elementSize: parseInt(parameter.type.elementType.scalarType.slice(5)) / 8,
                    offset: parameter.binding.offset,
                };
            } else if (playground_attribute_name == "KEY") {
                // Only allow on scalar uniforms (float or int)
                if (parameter.type.kind != "scalar" || parameter.binding.kind != "uniform") {
                    return {
                        succ: false,
                        message: `${playground_attribute_name} attribute can only be applied to scalar uniforms`,
                    };
                }
                if (!attribute.arguments || attribute.arguments.length !== 1 || typeof attribute.arguments[0] !== "string") {
                    return {
                        succ: false,
                        message: `${playground_attribute_name} attribute requires a single string argument (the key name)`,
                    };
                }
                command = {
                    type: playground_attribute_name,
                    key: attribute.arguments[0] as string,
                    offset: parameter.binding.offset,
                    scalarType: parameter.type.scalarType,
                };
            }

            if (command != null) {
                commands.push({
                    resourceName: parameter.name,
                    parsedCommand: command
                });
            }
        }
    }

    return {
        succ: true,
        result: commands,
    };
}

export function getUniformSize(reflection: ReflectionJSON): number {
    let size = 0;

    for (let parameter of reflection.parameters) {
        if (parameter.binding.kind != "uniform") continue;
        size = Math.max(size, parameter.binding.offset + parameter.binding.size)
    }

    return roundUpToNearest(size, 16)
}

export function isControllerRendered(controller: UniformController) {
    return controller.type == "SLIDER" || controller.type == "COLOR_PICK";
}

export function getUniformControllers(resourceCommands: ResourceCommand[]): UniformController[] {
    let controllers: UniformController[] = [];
    for (let resourceCommand of resourceCommands) {
        if (resourceCommand.parsedCommand.type == 'SLIDER') {
            controllers.push({
                type: resourceCommand.parsedCommand.type,
                buffer_offset: resourceCommand.parsedCommand.offset,
                name: resourceCommand.resourceName,
                value: resourceCommand.parsedCommand.default,
                min: resourceCommand.parsedCommand.min,
                max: resourceCommand.parsedCommand.max,
            })
        } else if (resourceCommand.parsedCommand.type == 'COLOR_PICK') {
            controllers.push({
                type: resourceCommand.parsedCommand.type,
                buffer_offset: resourceCommand.parsedCommand.offset,
                name: resourceCommand.resourceName,
                value: resourceCommand.parsedCommand.default,
            })
        } else if (resourceCommand.parsedCommand.type == 'TIME') {
            controllers.push({
                type: resourceCommand.parsedCommand.type,
                buffer_offset: resourceCommand.parsedCommand.offset,
            })
        } else if (resourceCommand.parsedCommand.type == 'FRAME_ID') {
            controllers.push({
                type: resourceCommand.parsedCommand.type,
                buffer_offset: resourceCommand.parsedCommand.offset,
            })
        } else if (resourceCommand.parsedCommand.type == 'MOUSE_POSITION') {
            controllers.push({
                type: resourceCommand.parsedCommand.type,
                buffer_offset: resourceCommand.parsedCommand.offset,
            })
        } else if (resourceCommand.parsedCommand.type == 'KEY') {
            controllers.push({
                type: resourceCommand.parsedCommand.type,
                buffer_offset: resourceCommand.parsedCommand.offset,
                key: resourceCommand.parsedCommand.key,
                scalarType: resourceCommand.parsedCommand.scalarType,
            })
        }
    }
    return controllers;
}

export function parseCallCommands(reflection: ReflectionJSON): Result<CallCommand[]> {
    const callCommands: CallCommand[] = [];

    for (let entryPoint of reflection.entryPoints) {
        if (!entryPoint.userAttribs) continue;

        const fnName = entryPoint.name;
        let callCommand: CallCommand | null = null;
        let callOnce: boolean = false;

        for (let attribute of entryPoint.userAttribs) {
            if (attribute.name === "playground_CALL_SIZE_OF") {
                const resourceName = attribute.arguments[0] as string;
                const resourceReflection = reflection.parameters.find((param) => param.name === resourceName);

                if (!resourceReflection) {
                    return {
                        succ: false,
                        message: `Cannot find resource ${resourceName} for ${fnName} CALL command`,
                    };
                }

                let elementSize: number | undefined = undefined;
                if (resourceReflection.type.kind === "resource" && resourceReflection.type.baseShape === "structuredBuffer") {
                    elementSize = getSize(resourceReflection.type.resultType);
                }

                if (callCommand != null) {
                    return {
                        succ: false,
                        message: `Multiple CALL commands found for ${fnName}`,
                    };
                }
                callCommand = {
                    type: "RESOURCE_BASED",
                    fnName,
                    resourceName,
                    elementSize
                };
            } else if (attribute.name === "playground_CALL") {
                if (callCommand != null) {
                    return {
                        succ: false,
                        message: `Multiple CALL commands found for ${fnName}`,
                    };
                }
                callCommand = {
                    type: "FIXED_SIZE",
                    fnName,
                    size: attribute.arguments as number[]
                };
            } else if (attribute.name === "playground_CALL_ONCE") {
                if (callOnce) {
                    return {
                        succ: false,
                        message: `Multiple CALL ONCE commands found for ${fnName}`,
                    };
                }
                callOnce = true;
            }
        }

        if (callCommand != null) {
            callCommands.push({
                ...callCommand,
                callOnce
            });
        }
    }

    return {
        succ: true,
        result: callCommands
    };
}

type FormatSpecifier = {
    type: "text",
    value: string,
} | {
    type: "specifier",
    flags: string,
    width: number | null,
    precision: number | null,
    specifierType: string,
};

function parsePrintfFormat(formatString: string): FormatSpecifier[] {
    const formatSpecifiers: FormatSpecifier[] = [];
    const regex = /%([-+ #0]*)(\d*)(\.\d+)?([diufFeEgGxXosc])/g;
    let lastIndex = 0;

    let match;
    while ((match = regex.exec(formatString)) !== null) {
        const [fullMatch, flags, width, precision, type] = match;
        const literalText = formatString.slice(lastIndex, match.index);

        // Add literal text before the match as a token, if any
        if (literalText) {
            formatSpecifiers.push({ type: 'text', value: literalText });
        }

        let precision_text = precision ? precision.slice(1) : null; // remove leading '.'
        let precision_number = precision_text ? parseInt(precision_text) : null;

        let width_number = width ? parseInt(width) : null;

        // Add the format specifier as a token
        formatSpecifiers.push({
            type: 'specifier',
            flags: flags || '',
            width: width_number,
            precision: precision_number,
            specifierType: type
        });

        lastIndex = regex.lastIndex;
    }

    // Add any remaining literal text after the last match
    if (lastIndex < formatString.length) {
        formatSpecifiers.push({ type: 'text', value: formatString.slice(lastIndex) });
    }

    return formatSpecifiers;
}

function formatPrintfString(parsedTokens: FormatSpecifier[], data: any[]) {
    let result = '';
    let dataIndex = 0;

    parsedTokens.forEach((token) => {
        if (token.type === 'text') {
            result += token.value;
        }
        else if (token.type === 'specifier') {
            const value = data[dataIndex++];
            result += formatSpecifier(value, token);
        }
    });

    return result;
}

// Helper function to format each specifier
function formatSpecifier(value: string, { flags, width, precision, specifierType }: FormatSpecifier & { type: 'specifier' }) {
    let formattedValue;
    let specifiedPrecision = precision != null;
    if (precision == null)
        precision = 6; //eww magic number
    switch (specifierType) {
        case 'd':
        case 'i': // Integer (decimal)
            if (typeof value !== "number") throw new Error("Invalid state");

            let valueAsSignedInteger = value | 0;
            formattedValue = valueAsSignedInteger.toString();
            break;
        case 'u': // Unsigned integer
            formattedValue = Math.abs(parseInt(value)).toString();
            break;
        case 'o': // Octal
            formattedValue = Math.abs(parseInt(value)).toString(8);
            break;
        case 'x': // Hexadecimal (lowercase)
            formattedValue = Math.abs(parseInt(value)).toString(16);
            break;
        case 'X': // Hexadecimal (uppercase)
            formattedValue = Math.abs(parseInt(value)).toString(16).toUpperCase();
            break;
        case 'f':
        case 'F': // Floating-point
            formattedValue = parseFloat(value).toFixed(precision);
            break;
        case 'e': // Scientific notation (lowercase)
            formattedValue = parseFloat(value).toExponential(precision);
            break;
        case 'E': // Scientific notation (uppercase)
            formattedValue = parseFloat(value).toExponential(precision).toUpperCase();
            break;
        case 'g':
        case 'G': // Shortest representation of floating-point
            formattedValue = parseFloat(value).toPrecision(precision);
            break;
        case 'c': // Character
            formattedValue = String.fromCharCode(parseInt(value));
            break;
        case 's': // String
            formattedValue = String(value);
            if (specifiedPrecision) {
                formattedValue = formattedValue.slice(0, precision);
            }
            break;
        case '%': // Literal '%'
            return '%';
        default:
            throw new Error(`Unsupported specifier: ${specifierType}`);
    }

    // Handle width and flags (like zero-padding, space, left alignment, sign)
    if (width) {
        const paddingChar = flags.includes('0') && !flags.includes('-') ? '0' : ' ';
        const isLeftAligned = flags.includes('-');
        const needsSign = flags.includes('+') && parseFloat(value) >= 0;
        const needsSpace = flags.includes(' ') && !needsSign && parseFloat(value) >= 0;

        if (needsSign) {
            formattedValue = '+' + formattedValue;
        }
        else if (needsSpace) {
            formattedValue = ' ' + formattedValue;
        }

        if (formattedValue.length < width) {
            const padding = paddingChar.repeat(width - formattedValue.length);
            formattedValue = isLeftAligned ? formattedValue + padding : padding + formattedValue;
        }
    }

    return formattedValue;
}

// // Example usage
// const formatString = "Int: %d, Unsigned: %u, Hex: %X, Float: %8.2f, Sci: %e, Char: %c, Str: %.5s!";
// const parsedTokens = parsePrintfFormat(formatString);
// const data = [42, -42, 255, 3.14159, 0.00001234, 65, "Hello, world"];
// const output = formatPrintfString(parsedTokens, data);
// console.log(output);



// This is the definition of the printf buffer.
// struct FormattedStruct
// {
//     uint32_t type = 0xFFFFFFFF;
//     uint32_t low = 0;
//     uint32_t high = 0;
// };
//

export function parsePrintfBuffer(hashedStrings: HashedStringData, printfValueResource: GPUBuffer, bufferElementSize: number) {
    // Read the printf buffer
    const printfBufferArray = new Uint32Array(printfValueResource.getMappedRange())

    let elementIndex = 0;
    let numberElements = printfBufferArray.byteLength / bufferElementSize;

    // TODO: We currently doesn't support 64-bit data type (e.g. uint64_t, int64_t, double, etc.)
    // so 32-bit array should be able to contain everything we need.
    let dataArray = [];
    const elementSizeInWords = bufferElementSize / 4;
    let outStrArry = [];
    let formatString = "";
    for (elementIndex = 0; elementIndex < numberElements; elementIndex++) {
        let offset = elementIndex * elementSizeInWords;
        const type = printfBufferArray[offset];
        switch (type) {
            case 1: // format string
                formatString = hashedStrings[(printfBufferArray[offset + 1] << 0)]!;  // low field
                break;
            case 2: // normal string
                dataArray.push(hashedStrings[(printfBufferArray[offset + 1] << 0)]);  // low field
                break;
            case 3: // integer
                dataArray.push(printfBufferArray[offset + 1]);  // low field
                break;
            case 4: // float
                const floatData = reinterpretUint32AsFloat(printfBufferArray[offset + 1]);
                dataArray.push(floatData);                      // low field
                break;
            case 5: // TODO: We can't handle 64-bit data type yet.
                dataArray.push(0);                              // low field
                break;
            case 0xFFFFFFFF:
                {
                    const parsedTokens = parsePrintfFormat(formatString);
                    const output = formatPrintfString(parsedTokens, dataArray);
                    outStrArry.push(output);
                    formatString = "";
                    dataArray = [];
                    if (elementIndex < numberElements - 1) {
                        const nextOffset = offset + elementSizeInWords;
                        // advance to the next element to see if it's a format string, if it's not we just early return
                        // the results, otherwise just continue processing.
                        if (printfBufferArray[nextOffset] != 1)          // type field
                        {
                            return outStrArry;
                        }
                    }
                    break;
                }
        }
    }

    if (formatString != "") {
        // If we are here, it means that the printf buffer is used up, and we are in the middle of processing
        // one printf string, so we are still going to format it, even though there could be some data missing, which
        // will be shown as 'undef'.
        const parsedTokens = parsePrintfFormat(formatString);
        const output = formatPrintfString(parsedTokens, dataArray);
        outStrArry.push(output);
        outStrArry.push("Print buffer is out of boundary, some data is missing!!!");
    }

    return outStrArry;
}

export async function fetchWithProgress(url: string, onProgress: { (loaded: number, total: number): void; }) {
    const response = await fetch(url);
    const contentLength = response.headers.get('Content-Length');

    if (!contentLength) {
        console.warn('Content-Length header is missing.');
        return new Uint8Array(await response.arrayBuffer());
    }

    let total = contentLength ? parseInt(contentLength, 10) : 8 * 1024 * 1024; // Default to 8 MB if unknown
    let buffer = new Uint8Array(total); // Initial buffer
    let position = 0; // Tracks the current position in the buffer

    if (!response.body) {
        // Probably needs to be handled properly
        throw new Error("No response body");
    }
    const reader = response.body.getReader();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // Ensure buffer has enough space for the next chunk
        if (position + value.length > buffer.length) {
            // Double the buffer size
            let newBuffer = new Uint8Array(buffer.length * 2);
            newBuffer.set(buffer, 0); // Copy existing data to the new buffer
            buffer = newBuffer;
        }

        // Copy the chunk into the buffer
        buffer.set(value, position);
        position += value.length;

        if (contentLength) {
            onProgress(position, total); // Update progress if content length is known
        }
    }

    return buffer;
}

export function checkShaderType(userSource: string) {
    // we did a pre-filter on the user input source code.
    let shaderTypes = RUNNABLE_ENTRY_POINT_NAMES.filter((entryPoint) => userSource.includes(entryPoint));

    // Only one of the main function should be defined.
    // In this case, we will know that the shader is not runnable, so we can only compile it.
    if (shaderTypes.length !== 1)
        return null;

    return shaderTypes[0];
}