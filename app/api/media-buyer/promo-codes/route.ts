import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "MEDIA") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mediaBuyerId = session.user.id;
  const body = await request.json();
  const {
    description,
    type,
    bonusPercentage,
    maxBonusAmount,
    minDepositAmount,
    freeSpinsCount,
    freeSpinsGame,
    cashbackPercentage,
    wageringRequirement,
    commissionPercentage,
    maxUses,
    startDate,
    endDate,
  } = body;

  if (!type || commissionPercentage === undefined || !startDate) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const code = randomBytes(6).toString("hex").toUpperCase();

  const promoCode = await db.promoCode.create({
    data: {
      code,
      type,
      description,
      bonusPercentage: bonusPercentage || null,
      maxBonusAmount: maxBonusAmount || null,
      minDepositAmount: minDepositAmount || null,
      freeSpinsCount: freeSpinsCount || null,
      freeSpinsGame: freeSpinsGame || null,
      cashbackPercentage: cashbackPercentage || null,
      wageringRequirement: wageringRequirement || null,
      commissionPercentage,
      assignedUserId: mediaBuyerId,
      maxUses: maxUses || null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      isOneTimeUse: false,
      status: "ACTIVE",
    },
  });

  return NextResponse.json(promoCode, { status: 201 });
}