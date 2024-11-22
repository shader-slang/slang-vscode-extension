npm install
npm install -g @vscode/vsce

ls ./
mkdir -p ./tmp
echo "extracting $WIN32_X64_ZIP"
unzip -n $WIN32_X64_ZIP -d ./tmp
mkdir -p ./server/bin/win32-x64
cp ./tmp/bin/slang.dll ./server/bin/win32-x64/slang.dll
cp ./tmp/bin/slangd.exe ./server/bin/win32-x64/slangd.exe
vsce package --target win32-x64
rm -rf ./tmp

mkdir -p ./tmp
echo "extracting $WIN32_ARM64_ZIP"
unzip -n $WIN32_ARM64_ZIP -d ./tmp
rm -rf ./server/bin/
mkdir -p ./server/bin/win32-arm64
cp ./tmp/bin/slang.dll ./server/bin/win32-arm64/slang.dll
cp ./tmp/bin/slangd.exe ./server/bin/win32-arm64/slangd.exe
vsce package --target win32-arm64
rm -rf ./tmp

mkdir -p ./tmp
echo "extracting $LINUX_X64_ZIP"
unzip -n $LINUX_X64_ZIP -d ./tmp
rm -rf ./server/bin/
mkdir -p ./server/bin/linux-x64
cp ./tmp/lib/libslang.so ./server/bin/linux-x64/libslang.so
cp ./tmp/bin/slangd ./server/bin/linux-x64/slangd
chmod +x ./server/bin/linux-x64/slangd
vsce package --target linux-x64
rm -rf ./tmp

mkdir -p ./tmp
echo "extracting $LINUX_ARM64_ZIP"
unzip -n $LINUX_ARM64_ZIP -d ./tmp
rm -rf ./server/bin/
mkdir -p ./server/bin/linux-arm64
cp ./tmp/lib/libslang.so ./server/bin/linux-arm64/libslang.so
cp ./tmp/bin/slangd ./server/bin/linux-arm64/slangd
chmod +x ./server/bin/linux-arm64/slangd
vsce package --target linux-arm64
rm -rf ./tmp

mkdir -p ./tmp
echo "extracting $DARWIN_X64_ZIP"
unzip -n $DARWIN_X64_ZIP -d ./tmp
rm -rf ./server/bin/
mkdir -p ./server/bin/darwin-x64
cp ./tmp/lib/libslang.dylib ./server/bin/darwin-x64/libslang.dylib
cp ./tmp/bin/slangd ./server/bin/darwin-x64/slangd
chmod +x ./server/bin/darwin-x64/slangd
vsce package --target darwin-x64
rm -rf ./tmp

mkdir -p ./tmp
echo "extracting $DARWIN_ARM64_ZIP"
unzip -n $DARWIN_ARM64_ZIP -d ./tmp
rm -rf ./server/bin/
mkdir -p ./server/bin/darwin-arm64
cp ./tmp/lib/libslang.dylib ./server/bin/darwin-arm64/libslang.dylib
cp ./tmp/bin/slangd ./server/bin/darwin-arm64/slangd
chmod +x ./server/bin/darwin-arm64/slangd
vsce package --target darwin-arm64
rm -rf ./tmp