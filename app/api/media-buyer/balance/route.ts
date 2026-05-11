import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'MEDIA') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mediaBuyerId = session.user.id;
  const { searchParams } = request.nextUrl;
  const showDetails = searchParams.get('details') === 'true';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  // Build date filter
  const dateFilter: any = {};
  if (dateFrom || dateTo) {
    dateFilter.createdAt = {};
    if (dateFrom) dateFilter.createdAt.gte = new Date(dateFrom);
    if (dateTo) dateFilter.createdAt.lte = new Date(dateTo);
  }

  // ---------- Compute totalFtdCommission (same as dashboard) ----------
  const promoCodes = await db.promoCode.findMany({
    where: { assignedUserId: mediaBuyerId },
    select: { id: true },
  });
  const promoCodeIds = promoCodes.map(p => p.id);

  let totalFtdCommission = new Prisma.Decimal(0);
  if (promoCodeIds.length > 0) {
    const promoCodesDetails = await db.promoCode.findMany({
      where: { id: { in: promoCodeIds } },
      select: { id: true, commissionPercentage: true },
    });

    for (const pc of promoCodesDetails) {
      const ftdFee = pc.commissionPercentage || 0;
      const usersOfCode = await db.userPromoCode.findMany({
        where: { promoCodeId: pc.id },
        select: { userId: true },
      });
      const userIdsForCode = [...new Set(usersOfCode.map(u => u.userId))];

      if (userIdsForCode.length > 0) {
        const ftdFilter: any = {
          userId: { in: userIdsForCode },
          type: 'deposit',
          status: 'success',
        };
        if (dateFrom || dateTo) {
          ftdFilter.createdAt = {};
          if (dateFrom) ftdFilter.createdAt.gte = new Date(dateFrom);
          if (dateTo) ftdFilter.createdAt.lte = new Date(dateTo);
        }
        const ftdGroup = await db.transaction.groupBy({
          by: ['userId'],
          where: ftdFilter,
          _count: { userId: true },
        });
        const ftdCount = ftdGroup.length;
        totalFtdCommission = totalFtdCommission.add(new Prisma.Decimal(ftdFee).mul(ftdCount));
      }
    }
  }

  // ---------- Own withdrawals (within period) ----------
  const ownWithdrawalsAgg = await db.transaction.aggregate({
    where: {
      userId: mediaBuyerId,
      type: 'withdrawal',
      status: 'success',
      ...(dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {}),
    },
    _sum: { amount: true },
  });
  const ownWithdrawals = ownWithdrawalsAgg._sum.amount || new Prisma.Decimal(0);

  // Balance = FTD Commission - Own Withdrawals
  const finalBalance = totalFtdCommission.minus(ownWithdrawals);

  // ---------- Withdrawals list (paginated, for details modal) ----------
  let withdrawalsList: any[] = [];
  let withdrawalsTotal = 0;
  if (showDetails) {
    const skip = (page - 1) * limit;
    const [list, count] = await Promise.all([
      db.transaction.findMany({
        where: {
          userId: mediaBuyerId,
          type: 'withdrawal',
          status: 'success',
          ...(dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {}),
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: { id: true, amount: true, createdAt: true, description: true },
      }),
      db.transaction.count({
        where: {
          userId: mediaBuyerId,
          type: 'withdrawal',
          status: 'success',
          ...(dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {}),
        },
      }),
    ]);
    withdrawalsList = list;
    withdrawalsTotal = count;
  }

  return NextResponse.json({
    totalFtdCommission: totalFtdCommission.toString(),
    ownWithdrawals: ownWithdrawals.toString(),
    balance: finalBalance.toString(),
    ...(showDetails && {
      withdrawals: withdrawalsList,
      withdrawalsPagination: {
        page,
        limit,
        total: withdrawalsTotal,
        totalPages: Math.ceil(withdrawalsTotal / limit),
      },
    }),
  });
}