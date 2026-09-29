import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export class Store {
 constructor(directory){this.directory=directory;this.queue=Promise.resolve();}
 async get(id){if(!/^[a-zA-Z0-9_-]+$/.test(id))return null;try{return JSON.parse(await readFile(path.join(this.directory,id+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 async put(id,value){await mkdir(this.directory,{recursive:true});const file=path.join(this.directory,id+'.json');const temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(value,null,2));await rename(temporary,file);return value;}
 transaction(operation){const next=this.queue.then(operation);this.queue=next.catch(()=>{});return next;}
}
