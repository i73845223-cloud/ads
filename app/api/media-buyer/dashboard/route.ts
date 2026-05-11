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
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const hasDepositedFilter = searchParams.get("hasDeposited") || "all";

  const dateFilter: any = {};
  if (dateFrom || dateTo) {
    dateFilter.createdAt = {};
    if (dateFrom) dateFilter.createdAt.gte = new Date(dateFrom);
    if (dateTo) dateFilter.createdAt.lte = new Date(dateTo);
  }

  const promoCodes = await db.promoCode.findMany({
    where: { assignedUserId: mediaBuyerId },
    select: { id: true, commissionPercentage: true },
  });
  const promoCodeIds = promoCodes.map(p => p.id);

  const userPromoCodeFilter: any = {
    promoCodeId: { in: promoCodeIds },
  };
  if (dateFilter.createdAt) {
    userPromoCodeFilter.lastUsedAt = dateFilter.createdAt;
  }
  const allUserPromoCodes = await db.userPromoCode.findMany({
    where: userPromoCodeFilter,
    select: { userId: true, promoCodeId: true },
  });
  const referredUserIds = [...new Set(allUserPromoCodes.map(u => u.userId))];

  const depositForHasFilter: any = {
    userId: { in: referredUserIds },
    type: 'deposit',
    status: 'success',
  };
  if (dateFilter.createdAt) depositForHasFilter.createdAt = dateFilter.createdAt;
  const usersWithDeposit = await db.transaction.findMany({
    where: depositForHasFilter,
    select: { userId: true },
    distinct: ['userId'],
  });
  const depositSet = new Set(usersWithDeposit.map(d => d.userId));

  const totalRegistrations = allUserPromoCodes.length;

  let firstDepositDates: { userId: string }[] = [];
  let totalFirstDeposits = 0;
  let totalFtdCommission = new Prisma.Decimal(0);

  if (referredUserIds.length > 0) {
    const firstDepositsRaw = await db.transaction.groupBy({
      by: ["userId"],
      where: {
        userId: { in: referredUserIds },
        type: "deposit",
        status: "success",
      },
      _min: { createdAt: true },
    });

    firstDepositDates = firstDepositsRaw
      .filter(d => d._min.createdAt)
      .filter(d => {
        const dDate = d._min.createdAt!;
        if (dateFrom && dDate < new Date(dateFrom)) return false;
        if (dateTo && dDate > new Date(dateTo)) return false;
        return true;
      });
    totalFirstDeposits = firstDepositDates.length;

    for (const pc of promoCodes) {
      const ftdFee = pc.commissionPercentage || 0;
      const usersForCode = allUserPromoCodes
        .filter(u => u.promoCodeId === pc.id)
        .map(u => u.userId);
      const uniqueUsers = [...new Set(usersForCode)];
      const ftdCount = uniqueUsers.filter(uid =>
        firstDepositDates.some(d => d.userId === uid)
      ).length;
      totalFtdCommission = totalFtdCommission.add(
        new Prisma.Decimal(ftdFee).mul(ftdCount)
      );
    }
  }

  const depositAggFilter: any = {
    userId: { in: referredUserIds },
    type: "deposit",
    status: "success",
    category: "transaction",
  };
  if (dateFilter.createdAt) depositAggFilter.createdAt = dateFilter.createdAt;
  const totalDepositsAgg = await db.transaction.aggregate({
    where: depositAggFilter,
    _sum: { amount: true },
  });
  const totalDeposits = totalDepositsAgg._sum.amount || new Prisma.Decimal(0);

  const mediaBuyer = await db.user.findFirst({
    where: { id: mediaBuyerId, role: "MEDIA" },
    include: {
      assignedPromoCodes: {
        include: {
          _count: { select: { userPromoCodes: true } },
          influencerEarnings: true,
          userPromoCodes: {
            where: userPromoCodeFilter,
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

  const enrichedPromoCodes = await Promise.all(
    mediaBuyer.assignedPromoCodes.map(async (code) => {
      const regs = await db.userPromoCode.count({
        where: {
          promoCodeId: code.id,
          ...(dateFilter.createdAt ? { lastUsedAt: dateFilter.createdAt } : {}),
        },
      });

      const usersForCode = allUserPromoCodes
        .filter(u => u.promoCodeId === code.id)
        .map(u => u.userId);
      const uniqueUserIds = [...new Set(usersForCode)];

      const ftdCount = uniqueUserIds.filter(uid =>
        firstDepositDates.some(d => d.userId === uid)
      ).length;

      const ftdFee = code.commissionPercentage || 0;
      const ftdCommission = new Prisma.Decimal(ftdFee).mul(ftdCount);

      return {
        ...code,
        ftdCount,
        ftdCommission: ftdCommission.toString(),
        registrations: regs,
      };
    })
  );

  const earningsByUser = await db.influencerEarning.groupBy({
    by: ["sourceUserId"],
    where: { influencerId: mediaBuyerId, sourceUserId: { in: referredUserIds } },
    _sum: { amount: true },
  });
  const commissionMap = new Map(
    earningsByUser.map(e => [e.sourceUserId, e._sum.amount || new Prisma.Decimal(0)])
  );

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
    ngrWithdrawals.map(r => [r.userId, r._sum.amount || new Prisma.Decimal(0)])
  );
  ngrDeposits.forEach(r => {
    const prev = ngrMap.get(r.userId) || new Prisma.Decimal(0);
    ngrMap.set(r.userId, prev.minus(r._sum.amount || new Prisma.Decimal(0)));
  });

  let allUsers = mediaBuyer.assignedPromoCodes.flatMap(code =>
    code.userPromoCodes
      .filter(upc => referredUserIds.includes(upc.user.id))
      .map(upc => ({
        ...upc.user,
        promoCodeUsed: code.code,
        joinedAt: upc.lastUsedAt || upc.user.createdAt,
        totalCommission: commissionMap.get(upc.user.id) || new Prisma.Decimal(0),
        ngr: ngrMap.get(upc.user.id) || new Prisma.Decimal(0),
        hasDeposited: depositSet.has(upc.user.id),
      }))
  );

  if (hasDepositedFilter === "deposited") {
    allUsers = allUsers.filter(u => u.hasDeposited);
  } else if (hasDepositedFilter === "notdeposited") {
    allUsers = allUsers.filter(u => !u.hasDeposited);
  }

  const uniqueUsers = Array.from(new Map(allUsers.map(u => [u.id, u])).values());
  uniqueUsers.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

  const totalReferrals = uniqueUsers.length;
  const skip = (page - 1) * limit;
  const paginatedUsers = uniqueUsers.slice(skip, skip + limit);

  const [totalW, totalD] = await Promise.all([
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
  const totalNgr = (totalW._sum.amount || new Prisma.Decimal(0)).minus(
    totalD._sum.amount || new Prisma.Decimal(0)
  );

  const ownW = await db.transaction.aggregate({
    where: {
      userId: mediaBuyerId,
      type: "withdrawal",
      status: "success",
      ...(dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {}),
    },
    _sum: { amount: true },
  });
  const ownWithdrawals = ownW._sum.amount || new Prisma.Decimal(0);
  const balance = totalFtdCommission.minus(ownWithdrawals);

  return NextResponse.json({
    ...mediaBuyer,
    assignedPromoCodes: enrichedPromoCodes,
    totalReferrals,
    totalCommission: totalFtdCommission,
    totalDeposits: totalDeposits.toString(),
    totalNgr: totalNgr.toString(),
    totalBalance: balance.toString(),
    commissionPercent: mediaBuyer.commissionPercent ?? 0,
    totalOwnWithdrawals: ownWithdrawals.toString(),
    totalFtdCommission: totalFtdCommission.toString(),
    totalRegistrations,
    totalFirstDeposits,
    referredUsers: paginatedUsers,
    referredUsersPagination: {
      currentPage: page,
      totalPages: Math.ceil(totalReferrals / limit),
      totalCount: totalReferrals,
      hasNext: skip + limit < totalReferrals,
      hasPrev: page > 1,
    },
  });
}