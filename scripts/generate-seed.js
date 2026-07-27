const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

async function processFile(filePath, year, outFile) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  
  let text = data.text;
  // clean up page footers/headers
  text = text.replace(/UPSC-CSE Prelims General Studies \d{4} Paper.*?(https:\/\/educationprovince\.com)?/gi, '');
  text = text.replace(/Education Province\s+Page \d+ of \d+/gi, '');
  text = text.replace(/Ans:\s*[a-d]\)/gi, match => '\n' + match + '\n');
  
  // split into questions
  const blocks = text.split(/(?=\n\s*\d{1,3}\.\s)/);
  const questions = [];

  for (let block of blocks) {
    block = block.trim();
    if (!block.match(/^\d{1,3}\.\s/)) continue;
    
    // extract components
    const numMatch = block.match(/^(\d{1,3})\.\s/);
    if (!numMatch) continue;
    const qNo = parseInt(numMatch[1], 10);
    
    const ansMatch = block.match(/Ans:\s*([a-d])\)/i);
    if (!ansMatch) continue;
    const ans = ansMatch[1].toUpperCase();
    
    // Option A, B, C, D
    const optRegex = /a\)(.*?)\nb\)(.*?)\nc\)(.*?)\nd\)(.*?)\nAns:/is;
    const opts = block.match(optRegex);
    let A = "Option A", B = "Option B", C = "Option C", D = "Option D";
    let qText = block;

    if (opts) {
      qText = block.substring(0, opts.index).replace(/^\d{1,3}\.\s/, '').trim();
      A = opts[1].trim();
      B = opts[2].trim();
      C = opts[3].trim();
      D = opts[4].trim();
    } else {
      qText = block.replace(/Ans:.*?$/is, '').replace(/^\d{1,3}\.\s/, '').trim();
    }

    // clean up newlines in qText
    qText = qText.replace(/\n/g, ' ');

    questions.push({
      no: qNo,
      text: qText,
      A, B, C, D,
      ans,
      expl: "",
      category: "Miscellaneous",
      subcategory: "Miscellaneous",
      tags: ["UPSC"]
    });
  }

  // write to seed file format
  let outContent = `export const paper = { year: ${year}, name: 'GS1', set: 'A' };\n\n`;
  outContent += `export const questions = [\n`;
  for (const q of questions) {
    outContent += JSON.stringify(q) + ",\n";
  }
  outContent += `];\n`;

  fs.writeFileSync(outFile, outContent);
  console.log(`Generated ${outFile} with ${questions.length} questions`);
}

async function main() {
  await processFile("E:\\UPSC question paper\\2006\\2006-GS1-Set-A (With Answers).pdf", 2006, path.join(__dirname, '..', 'prisma', 'seed-data', '2006.ts'));
  await processFile("E:\\UPSC question paper\\2007\\2007-GS1-Set-A (Wth Answers).pdf", 2007, path.join(__dirname, '..', 'prisma', 'seed-data', '2007.ts'));
}

main().catch(console.error);
