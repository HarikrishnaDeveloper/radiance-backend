import fs from 'fs';
import path from 'path';

// Mock parser and merge
async function testMerge() {
  console.log("Testing Answer Merging Logic...");
  
  const mockQuestions = [
    { questionNo: 1, text: "What is capital of India?", optionA: "Delhi", optionB: "Mumbai" },
    { questionNo: 2, text: "Which river is longest?", optionA: "Ganga", optionB: "Yamuna" }
  ];

  const mockAnswersText = "1 - A\n2 - A";
  
  const answersMap: Record<number, string> = {};
  const aMatches = [...mockAnswersText.matchAll(/(\d{1,3})\s*[-.]?\s*([A-D])/gi)];
  for (const match of aMatches) {
    answersMap[parseInt(match[1], 10)] = match[2].toUpperCase();
  }

  let success = true;
  for (const q of mockQuestions) {
    if (answersMap[q.questionNo]) {
      console.log(`✅ Matched Question ${q.questionNo} with Answer ${answersMap[q.questionNo]}`);
    } else {
      console.log(`❌ Failed to match Answer for Question ${q.questionNo}`);
      success = false;
    }
  }

  if (success) {
    console.log("✅ Merge test passed.");
  } else {
    console.log("❌ Merge test failed.");
    process.exit(1);
  }
}

testMerge();
