const fs = require('fs');
const pdf = require('pdf-parse');

async function main() {
  const filePaths = [
    "E:\\UPSC question paper\\2006\\2006-GS1-Set-A (With Answers).pdf",
    "E:\\UPSC question paper\\2007\\2007-GS1-Set-A (Wth Answers).pdf"
  ];

  for (const filePath of filePaths) {
    if (fs.existsSync(filePath)) {
      console.log(`\n\n--- Reading ${filePath} ---`);
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      console.log(data.text.substring(0, 2000));
      console.log("\n\n--- End of PDF ---");
      console.log(data.text.substring(data.text.length - 2000));
    } else {
      console.log(`File not found: ${filePath}`);
    }
  }
}

main().catch(console.error);
