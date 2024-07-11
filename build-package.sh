npm install
npm install -g @vscode/vsce

ls ./
mkdir -p ./tmp
echo "extracting $WIN32ZIP"
unzip -n $WIN32ZIP -d ./tmp
mkdir -p ./server/bin/win-x64
cp ./tmp/bin/slang.dll ./server/bin/win-x64/slang.dll
cp ./tmp/bin/slangd.exe ./server/bin/win-x64/slangd.exe
vsce package --target win32-x64
rm -rf ./tmp

mkdir -p ./tmp
echo "extracting $WINARMZIP"
unzip -n $WINARMZIP -d ./tmp
rm -rf ./server/bin/
mkdir -p ./server/bin/win-arm64
cp ./tmp/bin/slang.dll ./server/bin/win-arm64/slang.dll
cp ./tmp/bin/slangd.exe ./server/bin/win-arm64/slangd.exe
vsce package --target win32-arm64
rm -rf ./tmp

mkdir -p ./tmp
echo "extracting $LINUX64ZIP"
unzip -n $LINUX64ZIP -d ./tmp
rm -rf ./server/bin/
mkdir -p ./server/bin/linux-x64
cp ./tmp/lib/libslang.so ./server/bin/linux-x64/libslang.so
cp ./tmp/bin/slangd ./server/bin/linux-x64/slangd
chmod +x ./server/bin/linux-x64/slangd
vsce package --target linux-x64
rm -rf ./tmp

mkdir -p ./tmp
echo "extracting $MACOSX64ZIP"
unzip -n $MACOSX64ZIP -d ./tmp
rm -rf ./server/bin/
mkdir -p ./server/bin/darwin-x64
cp ./tmp/lib/libslang.dylib ./server/bin/darwin-x64/libslang.dylib
cp ./tmp/bin/slangd ./server/bin/darwin-x64/slangd
chmod +x ./server/bin/darwin-x64/slangd
vsce package --target darwin-x64
rm -rf ./tmp

mkdir -p ./tmp
echo "extracting $MACOSAARCH64ZIP"
unzip -n $MACOSAARCH64ZIP -d ./tmp
rm -rf ./server/bin/
mkdir -p ./server/bin/darwin-arm64
cp ./tmp/lib/libslang.dylib ./server/bin/darwin-arm64/libslang.dylib
cp ./tmp/bin/slangd ./server/bin/darwin-arm64/slangd
chmod +x ./server/bin/darwin-arm64/slangd
vsce package --target darwin-arm64
rm -rf ./tmp