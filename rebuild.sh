#cd code-analyse
#tsc -b
#cd ..
#npm run compile
#cnpm install electron@6.0.0
#vsce
#node_modules/.bin/electron-rebuild -f -w better-sqlite3 -v 7

#npm install --save-dev electron-rebuild

# 每次运行"npm install"后，也运行这条命令
#./node_modules/.bin/electron-rebuild -f -w better-sqlite3 -v 7.1.11

#
#node_modules/electron-rebuild/lib/src/cli.js -f -w better-sqlite3 -v 7.1.11

# 在windows下如果上述命令遇到了问题，尝试这个：
#.\node_modules\.bin\electron-rebuild.cmd -f -w better-sqlite3 -v 7.1.11
#npm install node-gyp


