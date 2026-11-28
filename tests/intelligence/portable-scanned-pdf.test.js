'use strict';
const {pageCount,ocrScannedPdf,MAX_PAGES}=require('../../lib/portable-intelligence/local-pdf-ocr');
describe('portable scanned PDF safety boundaries',()=>{
 test('counts original PDF pages',()=>{expect(pageCount('Pages: 12\nPage size: A4')).toBe(12)});
 test('does not silently truncate longer PDFs',()=>{expect(()=>pageCount('Pages: 13')).toThrow('PDF_OCR_PAGE_LIMIT');expect(MAX_PAGES).toBe(12)});
 test('fails closed if PDF page count cannot be determined',()=>expect(()=>pageCount('Title: scanned')).toThrow('PDF_PAGE_COUNT_UNKNOWN'));
 test('refuses empty image source before executing tools',async()=>await expect(ocrScannedPdf(Buffer.alloc(0))).rejects.toThrow('INVALID_OCR_INPUT'));
});
