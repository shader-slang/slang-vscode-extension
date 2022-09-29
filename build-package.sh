npm install
npm install -g vsce

ls ./
mkdir -p ./tmp
echo "extracting $WIN32ZIP"
unzip -n $WIN32ZIP -d ./tmp
echo "extracting $LINUX64ZIP"
unzip -n $LINUX64ZIP -d ./tmp
echo "extracting $MACOSX64ZIP"
unzip -n $MACOSX64ZIP -d ./tmp

mkdir -p ./server/bin/win-x32
cp ./tmp/bin/windows-x86/release/slang.dll ./server/bin/win-x32/slang.dll
cp ./tmp/bin/windows-x86/release/slangd.exe ./server/bin/win-x32/slangd.exe
vsce package --target win32-ia32

mkdir -p ./server/bin/win-arm64
cp ./tmp/bin/windows-aarch64/release/slang.dll ./server/bin/win-arm64/slang.dll
cp ./tmp/bin/windows-aarch64/release/slangd.exe ./server/bin/win-arm64/slangd.exe
vsce package --target win32-arm64

rm -rf ./server/bin/
mkdir -p ./server/bin/linux-x64
cp ./tmp/bin/linux-x64/release/libslang.so ./server/bin/linux-x64/libslang.so
cp ./tmp/bin/linux-x64/release/slangd ./server/bin/linux-x64/slangd
chmod +x ./server/bin/linux-x64/slangd
vsce package --target linux-x64

rm -rf ./server/bin/
mkdir -p ./server/bin/darwin-x64
cp ./tmp/bin/macosx-x64/release/libslang.dylib ./server/bin/darwin-x64/libslang.dylib
cp ./tmp/bin/macosx-x64/release/slangd ./server/bin/darwin-x64/slangd
chmod +x ./server/bin/darwin-x64/slangd
vsce package --target darwin-x64

rm -rf ./server/bin/
mkdir -p ./server/bin/darwin-arm64
cp ./tmp/bin/macosx-aarch64/release/libslang.dylib ./server/bin/darwin-arm64/libslang.dylib
cp ./tmp/bin/macosx-aarch64/release/slangd ./server/bin/darwin-arm64/slangd
chmod +x ./server/bin/darwin-arm64/slangd
vsce package --target darwin-arm64