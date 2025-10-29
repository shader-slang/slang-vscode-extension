npm install
npm run compile
npm install -g @vscode/vsce

target_build() {
  TEMP_DIR="$(mktemp -d)"
  ZIP="$1"
  TARGET="$2"
  TEMP_EXECUTABLE="$3"
  shift 3
  # Remaining arguments are library patterns (may include wildcards)
  TEMP_LIBRARY_PATTERNS=("$@")

  echo "extracting $ZIP"
  unzip -n "$ZIP" -d "$TEMP_DIR"

  echo "installing binaries for $TARGET"
  mkdir -p "./server/bin/$TARGET"
  cp "$TEMP_DIR/$TEMP_EXECUTABLE" ./server/bin/"$TARGET"/

  # Copy libraries, expanding wildcards with temp directory prefix
  for pattern in "${TEMP_LIBRARY_PATTERNS[@]}"; do
    # Expand the pattern with TEMP_DIR prefix (unquoted to allow glob expansion)
    for file in $TEMP_DIR/$pattern; do
      if [ -e "$file" ]; then
        cp "$file" ./server/bin/"$TARGET"/
      fi
    done
  done

  chmod +x ./server/bin/"$TARGET"/*

  echo "building for $TARGET"
  vsce package --target "$TARGET"

  echo "cleanup for $TARGET"
  rm -rf $TEMP_DIR
  rm -rf ./server/bin/
}

echo "updating .vscodeignore for native builds"
cp .vscodeignore .vscodeignore.bak
# Exclude web files for native builds
echo '' >> .vscodeignore
echo 'media/*.worker.js' >> .vscodeignore
echo 'server/dist/browserServerMain.js' >> .vscodeignore

target_build "$WIN32_X64_ZIP" win32-x64 bin/slangd.exe bin/slang.dll bin/slang-compiler.dll bin/slang-glsl-module.dll
target_build "$WIN32_ARM64_ZIP" win32-arm64 bin/slangd.exe bin/slang.dll bin/slang-compiler.dll bin/slang-glsl-module.dll
target_build "$LINUX_X64_ZIP" linux-x64 bin/slangd lib/libslang.so lib/libslang-compiler.so\* lib/libslang-glsl-module\*.so
target_build "$LINUX_ARM64_ZIP" linux-arm64 bin/slangd lib/libslang.so lib/libslang-compiler.so\* lib/libslang-glsl-module\*.so
target_build "$DARWIN_X64_ZIP" darwin-x64 bin/slangd lib/libslang.dylib lib/libslang-compiler\*.dylib lib/libslang-glsl-module\*.dylib
target_build "$DARWIN_ARM64_ZIP" darwin-arm64 bin/slangd lib/libslang.dylib lib/libslang-compiler\*.dylib lib/libslang-glsl-module\*.dylib

echo "restoring .vscodeignore after native build ($TARGET)"
mv .vscodeignore.bak .vscodeignore

# For web build, exclude native/server files
echo "updating .vscodeignore for web build"
cp .vscodeignore .vscodeignore.bak
# Exclude native/server files for web build
echo '' >> .vscodeignore
echo 'media/*.node.js' >> .vscodeignore
echo 'server/dist/nativeServerMain.js' >> .vscodeignore

vsce package --target "web"

echo "restoring .vscodeignore after web build"
mv .vscodeignore.bak .vscodeignore