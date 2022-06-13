# Language extension for Slang shading language

This is the official Visual Studio Code extension for the Slang shading language. Powered by the Slang shader compiler, this extension provides accurate coding assist for both Slang and HLSL.

Both Slang and this extension are open source projects on GitHub. We welcome feedback and contributions. Please report issues or suggest improvements at https://github.com/shader-slang/slang-vscode-extension/issues


## Features

This extension provides the following assisting features:
- Enhanced semantic highlighting: user-defined types, variables, parameters and properties will be highlighted.
- Code completion: show suggestions of object/type members and HLSL semantics.
- Function signature help: view function signatures at call sites.
- Hover information: displays the signature and documentation for the symbol that your mouse is hovering over.
- Go to definition: jumps to the source location that defines the current symbol.
- Diagnostics: displays current compilation errors.

## Demo

Auto completion and signature help:  
![Auto completion and signature help](doc/member-completion.gif)

HLSL Semantics suggestions:
![](doc/hlsl-semantic-completion.gif)

Goto definition:  
![Goto definition](doc/goto-def.gif)

## Configurations

You can specifiy the set of predefined preprocessor macros that the language server will use in extension settings. This will help the language server to provide more accurate result.

## For more information

* [Slang public repository](http://github.com/shader-slang/slang)
* [Slang Visual Studio Code Extension repository](https://github.com/shader-slang/slang-vscode-extension)

