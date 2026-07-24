import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/radience?schema=public" });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ROOT_DIR = "C:\\Users\\Administrator\\Documents\\hari\\Prilims questio paper";
const OUTPUT_JSON_FILE = "parsed_questions.json";

// Global array to store everything for the JSON output
const allParsedData: any[] = [];

// Mock AI Logic
async function classifyWithLLM(questionText: string) {
  const t = questionText.toLowerCase();
  let category = "Current Affairs";
  let subcategory = "General";
  let tags = ["Current Affairs"];
  let categoryConfidence = 0.85;

  if (t.includes("article") || t.includes("constitution") || t.includes("parliament")) {
    category = "Polity"; subcategory = "Constitution"; tags = ["Indian Polity", "Fundamental Rights"]; categoryConfidence = 0.95;
  } else if (t.includes("ramsar") || t.includes("unesco") || t.includes("tiger") || t.includes("environment")) {
    category = "Environment"; subcategory = "Protected Areas"; tags = ["Biodiversity", "Wetlands"]; categoryConfidence = 0.92;
  } else if (t.includes("gdp") || t.includes("repo") || t.includes("inflation")) {
    category = "Economy"; subcategory = "Macroeconomics"; tags = ["Monetary Policy", "Banking"]; categoryConfidence = 0.90;
  } else if (t.includes("harappan") || t.includes("mughal") || t.includes("gandhi")) {
    category = "History"; subcategory = "Modern India"; tags = ["Freedom Struggle"]; categoryConfidence = 0.88;
  }

  return { category, subcategory, tags, categoryConfidence };
}

// Regex to detect image references in text (heuristic)
function detectImages(text: string) {
  const t = text.toLowerCase();
  if (t.includes("map given below") || t.includes("see the map")) return "MAP";
  if (t.includes("chart") || t.includes("graph")) return "CHART";
  if (t.includes("table")) return "TABLE";
  if (t.includes("diagram")) return "DIAGRAM";
  return null;
}

// Parse a single block of text into a question
async function parseQuestionBlock(block: string, qNo: number) {
  let parseConfidence = 1.0;
  const optAMatch = block.match(/\([aA]\)\s*(.*?)(?=\n*\([bB]\)|$)/s);
  const optBMatch = block.match(/\([bB]\)\s*(.*?)(?=\n*\([cC]\)|$)/s);
  const optCMatch = block.match(/\([cC]\)\s*(.*?)(?=\n*\([dD]\)|$)/s);
  const optDMatch = block.match(/\([dD]\)\s*(.*?)(?=\n*\d{1,3}\s*\.|$)/s);

  const optionA = optAMatch ? optAMatch[1].trim() : null;
  const optionB = optBMatch ? optBMatch[1].trim() : null;
  const optionC = optCMatch ? optCMatch[1].trim() : null;
  const optionD = optDMatch ? optDMatch[1].trim() : null;

  let questionText = block;
  const qTextMatch = block.match(/^(\d{1,3})\s*\.\s*(.*?)(?=\n*\([aA]\))/s);
  if (qTextMatch) questionText = qTextMatch[2].trim();

  if (!optionA || !optionB || !optionC || !optionD) parseConfidence = 0.5;

  const imageType = detectImages(questionText);

  const aiResult = await classifyWithLLM(questionText);

  return {
    questionNo: qNo,
    text: questionText,
    optionA, optionB, optionC, optionD,
    imageType,
    questionImage: imageType ? "pending_extraction.jpg" : null, // placeholder
    parseConfidence,
    ...aiResult
  };
}

async function extractAnswers(text: string) {
  const answersMap: Record<number, string> = {};
  const aMatches = [...text.matchAll(/(\d{1,3})\s*[-.]?\s*([A-D])/gi)];
  for (const match of aMatches) {
    answersMap[parseInt(match[1], 10)] = match[2].toUpperCase();
  }
  return answersMap;
}

async function processPaperGroup(year: number, paperName: string, set: string | null, qFilePath: string, aFilePath: string | null) {
  console.log(`\n--- Processing ${year} | ${paperName} | Set: ${set || 'N/A'} ---`);
  
  // 1. Read Q File
  const qBuf = fs.readFileSync(qFilePath);
  // USER WILL ADD LOGIC HERE TO EXTRACT TEXT
  // const qText = await extractPdfText(qBuf);
  const qLines = ["1. Dummy question", "(a) A", "(b) B", "(c) C", "(d) D"];

  // Block parser
  const questionsList: any[] = [];
  let currentBlock = "";
  let currentQNo = 0;

  for (const line of qLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const qStartMatch = trimmed.match(/^(\d{1,3})\s*\.(.*)/);
    
    if (qStartMatch) {
      if (currentQNo > 0) {
        questionsList.push(await parseQuestionBlock(currentBlock, currentQNo));
      }
      currentQNo = parseInt(qStartMatch[1], 10);
      currentBlock = trimmed;
    } else if (currentQNo > 0) {
      currentBlock += "\n" + trimmed;
    }
  }
  if (currentQNo > 0) {
    questionsList.push(await parseQuestionBlock(currentBlock, currentQNo));
  }

  // 2. Read Answers
  let answersMap: Record<number, string> = {};
  if (aFilePath) {
    console.log(`Separate answer key detected: ${aFilePath}`);
    const aBuf = fs.readFileSync(aFilePath);
    // USER WILL ADD LOGIC HERE TO EXTRACT TEXT
    // const aText = await extractPdfText(aBuf);
    answersMap = await extractAnswers("1 - C");
  } else {
    console.log(`No separate answer key. Attempting to extract embedded answers from Questions PDF.`);
    // answersMap = await extractAnswers(qText);
    answersMap = await extractAnswers("1 - C");
  }

  // 3. Save to DB
  await prisma.$transaction(async (tx) => {
    const paper = await tx.paper.upsert({
      where: { year_name_set: { year, name: paperName, set: set || "" } },
      update: {},
      create: { year, name: paperName, set: set || "" },
    });

    const importRecord = await tx.import.create({
      data: { paperId: paper.id, status: "SUCCESS" }
    });

    let saved = 0;
    for (const q of questionsList) {
      const cat = await tx.category.upsert({ where: { name: q.category }, update: {}, create: { name: q.category }});
      
      let subcategoryId = null;
      if (q.subcategory) {
        const sub = await tx.subcategory.upsert({
          where: { name_categoryId: { name: q.subcategory, categoryId: cat.id } },
          update: {}, create: { name: q.subcategory, categoryId: cat.id }
        });
        subcategoryId = sub.id;
      }

      const correctAnswer = answersMap[q.questionNo] || null;
      const answerConfidence = correctAnswer ? 1.0 : 0.0;
      let status = "APPROVED";
      let reviewReason = "";

      if (q.parseConfidence < 0.8) { status = "NEEDS_REVIEW"; reviewReason = "Low Parse Confidence"; }
      else if (q.categoryConfidence < 0.8) { status = "NEEDS_REVIEW"; reviewReason = "Low Category Confidence"; }
      else if (!correctAnswer) { status = "NEEDS_REVIEW"; reviewReason = "Missing Answer"; }

      const questionRecord = await tx.question.upsert({
        where: { paperId_questionNo: { paperId: paper.id, questionNo: q.questionNo } },
        update: {
          text: q.text, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
          correctAnswer, status, categoryId: cat.id, subcategoryId,
          imageType: q.imageType, questionImage: q.questionImage,
          parseConfidence: q.parseConfidence, categoryConfidence: q.categoryConfidence, answerConfidence
        },
        create: {
          questionNo: q.questionNo, text: q.text, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
          correctAnswer, status, paperId: paper.id, categoryId: cat.id, subcategoryId,
          imageType: q.imageType, questionImage: q.questionImage,
          parseConfidence: q.parseConfidence, categoryConfidence: q.categoryConfidence, answerConfidence
        },
      });

      if (status === "NEEDS_REVIEW") {
        await tx.reviewQueue.upsert({
          where: { questionId: questionRecord.id },
          update: { reason: reviewReason, resolved: false },
          create: { questionId: questionRecord.id, reason: reviewReason }
        });
      }

      saved++;
    }

    await tx.importLog.create({
      data: { importId: importRecord.id, level: "INFO", message: `Imported ${saved} questions for ${year} ${paperName}.` }
    });
    console.log(`Saved ${saved} questions!`);
    
    allParsedData.push({
      year,
      paperName,
      set,
      questions: questionsList.map(q => ({
        ...q,
        correctAnswer: answersMap[q.questionNo] || null,
        status: (q.parseConfidence < 0.8 || q.categoryConfidence < 0.8 || !(answersMap[q.questionNo])) ? "NEEDS_REVIEW" : "APPROVED"
      }))
    });
  });
}

async function main() {
  if (!fs.existsSync(ROOT_DIR)) {
    console.error(`Directory not found: ${ROOT_DIR}`);
    return;
  }

  console.log(`Scanning recursively: ${ROOT_DIR}`);
  const pdfFiles = globSync('**/*.pdf', { cwd: ROOT_DIR, absolute: true });
  console.log(`Found ${pdfFiles.length} PDF files.`);

  // Group by Directory (Year) and Base Name logic
  // Heuristics for detection:
  // - If folder is a year (e.g., "2020"), extract year
  // - If filename contains "GS1" or "CSAT", extract paperName
  // - If filename contains "Set_A", extract Set
  // - If filename contains "Answers" or "Key", it's an answer key

  const groups: Record<string, { qFile?: string, aFile?: string, year: number, name: string, set: string | null }> = {};

  for (const file of pdfFiles) {
    const filename = path.basename(file).toLowerCase();
    const folder = path.basename(path.dirname(file));
    
    // Detect Year
    let year = parseInt(folder);
    if (isNaN(year)) {
      const yearMatch = filename.match(/(19\d{2}|20\d{2})/);
      year = yearMatch ? parseInt(yearMatch[1]) : 0;
    }

    // Detect Paper Type
    let paperName = "GS1";
    if (filename.includes("csat") || filename.includes("gs2") || filename.includes("gs 2")) {
      paperName = "CSAT";
    }

    // Detect Set
    let set: string | null = null;
    const setMatch = filename.match(/set[-_ ]?([a-d])/i);
    if (setMatch) set = setMatch[1].toUpperCase();

    const isAnswer = filename.includes("answer") || filename.includes("key");

    const groupKey = `${year}_${paperName}_${set || 'DEFAULT'}`;
    
    if (!groups[groupKey]) {
      groups[groupKey] = { year, name: paperName, set };
    }

    if (isAnswer) {
      groups[groupKey].aFile = file;
    } else {
      groups[groupKey].qFile = file;
    }
  }

  let successCount = 0;
  let failCount = 0;

  for (const key of Object.keys(groups)) {
    const g = groups[key];
    if (g.qFile && g.year > 0) {
      try {
        await processPaperGroup(g.year, g.name, g.set, g.qFile, g.aFile || null);
        successCount++;
      } catch (err: any) {
        failCount++;
        console.error(`\n❌ Failed to process ${key}:`, err);
        // Fail fast if PDF parsing itself is failing
        if (err.message && err.message.includes("pdf is not a function")) {
          console.error("FATAL: pdf-parse is broken. Aborting importer.");
          process.exit(1);
        }
      }
    }
  }

  // Write all data to JSON
  fs.writeFileSync(OUTPUT_JSON_FILE, JSON.stringify(allParsedData, null, 2));
  
  console.log(`\n================================`);
  console.log(`✅ Extraction Complete`);
  console.log(`================================`);
  console.log(`Total PDFs Detected : ${pdfFiles.length}`);
  console.log(`Successful Papers   : ${successCount}`);
  console.log(`Failed Papers       : ${failCount}`);
  
  if (failCount > 0) {
    console.error(`\nImporter finished with ${failCount} errors.`);
    process.exit(1);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
