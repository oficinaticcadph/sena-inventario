import JSZip from 'jszip';
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const zip=new JSZip();
async function add(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const filename=path.join(directory,entry.name);if(entry.isDirectory())await add(filename);else zip.file(filename.replaceAll('\\','/'),await readFile(filename));}}
for(const directory of ['src','prisma','templates','public','scripts','tests'])await add(directory);
for(const filename of ['package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','postcss.config.mjs','.env.example','.gitignore','.vercelignore','.prettierrc.json','.prettierignore','README.md'])zip.file(filename,await readFile(filename));
await mkdir('outputs',{recursive:true});
await writeFile('outputs/SENA-Hoja-de-Vida-codigo-fuente.zip',await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
console.log('Código fuente empaquetado. No incluye inventario, base local ni credenciales.');
