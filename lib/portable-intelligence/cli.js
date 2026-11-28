#!/usr/bin/env node
'use strict';
// Local, review-only CLI. Does not open network sockets or connect to BONDS.
const fs=require('node:fs');
const path=require('node:path');
const {analyzeFile,MAX_BYTES}=require('./file-adapters');
const {createLocalOcr}=require('./local-ocr');
function usage(){process.stderr.write('Usage: bonds-document-intelligence <file> --workspace-id <uuid> [--type organization|contact] [--ocr-local]\n');}
async function main(args){
 const input=args[0], widIndex=args.indexOf('--workspace-id'),typeIndex=args.indexOf('--type');
 if(!input||input.startsWith('-')||widIndex<0||!args[widIndex+1]){usage();process.exitCode=2;return;}
 const workspaceId=args[widIndex+1], defaultType=typeIndex>=0?args[typeIndex+1]:null;
 const info=fs.statSync(input);
 if(!info.isFile()||info.size===0||info.size>MAX_BYTES)throw Error('INVALID_FILE_SIZE');
 const buffer=fs.readFileSync(input);
 const ocr=args.includes('--ocr-local')?createLocalOcr():null;
 const result=await analyzeFile({file:{filename:path.basename(input),buffer},workspaceId,defaultType,ocr});
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
main(process.argv.slice(2)).catch(err=>{process.stderr.write('ERROR: '+err.message+'\n');process.exitCode=1;});
