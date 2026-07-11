import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Number of questions per mission
const MISSION_SIZE = 10;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryName = searchParams.get("category");

    if (!categoryName) {
      return NextResponse.json({ error: "Missing category parameter" }, { status: 400 });
    }

    // Find category
    const category = await prisma.category.findUnique({
      where: { name: categoryName },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Count total approved questions for this category
    const totalQuestions = await prisma.question.count({
      where: {
        categoryId: category.id,
        status: "APPROVED",
      }
    });

    // Generate dynamic missions based on total count
    const numMissions = Math.ceil(totalQuestions / MISSION_SIZE);
    
    const missions = [];
    for (let i = 1; i <= numMissions; i++) {
      const start = (i - 1) * MISSION_SIZE + 1;
      const end = Math.min(i * MISSION_SIZE, totalQuestions);
      
      missions.push({
        id: `mission_${category.id}_${i}`,
        title: `Mission ${i}`,
        description: `Questions ${start} - ${end}`,
        totalQuestions: end - start + 1,
        // In a real app, clicking the mission would fetch the questions with skip/take:
        // skip: (i - 1) * MISSION_SIZE, take: MISSION_SIZE
      });
    }

    return NextResponse.json({ 
      category: categoryName,
      totalQuestions,
      totalMissions: numMissions,
      missions 
    });

  } catch (error: any) {
    console.error("Missions API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
