import { NextRequest, NextResponse } from "next/server";

// In production, this would call OpenAI/Anthropic API
async function classifyWithLLM(questionText: string) {
  // Mock LLM Response
  console.log("Mocking LLM call for question...");
  
  const t = questionText.toLowerCase();
  let category = "Current Affairs";
  let subcategory = "General";
  let tags = ["Current Affairs"];
  let categoryConfidence = 0.85;

  if (t.includes("article") || t.includes("constitution") || t.includes("parliament")) {
    category = "Polity";
    subcategory = "Constitution";
    tags = ["Indian Polity", "Fundamental Rights"];
    categoryConfidence = 0.95;
  } else if (t.includes("ramsar") || t.includes("unesco") || t.includes("tiger") || t.includes("environment")) {
    category = "Environment";
    subcategory = "Protected Areas";
    tags = ["Biodiversity", "Wetlands", "Conservation"];
    categoryConfidence = 0.92;
  } else if (t.includes("gdp") || t.includes("repo") || t.includes("inflation")) {
    category = "Economy";
    subcategory = "Macroeconomics";
    tags = ["Monetary Policy", "Banking"];
    categoryConfidence = 0.90;
  } else if (t.includes("harappan") || t.includes("mughal") || t.includes("gandhi")) {
    category = "History";
    subcategory = "Modern India";
    tags = ["Freedom Struggle", "Art & Culture"];
    categoryConfidence = 0.88;
  }

  // Simulate occasionally low confidence
  if (t.length < 20) {
    categoryConfidence = 0.60;
  }

  return {
    category,
    subcategory,
    tags,
    categoryConfidence,
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const questionsFile = formData.get("questionsFile") as File | null;
    const answersFile = formData.get("answersFile") as File | null;
    const year = parseInt(formData.get("year") as string) || 2024;
    const paper = (formData.get("paper") as string) || "GS1";

    if (!questionsFile || !answersFile) {
      return NextResponse.json({ error: "Missing files" }, { status: 400 });
    }

    // Parse Questions PDF - USER WILL ADD LOGIC HERE
    const qBuffer = Buffer.from(await questionsFile.arrayBuffer());
    // const qText = await yourCustomPdfParser(qBuffer);
    const qLines = ["1. Dummy question", "(a) A", "(b) B", "(c) C", "(d) D"];

    const questionsList: any[] = [];
    let currentQuestion: any = null;
    let currentBlock = "";

    // Line/Block parser for questions
    for (let i = 0; i < qLines.length; i++) {
      const line = qLines[i].trim();
      if (!line) continue;

      // Match start of a new question (e.g., "1.", "12.", "100.")
      const qStartMatch = line.match(/^(\d{1,3})\s*\.(.*)/);
      
      if (qStartMatch) {
        // Save previous question
        if (currentQuestion) {
          currentQuestion.rawText = currentBlock;
          questionsList.push(currentQuestion);
        }
        
        currentQuestion = {
          questionNo: parseInt(qStartMatch[1], 10),
          rawText: "",
          question: qStartMatch[2].trim(),
          optionA: null,
          optionB: null,
          optionC: null,
          optionD: null,
          questionImage: null,
          optionImage: null,
        };
        currentBlock = line;
      } else if (currentQuestion) {
        currentBlock += "\n" + line;
      }
    }
    // Push the last question
    if (currentQuestion) {
      currentQuestion.rawText = currentBlock;
      questionsList.push(currentQuestion);
    }

    // Post-process blocks to extract options heuristically
    for (const q of questionsList) {
      const block = q.rawText;
      let parseConfidence = 1.0;
      
      // Simple extraction of options from the block
      const optAMatch = block.match(/\([aA]\)\s*(.*?)(?=\n*\([bB]\)|$)/s);
      const optBMatch = block.match(/\([bB]\)\s*(.*?)(?=\n*\([cC]\)|$)/s);
      const optCMatch = block.match(/\([cC]\)\s*(.*?)(?=\n*\([dD]\)|$)/s);
      const optDMatch = block.match(/\([dD]\)\s*(.*?)(?=\n*\d{1,3}\s*\.|$)/s);

      q.optionA = optAMatch ? optAMatch[1].trim() : null;
      q.optionB = optBMatch ? optBMatch[1].trim() : null;
      q.optionC = optCMatch ? optCMatch[1].trim() : null;
      q.optionD = optDMatch ? optDMatch[1].trim() : null;

      // Extract question text before Option A
      const qTextMatch = block.match(/^(\d{1,3})\s*\.\s*(.*?)(?=\n*\([aA]\))/s);
      if (qTextMatch) {
        q.question = qTextMatch[2].trim();
      }

      if (!q.optionA || !q.optionB || !q.optionC || !q.optionD) {
        parseConfidence = 0.5; // Lower confidence if options are missing
      }
      q.parseConfidence = parseConfidence;

      // Classify via LLM (Mocked)
      const aiResult = await classifyWithLLM(q.question);
      q.category = aiResult.category;
      q.subcategory = aiResult.subcategory;
      q.tags = aiResult.tags;
      q.categoryConfidence = aiResult.categoryConfidence;
      
      // Default extra fields
      q.explanation = "";
      q.explanationSource = "";
    }

    // Parse Answers PDF - USER WILL ADD LOGIC HERE
    const aBuffer = Buffer.from(await answersFile.arrayBuffer());
    // const aText = await yourCustomPdfParser(aBuffer);
    const aLines = ["1 - C"];

    const answersMap: Record<number, { ans: string, conf: number }> = {};
    for (const line of aLines) {
      // Find "1 - C" or "1. C"
      const match = line.match(/(\d{1,3})\s*[-.]?\s*([A-D])/i);
      if (match) {
        answersMap[parseInt(match[1], 10)] = { ans: match[2].toUpperCase(), conf: 1.0 };
      }
    }

    // Merge answers
    for (const q of questionsList) {
      q.year = year;
      q.paper = paper;
      
      if (answersMap[q.questionNo]) {
        q.correctAnswer = answersMap[q.questionNo].ans;
        q.answerConfidence = answersMap[q.questionNo].conf;
      } else {
        q.correctAnswer = null;
        q.answerConfidence = 0.0;
      }

      // Determine Status
      q.status = "APPROVED";
      q.reviewReason = "";
      
      if (q.parseConfidence < 0.8) {
        q.status = "NEEDS_REVIEW";
        q.reviewReason = "Low Parse Confidence. Missing options or malformed question.";
      } else if (q.categoryConfidence < 0.8) {
        q.status = "NEEDS_REVIEW";
        q.reviewReason = "Low Category Confidence. AI uncertain.";
      } else if (q.answerConfidence < 0.8) {
        q.status = "NEEDS_REVIEW";
        q.reviewReason = "Missing or low confidence answer.";
      }
    }

    return NextResponse.json({ data: questionsList });
  } catch (error: any) {
    console.error("PDF Parsing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
