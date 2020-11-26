#!/bin/sh
sh build.sh
scp -r libs widyhu.dev:/data/cpptips/
scp -r server/out widyhu.dev:/data/cpptips/server/
scp -r client/out widyhu.dev:/data/cpptips/client
scp package.json widyhu.dev:/data/cpptips/
scp -r resources widyhu.dev:/data/cpptips/

node code-analyse/src/worker/checkNeedUpdate.js 
scp list.js widyhu.dev:/data/cpptips/
cp -rf libs ../cpptips_proj/
cp -rf server ../cpptips_proj/
cp -rf client ../cpptips_proj/
cp -rf package.json ../cpptips_proj/package.json
cp -rf tsconfig.json ../cpptips_proj/
cp -rf publish.sh ../cpptips_proj/
cp -rf build.sh ../cpptips_proj/
cp -rf README.md ../cpptips_proj/
cp -rf code-analyse ../cpptips_proj/
cp -rf resources ../cpptips_proj/
cp -rf data ../cpptips_proj/
cp -rf config ../cpptips_proj/
cp -rf bin ../cpptips_proj/
cp -rf .vscode ../cpptips_proj/
cp -rf .vscodeignore ../cpptips_proj/

rm -rf ../cpptips_proj/node_modules
rm -rf ../cpptips_proj/server/node_modules
rm -rf ../cpptips_proj/client/node_modules

#scp -r libs root@193.112.152.71:/data/webroot/
#scp -r server/out root@193.112.152.71:/data/webroot/
#scp -r client/out root@193.112.152.71:/data/webroot/
#scp -r resources widyhu.dev:/data/cpptips/
#scp package.json root@193.112.152.71:/data/webroot/
#scp list.js root@193.112.152.71:/data/webroot/
#vsce publish patch
#vsce publish minor
#vsce publish major

#cd /data/mm64/widyhu/.vscode-server/extensions/widyhu.cpptips-0.1.9/node_modules/better-sqlite3 && /data/mm64/widyhu/.vscode-server/bin/2aae1f26c72891c399f860409176fe435a154b13/node ../node-gyp/bin/node-gyp.js configure && /data/mm64/widyhu/.vscode-server/bin/2aae1f26c72891c399f860409176fe435a154b13/node ../node-gyp/bin/node-gyp.js rebuild&& cd /data/mm64/widyhu/.vscode-server/extensions/widyhu.cpptips-0.1.9/node_modules/integer && /data/mm64/widyhu/.vscode-server/bin/2aae1f26c72891c399f860409176fe435a154b13/node ../node-gyp/bin/node-gyp.js configure && /data/mm64/widyhu/.vscode-server/bin/2aae1f26c72891c399f860409176fe435a154b13/node ../node-gyp/bin/node-gyp.js rebuild
