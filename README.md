# Language extension for Slang shading language

This extension provides IDE service for the Slang and HLSL shading languages.

## Features

Features include:
- Enhanced semantic highlighting: user-defined types, variables, parameters and property will be highlighted.
- Auto completion: show suggestions of object/type members and HLSL semantics.
- Function signature help: view function sigatures at callsites.
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

Please report issues of this extension at https://github.com/shader-slang/slang-vscode-extension/issues
