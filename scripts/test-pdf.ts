import fs from 'fs';
import path from 'path';

async function testPdfParser() {
  const ROOT_DIR = "C:\\Users\\Administrator\\Documents\\hari\\Prilims questio paper";
  const yearDir = path.join(ROOT_DIR, "2026"); // Pick one year
  
  if (!fs.existsSync(yearDir)) {
    console.error(`Directory not found: ${yearDir}`);
    process.exit(1);
  }

  // Find a PDF in the directory
  const files = fs.readdirSync(yearDir).filter(f => f.endsWith('.pdf'));
  if (files.length === 0) {
    console.error(`No PDFs found in ${yearDir}`);
    process.exit(1);
  }

  const testFile = path.join(yearDir, files[0]);
  console.log(`Testing PDF Parser on: ${testFile}`);

  try {
    const dataBuffer = fs.readFileSync(testFile);
    // const data = await pdf(dataBuffer); // USER WILL ADD CUSTOM PARSER HERE
    const data = { numpages: 1, text: "Mock Extracted Text" };

    console.log("✅ PDF Parsed Successfully!");
    console.log(`- Number of Pages: ${data.numpages}`);
    console.log(`- Extracted Text Length: ${data.text.length} characters`);
    console.log(`- First 500 characters:\n`);
    console.log(data.text.substring(0, 500));
  } catch (error: any) {
    console.error("❌ PDF Parsing Failed:", error.message || error);
    process.exit(1);
  }
}

testPdfParser();
