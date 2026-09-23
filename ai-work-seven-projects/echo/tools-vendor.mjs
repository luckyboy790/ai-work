/** Vendor only the exact engine version used by this project. No runtime CDN. */
import {copyFile,mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
try{
 const pkg=JSON.parse(await readFile(path.join(root,'node_modules/three/package.json'),'utf8'));
 if(pkg.version!=='0.180.0')throw new Error(`需要 three@0.180.0；实际发现 ${pkg.version}。请在项目目录执行 npm ci。`);
 await mkdir(path.join(root,'vendor'),{recursive:true});
 for(const f of ['three.module.js','three.core.js'])await copyFile(path.join(root,'node_modules/three/build',f),path.join(root,'vendor',f));
 await copyFile(path.join(root,'node_modules/three/LICENSE'),path.join(root,'vendor/THREE-LICENSE.txt'));
 console.log('Three.js 0.180.0 已复制到 vendor。运行时不访问 CDN。');
}catch(error){
 console.error('依赖准备失败：'+error.message+'\n请先运行 npm ci，再运行 npm run vendor。');process.exitCode=1;
}
