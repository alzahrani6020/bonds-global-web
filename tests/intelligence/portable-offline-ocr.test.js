'use strict';
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {createLocalOcr}=require('../../lib/portable-intelligence/local-ocr');
describe('portable offline OCR process boundary',()=>{
 function fakeSpawn(command,args,opts){
  expect(command).toBe('tesseract');
  expect(args).toEqual(['stdin','stdout','-l','ara+eng']);
  expect(opts.shell).toBe(false);
  const p=new EventEmitter();
  p.stdin=new PassThrough();p.stdout=new PassThrough();p.stderr=new PassThrough();
  p.kill=jest.fn();p.stdin.on('finish',()=>{p.stdout.end('اسم الشركة example.org');p.emit('close',0)});
  return p;
 }
 test('reads local OCR text without a network client',async()=>{
  const ocr=createLocalOcr({spawnProcess:fakeSpawn});
  await expect(ocr(Buffer.from('test'))).resolves.toContain('اسم الشركة');
 });
 test('rejects invalid language and missing image',async()=>{
  expect(()=>createLocalOcr({language:'eng;rm'})).toThrow('INVALID_OCR_LANGUAGE');
  await expect(createLocalOcr({spawnProcess:fakeSpawn})(Buffer.alloc(0))).rejects.toThrow('INVALID_OCR_INPUT');
 });
 test('rejects missing installed OCR executable without storing input',async()=>{
  const ocr=createLocalOcr({spawnProcess:()=>{
   const p=new EventEmitter();p.stdin=new PassThrough();p.stdout=new PassThrough();p.stderr=new PassThrough();p.kill=jest.fn();
   process.nextTick(()=>p.emit('error',new Error('ENOENT')));
   return p;
  }});
  await expect(ocr(Buffer.from('image'))).rejects.toThrow('OCR_START_FAILED');
 });
});
