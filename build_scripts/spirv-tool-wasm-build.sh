#!/bin/bash

if [ ! -d emsdk ]
then
    git clone https://github.com/emscripten-core/emsdk.git emsdk
fi

pushd emsdk
	sed -i 's/\r$//' emsdk emsdk_env.sh
	/bin/sh ./emsdk install latest
	/bin/sh ./emsdk activate latest
	source ./emsdk_env.sh
popd

if [ ! -d spirv-tools ]
then
	git clone https://github.com/KhronosGroup/SPIRV-Tools.git spirv-tools
fi

pushd spirv-tools
git checkout vulkan-sdk-1.3.290.0

python3 utils/git-sync-deps

# add an additional option to emcc command
sed -i 's/\r$//' source/wasm/build.sh
sed -i 's/-s MODULARIZE \\/-s MODULARIZE -s SINGLE_FILE -s ENVIRONMENT=worker\\/' source/wasm/build.sh

bash -x source/wasm/build.sh

cp out/web/spirv-tools.js ../
cp out/web/spirv-tools.d.ts ../

# Also keep the default (web worker) as spirv-tools.js/d.ts for backward compatibility
cp ../spirv-tools.js ../spirv-tools.worker.js
cp ../spirv-tools.d.ts ../spirv-tools.worker.d.ts

# --- Build for Node.js ---
# Patch build.sh for Node.js build
sed -i 's/-s ENVIRONMENT=worker/-s ENVIRONMENT=node/' source/wasm/build.sh

bash -x source/wasm/build.sh

# Copy and rename output for node
cp out/web/spirv-tools.js ../spirv-tools.node.js
cp out/web/spirv-tools.d.ts ../spirv-tools.node.d.ts
popd
