const fs = require('fs');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let no = 1;
  content = content.replace(/"no":\d+/g, () => `"no":${no++}`);
  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${filePath}, total questions: ${no-1}`);
}

fixFile("E:\\Radiance\\radiance-backend\\prisma\\seed-data\\2006.ts");
fixFile("E:\\Radiance\\radiance-backend\\prisma\\seed-data\\2007.ts");
