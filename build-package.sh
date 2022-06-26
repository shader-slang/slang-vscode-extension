npm install
npm install -g vsce

ls ./
mkdir -p ./bin
echo "extracting $WIN32ZIP"
unzip -n $WIN32ZIP -d ./bin
echo "extracting $LINUX64ZIP"
unzip -n $LINUX64ZIP -d ./bin

mkdir -p ./server/bin/win-x32
cp ./bin/bin/windows-x86/release/slang.dll ./server/bin/win-x32/slang.dll
cp ./bin/bin/windows-x86/release/slangd.exe ./server/bin/win-x32/slangd.exe
vsce package --target win32-ia32

rm -rf ./server/bin/
mkdir -p ./server/bin/linux-x64
cp ./bin/bin/linux-x64/release/libslang.so ./server/bin/linux-x64/libslang.so
cp ./bin/bin/linux-x64/release/slangd ./server/bin/linux-x64/slangd
chmod +x ./server/bin/linux-x64/slangd
vsce package --target linux-x64

rm -rf ./server/bin/
mkdir -p ./server/bin/darwin
unzip slang-macos-dist.zip -d ./server/bin/darwin/
chmod +x ./server/bin/darwin/slangd
vsce package --target darwin-x64