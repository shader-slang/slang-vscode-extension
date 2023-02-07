# Change Log

## v1.5.10
- Update to Slang v0.24.54.

## v1.5.9
- General bug fixes and update to Slang v0.24.53.

## v1.5.8
- Update to Slang v0.24.47.

## v1.5.7
- Added semantic highlighting for attributes.
- Changed auto-format behavior to no longer insert space between `{}`.
- Fixed an highlighting issue for interface-typed values.
- Update to Slang v0.24.46.

## v1.5.6
- Update to Slang v0.24.45

## v1.5.5
- Improved parser recovery around unknown function modifiers.
- Added keyword highlighting for auto-diff feature.
- Update to Slang v0.24.44

## v1.5.4
- Update to Slang v0.24.37, which brings experimental support for auto differentiation.
- Add `slang.slangdLocation` configuration to allow the extension to use custom built language server.

## v1.5.3
- Update to Slang v0.24.35, which brings support for `[ForceInline]`.

## v1.5.2
- Update to Slang v0.24.34, which brings support for multi-level `break`.
- Add missing highlighting for `uint` type.

## v1.5.1
- Fix a crash when parsing entry-point functions that has type errors in the signature.

## v1.5.0
- Release on Win-ARM64 and MacOS-ARM64.

## v1.4.7
- Add `slang.format.clangFormatFallbackStyle` setting that will be used when `style` is `file` but a `.clang-format` file is not found.
- Changed the default value of `slang.format.clangFormatStyle` to `file`.
- The default value of `slang.format.clangFormatFallbackStyle` is set to `{BasedOnStyle: Microsoft, BreakBeforeBraces: Allman, ColumnLimit: 0}`.

## v1.4.6
- Update to Slang v0.24.23, which brings support for `intptr_t`, `printf`, raw string literals and partial inference of generic arguments.
- Add highlighting for raw string literals.

## v1.4.5
- Update to Slang v0.24.15 to support the new builtin interfaces (`IArithmetic`, `IInteger`, `IFloat` etc.)
- Add syntax highlighting for `half`.

## v1.4.4
- Update to Slang v0.24.14 to support constant folding through interfaces (associated constants).

## v1.4.3
- Update to Slang v0.24.13, which brings more powerful constant folding.
- Allow deleting and retyping "," to trigger function signature info.

## v1.4.2
- Update default Clang-format style to be more conservative on line-break changes.
- Update Slang compiler version to v0.24.12 to support new language features.

## v1.4.1
- Prevent "." and "-" from commiting `include` suggestions.
- Add settings to disallow line-break changes in auto formatting.
- Format on paste no longer changes lines after the cursor position.
- Fix auto indentation after typing `{` following `if`, `while`, and `for`.

## v1.4.0
- Support auto completion for `include` and `import` paths.
- Display formatted doxygen comments in hover info.
- Reduced package size.

## v1.3.3
- Fine tuned code completion triggering conditions.
- Add configurations to turn on/off each individual type of inlay hints.
- Fixed a regression that caused the commit character configuration to have no effect.

## v1.3.2
- Update default clang-format style setting.

## v1.3.1
- Fine tuned completion and auto formatting experience to prevent them from triggering on unexpected situations.
- Fixed clang-format discovering logic on Linux.

## v1.3.0
- Auto formatting using clang-format.
- Inlay hints: show inline hints for parameter names and auto deduced types.
- Fixed a bug where setting predefined macros without a value caused language server to crash.

## v1.2.2
- Auto completion now provides suggestions for general types, expressions and bracket attributes in addition to members.
- Add configuration to turn on/off commit characters for auto completion.
- Support highlighting macro invocations.
- Support hover info for macro invocations.
- Support goto definition for #include and import.
- Performance improvements. Reduces auto completion/semantic highlighting reponse time by 50%.

## v1.2.0
- Supports document symbol outline feature.
- Add MacOS support.
- Fixed highlighting of `extension` decl's target type.
- Add missing highlight for several HLSL keywords.
- Stability fixes.

## v1.1.2
- Add configuration for search paths.
- Fix highlighting bug.
- Improved parser recovery around undefined macro invocations.

## v1.1.1
- Fixed several scenarios where completion failed to trigger.
- Fixed an issue that caused static variable members to be missing from static member completion suggestions.

## v1.1.0
- Improved performance when processing large files.
- Coloring property accessors and constructor calls.
- Exclude instance members in a static member completion query.
- Improved signature help cursor range check.
- Support configuring predefined preprocessor macros in extension settings.
- Add auto completion suggestions for HLSL semantics.
- Improved parser robustness.

## v1.0.7
- Further improves parser stability.
- Add coloring for missing hlsl keywords.

## v1.0.4
- Add commit characters for auto completion.
- Fixed parser crashes.

## v1.0.3
- Fixed file permission issue of the language server on linux.

## v1.0.2
- Fixed bugs in files that uses `#include`.
- Reduced diagnostic message update frequency.

## v1.0.1
- Package up javascript files for faster performance.
- Add icon.
- Add hlsl file extension.

## v0.0.1
- Initial release. Basic syntax highlighting support for Slang and HLSL.
