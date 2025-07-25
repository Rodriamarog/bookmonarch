import { LaTeXProcessor } from './src/lib/latexProcessor.js';

const processor = new LaTeXProcessor();

console.log('=== Escape Test ===');
const escapeTest = processor.escapeText('Text with & % $ # _ ^ ~ { } characters');
console.log('Result:', escapeTest);

console.log('\n=== Bold-Italic Test ===');
const boldItalicTest = processor.processTextFormatting('This text has bold-italic formatting.', [
  {start: 14, end: 25, type: 'bold-italic', text: 'bold-italic'}
]);
console.log('Result:', boldItalicTest);

console.log('\n=== Backslash Test ===');
const backslashTest = processor.escapeText('Text with \\ backslash');
console.log('Result:', backslashTest);