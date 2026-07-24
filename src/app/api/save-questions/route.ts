import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { questions, year, paperName } = await req.json();

    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }

    const results = await prisma.$transaction(async (tx) => {
      // Create Paper if not exists
      let paper = await tx.paper.findFirst({
        where: { year: parseInt(year), name: paperName, set: null },
      });
      if (!paper) {
        paper = await tx.paper.create({
          data: { year: parseInt(year), name: paperName },
        });
      }

      // Create Import Record
      const importRecord = await tx.import.create({
        data: {
          paperId: paper.id,
          status: "SUCCESS",
        }
      });

      let savedCount = 0;
      let reviewQueueCount = 0;

      for (const q of questions) {
        // Upsert Category
        const category = await tx.category.upsert({
          where: { name: q.category },
          update: {},
          create: { name: q.category },
        });

        // Upsert Subcategory (if exists)
        let subcategoryId = null;
        if (q.subcategory) {
          const subcategory = await tx.subcategory.upsert({
            where: {
              name_categoryId: {
                name: q.subcategory,
                categoryId: category.id,
              },
            },
            update: {},
            create: {
              name: q.subcategory,
              categoryId: category.id,
            },
          });
          subcategoryId = subcategory.id;
        }

        // Upsert Tags
        const tagRecords = [];
        for (const tagName of q.tags || []) {
          const tag = await tx.tag.upsert({
            where: { name: tagName },
            update: {},
            create: { name: tagName },
          });
          tagRecords.push(tag);
        }

        // Upsert Question
        const question = await tx.draftQuestion.upsert({
          where: {
            paperId_questionNo: {
              paperId: paper.id,
              questionNo: q.questionNo,
            },
          },
          update: {
            text: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || "",
            explanationSource: q.explanationSource || "",
            questionImage: q.questionImage || null,
            optionImage: q.optionImage || null,
            parseConfidence: q.parseConfidence,
            categoryConfidence: q.categoryConfidence,
            answerConfidence: q.answerConfidence,
            status: q.status,
            categoryId: category.id,
            subcategoryId,
          },
          create: {
            questionNo: q.questionNo,
            text: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || "",
            explanationSource: q.explanationSource || "",
            questionImage: q.questionImage || null,
            optionImage: q.optionImage || null,
            parseConfidence: q.parseConfidence,
            categoryConfidence: q.categoryConfidence,
            answerConfidence: q.answerConfidence,
            status: q.status,
            paperId: paper.id,
            categoryId: category.id,
            subcategoryId,
          },
        });

        // Review Queue Insertion
        if (q.status === "NEEDS_REVIEW") {
          await tx.reviewQueue.upsert({
            where: { questionId: question.id },
            update: { reason: q.reviewReason || "Import flagged for review", resolved: false },
            create: {
              questionId: question.id,
              reason: q.reviewReason || "Import flagged for review",
            }
          });
          reviewQueueCount++;
        } else {
          // If approved, remove from queue if it existed
          await tx.reviewQueue.deleteMany({
            where: { questionId: question.id }
          });
        }

        // Sync Tags
        await tx.questionTag.deleteMany({
          where: { questionId: question.id }
        });
        
        if (tagRecords.length > 0) {
          await tx.questionTag.createMany({
            data: tagRecords.map((t) => ({
              questionId: question.id,
              tagId: t.id,
            })),
          });
        }

        savedCount++;
      }

      await tx.importLog.create({
        data: {
          importId: importRecord.id,
          level: "INFO",
          message: `Successfully imported ${savedCount} questions. ${reviewQueueCount} added to review queue.`,
        }
      });

      return { savedCount, reviewQueueCount };
    });

    return NextResponse.json({ success: true, savedCount: results.savedCount, reviewQueueCount: results.reviewQueueCount });
  } catch (error: any) {
    console.error("Database save error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
