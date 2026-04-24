import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "MEDIA") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mediaBuyerId = session.user.id;
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");

  const mediaBuyer = await db.user.findFirst({
    where: { id: mediaBuyerId, role: "MEDIA" },
    include: {
      assignedPromoCodes: {
        include: {
          _count: { select: { userPromoCodes: true } },
          influencerEarnings: true,
          userPromoCodes: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  createdAt: true,
                  transactions: {
                    where: { status: "success" },
                    orderBy: { createdAt: "desc" },
                    take: 3,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!mediaBuyer) {
    return NextResponse.json({ error: "Media buyer not found" }, { status: 404 });
  }

  const referredUserIds = mediaBuyer.assignedPromoCodes.flatMap((code) =>
    code.userPromoCodes.map((upc) => upc.user.id)
  );

  // Commission per referred user
  const earningsByUser = await db.influencerEarning.groupBy({
    by: ["sourceUserId"],
    where: {
      influencerId: mediaBuyerId,
      sourceUserId: { in: referredUserIds },
    },
    _sum: { amount: true },
  });
  const commissionMap = new Map(
    earningsByUser.map((e) => [e.sourceUserId, e._sum.amount || new Prisma.Decimal(0)])
  );

  // NGR per referred user
  const ngrWithdrawals = await db.transaction.groupBy({
    by: ["userId"],
    where: {
      userId: { in: referredUserIds },
      type: "withdrawal",
      status: "success",
      category: { not: "transaction" },
    },
    _sum: { amount: true },
  });
  const ngrDeposits = await db.transaction.groupBy({
    by: ["userId"],
    where: {
      userId: { in: referredUserIds },
      type: "deposit",
      status: { in: ["success", "pending"] },
      category: { not: "transaction" },
    },
    _sum: { amount: true },
  });
  const ngrMap = new Map<string, Prisma.Decimal>(
    ngrWithdrawals.map((r) => [r.userId, r._sum.amount || new Prisma.Decimal(0)])
  );
  ngrDeposits.forEach((r) => {
    const prev = ngrMap.get(r.userId) || new Prisma.Decimal(0);
    ngrMap.set(r.userId, prev.minus(r._sum.amount || new Prisma.Decimal(0)));
  });

  const allReferredUsers = mediaBuyer.assignedPromoCodes.flatMap((code) =>
    code.userPromoCodes.map((upc) => ({
      ...upc.user,
      promoCodeUsed: code.code,
      joinedAt: upc.lastUsedAt || upc.user.createdAt,
      totalCommission: commissionMap.get(upc.user.id) || new Prisma.Decimal(0),
      ngr: ngrMap.get(upc.user.id) || new Prisma.Decimal(0),
    }))
  );

  const uniqueUsers = Array.from(
    new Map(allReferredUsers.map((user) => [user.id, user])).values()
  );
  uniqueUsers.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

  const totalCount = uniqueUsers.length;
  const skip = (page - 1) * limit;
  const paginatedUsers = uniqueUsers.slice(skip, skip + limit);

  // Overall totals
  const totalReferrals = uniqueUsers.length;
  const totalCommission = await db.influencerEarning.aggregate({
    where: { influencerId: mediaBuyerId },
    _sum: { amount: true },
  });

  // Deposits & withdrawals (category = "transaction") for summary cards
  const buyerTransactionAggregates = await db.transaction.groupBy({
    by: ["type"],
    where: {
      status: "success",
      category: "transaction",
      user: {
        userPromoCodes: {
          some: { promoCode: { assignedUserId: mediaBuyerId } },
        },
      },
    },
    _sum: { amount: true },
  });

  let buyerTotalDeposits = new Prisma.Decimal(0);
  let buyerTotalWithdrawals = new Prisma.Decimal(0);
  buyerTransactionAggregates.forEach((agg) => {
    const amount = agg._sum.amount || new Prisma.Decimal(0);
    if (agg.type === "deposit") buyerTotalDeposits = buyerTotalDeposits.add(amount);
    else if (agg.type === "withdrawal") buyerTotalWithdrawals = buyerTotalWithdrawals.add(amount);
  });

  // Total NGR for the buyer (own net flow)
  const [ownW, ownD] = await Promise.all([
    db.transaction.aggregate({
      where: {
        userId: { in: referredUserIds },
        type: "withdrawal",
        status: "success",
        category: { not: "transaction" },
      },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: {
        userId: { in: referredUserIds },
        type: "deposit",
        status: { in: ["success", "pending"] },
        category: { not: "transaction" },
      },
      _sum: { amount: true },
    }),
  ]);
  const totalNgr = (ownW._sum.amount || new Prisma.Decimal(0)).minus(ownD._sum.amount || new Prisma.Decimal(0));

  // Buyer's own withdrawals
  const ownWithdrawals = await db.transaction.aggregate({
    where: { userId: mediaBuyerId, type: "withdrawal", status: "success" },
    _sum: { amount: true },
  });
  const totalOwnWithdrawals = ownWithdrawals._sum.amount || new Prisma.Decimal(0);

  // Available balance = NGR * commissionPercent / 100 - own withdrawals
  const commissionPercent = mediaBuyer.commissionPercent ?? 0;
  const balance = totalNgr.mul(commissionPercent).div(100).minus(totalOwnWithdrawals);

  return NextResponse.json({
    ...mediaBuyer,
    totalReferrals,
    totalCommission: totalCommission._sum.amount || new Prisma.Decimal(0),
    totalDeposits: buyerTotalDeposits.toString(),
    totalWithdrawals: buyerTotalWithdrawals.toString(),
    totalNgr: totalNgr.toString(),
    totalBalance: balance.toString(),
    commissionPercent,
    totalOwnWithdrawals: totalOwnWithdrawals.toString(),
    referredUsers: paginatedUsers,
    referredUsersPagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNext: skip + limit < totalCount,
      hasPrev: page > 1,
    },
  });
}