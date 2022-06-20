# Change Log
## v1.2.1
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
