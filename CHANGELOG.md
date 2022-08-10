# Change Log
## v1.4.2
- Update default Clang-format style to be more conservative on line-break changes.
- Update Slang compiler version to v0.24.12 tu support new language features.

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
