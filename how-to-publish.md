# How to publish extension to Marketplace

## Prerequisites
1. Visual Studio Code.
2. nodejs 14.0+
3. Run `npm install vsce`

**Important**: must package the extension in Linux to preserve the file permission of the language server.

## Steps
1. Download built artifacts of `slangd` and `slang.dll`, `libslang.so` for each platform and arch and place it under these directories:
   \server\bin\linux-x64\
   \server\bin\win-x32\
   \server\bin\win-x64\
2. Increase version number in `package.json`.
3. Make sure `slangd` has `execute` permission on linux.
4. Run `vsce publish` in the repo directory to publish to market place. Or:
   run `vsce package` to create a vsix file, and run `vsce publish --packageDir=<vsix-file>` to publish it.
