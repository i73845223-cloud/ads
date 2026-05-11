"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Link as LinkIcon,
  IndianRupee,
  Users,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  MousePointerClick,
  UserPlus,
  Banknote,
  Download,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatter, dateFormatter } from "@/lib/utils";
import { DatePicker } from "../ui/date-picker";

interface ReferredUsersPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface MediaBuyerDashboard {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: string;
  totalReferrals: number;
  totalCommission: number;
  totalDeposits: string;
  totalWithdrawals: string;
  totalNgr: string;
  totalBalance: string;
  commissionPercent: number;
  totalOwnWithdrawals: string;
  totalFtdCommission: number;
  totalRegistrations: number;
  totalFirstDeposits: number;
  assignedPromoCodes: {
    id: string;
    code: string;
    type: string;
    bonusPercentage: number | null;
    maxBonusAmount: string | null;
    minDepositAmount: string | null;
    freeSpinsCount: number | null;
    freeSpinsGame: string | null;
    cashbackPercentage: number | null;
    wageringRequirement: number | null;
    commissionPercentage: number;
    currentUses: number;
    maxUses: number | null;
    status: string;
    _count: { userPromoCodes: number };
    influencerEarnings: { amount: string }[];
    ftdCount: number;
    ftdCommission: string;
    registrations: number;
  }[];
  referredUsers: {
    id: string;
    name: string | null;
    email: string | null;
    promoCodeUsed: string;
    joinedAt: string;
    totalCommission: string;
    hasDeposited: boolean;
    transactions: {
      id: string;
      type: string;
      amount: string;
      status: string;
      createdAt: string;
    }[];
  }[];
  referredUsersPagination: ReferredUsersPagination;
}

const MediaBuyerDashboardPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userPage = parseInt(searchParams.get("userPage") || "1");

  const [data, setData] = useState<MediaBuyerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [createLinkModalOpen, setCreateLinkModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [balanceDetailsOpen, setBalanceDetailsOpen] = useState(false);
  const [withdrawalsList, setWithdrawalsList] = useState<any[]>([]);
  const [withdrawalsPagination, setWithdrawalsPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [hasDepositedFilter, setHasDepositedFilter] = useState("all");

  const [newLinkForm, setNewLinkForm] = useState({
    description: "",
    type: "DEPOSIT_BONUS",
    bonusPercentage: "",
    maxBonusAmount: "",
    minDepositAmount: "",
    freeSpinsCount: "",
    freeSpinsGame: "",
    cashbackPercentage: "",
    wageringRequirement: "",
    commissionPercentage: "",
    maxUses: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
  });

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: userPage.toString(),
        limit: "10",
      });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("hasDeposited", hasDepositedFilter);
      const response = await fetch(
        `/api/media-buyer/dashboard?${params}`
      );
      if (!response.ok) throw new Error("Failed to fetch");
      const result = await response.json();
      setData(result);
    } catch (error) {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [userPage, dateFrom, dateTo, hasDepositedFilter]);

  const openBalanceDetails = async (page = 1) => {
    setBalanceDetailsOpen(true);
    setLoadingDetails(true);
    try {
      const params = new URLSearchParams({
        details: 'true',
        page: page.toString(),
        limit: '10',
      });
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/media-buyer/balance?${params}`);
      if (res.ok) {
        const d = await res.json();
        setWithdrawalsList(d.withdrawals);
        setWithdrawalsPagination({
          page: d.withdrawalsPagination.page,
          totalPages: d.withdrawalsPagination.totalPages,
          total: d.withdrawalsPagination.total,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };
  
  const handleDetailsPageChange = (newPage: number) => {
    openBalanceDetails(newPage);
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        description: newLinkForm.description,
        type: newLinkForm.type,
        bonusPercentage: newLinkForm.bonusPercentage
          ? parseFloat(newLinkForm.bonusPercentage)
          : null,
        maxBonusAmount: newLinkForm.maxBonusAmount
          ? parseFloat(newLinkForm.maxBonusAmount)
          : null,
        minDepositAmount: newLinkForm.minDepositAmount
          ? parseFloat(newLinkForm.minDepositAmount)
          : null,
        freeSpinsCount: newLinkForm.freeSpinsCount
          ? parseInt(newLinkForm.freeSpinsCount)
          : null,
        freeSpinsGame: newLinkForm.freeSpinsGame || null,
        cashbackPercentage: newLinkForm.cashbackPercentage
          ? parseFloat(newLinkForm.cashbackPercentage)
          : null,
        wageringRequirement: newLinkForm.wageringRequirement
          ? parseInt(newLinkForm.wageringRequirement)
          : null,
        commissionPercentage: newLinkForm.commissionPercentage
          ? parseFloat(newLinkForm.commissionPercentage)
          : 1.0,
        maxUses: newLinkForm.maxUses
          ? parseInt(newLinkForm.maxUses)
          : null,
        startDate: newLinkForm.startDate,
        endDate: newLinkForm.endDate || null,
      };

      const response = await fetch("/api/media-buyer/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create link");
      }

      const responseData = await response.json();
      toast.success(`Link created: ${responseData.code}`);
      setCreateLinkModalOpen(false);
      setNewLinkForm({
        description: "",
        type: "DEPOSIT_BONUS",
        bonusPercentage: "",
        maxBonusAmount: "",
        minDepositAmount: "",
        freeSpinsCount: "",
        freeSpinsGame: "",
        cashbackPercentage: "",
        wageringRequirement: "",
        commissionPercentage: "",
        maxUses: "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: "",
      });
      fetchDashboard();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create link"
      );
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (code: string) => {
    const signupUrl = `https://alt.win/r/${code}`;
    navigator.clipboard.writeText(signupUrl);
    setCopiedCode(code);
    toast.success("Signup link copied");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatAmount = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return formatter.format(num);
  };

  const goToUserPage = (page: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("userPage", page.toString());
    router.push(url.pathname + url.search);
  };

  const handleDownload = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("hasDeposited", hasDepositedFilter);
    window.open(`/api/media-buyer/dashboard/download?${params}`, "_blank");
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex justify-center items-center min-h-40">
          <div className="text-gray-600 text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Not Found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto mt-2 sm:mt-0">
      <div className="mb-6">
        <Card className="bg-black border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-white text-center sm:text-left">
              Available Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
              <div className="text-3xl font-bold text-green-400">
                $ {(data.totalBalance)}
              </div>
              <Button variant="outline" onClick={() => openBalanceDetails()}>
                Details
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={balanceDetailsOpen} onOpenChange={setBalanceDetailsOpen}>
          <DialogContent className="bg-black border-gray-800 max-h-[80vh] overflow-y-auto w-[95vw] sm:max-w-2xl">
              <DialogHeader>
                  <DialogTitle>Balance Calculation</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                  <div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="text-gray-400">FTD Commission</div>
                          <div className="text-right font-mono">$ {(data?.totalFtdCommission || "0")}</div>
                          <div className="text-gray-400">Your Withdrawals</div>
                          <div className="text-right font-mono text-yellow-400">–$ {(data?.totalOwnWithdrawals || "0")}</div>
                          <hr className="col-span-2 border-gray-700" />
                          <div className="text-white font-semibold">Available Balance</div>
                          <div className="text-right font-mono font-bold text-green-400">
                              $ {(data?.totalBalance || "0")}
                          </div>
                      </div>
                  </div>
                  <div>
                      <h3 className="text-sm font-semibold text-gray-400 mb-2">Your Withdrawals</h3>
                      {loadingDetails ? (
                          <div className="text-center py-4 text-gray-400">Loading...</div>
                      ) : withdrawalsList.length === 0 ? (
                          <div className="text-center py-4 text-gray-500">No withdrawals yet.</div>
                      ) : (
                          <>
                              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                  {withdrawalsList.map((w: any) => (
                                      <div key={w.id} className="flex justify-between items-center border-b border-gray-800 pb-2 text-sm">
                                          <div className="text-gray-300">{dateFormatter.toIndianDateTime(w.createdAt)}</div>
                                          <div className="text-yellow-400 font-mono">${(w.amount)}</div>
                                          {/* <div className="text-gray-500 text-xs">{w.description || ''}</div> */}
                                      </div>
                                  ))}
                              </div>
                              {withdrawalsPagination.totalPages > 1 && (
                                  <div className="flex items-center justify-between mt-4 pt-2 border-t border-gray-700">
                                      <div className="text-xs text-gray-400">Page {withdrawalsPagination.page} of {withdrawalsPagination.totalPages}</div>
                                      <div className="flex gap-2">
                                          <Button variant="outline" size="sm" disabled={withdrawalsPagination.page <= 1} onClick={() => handleDetailsPageChange(withdrawalsPagination.page - 1)}>Previous</Button>
                                          <Button variant="outline" size="sm" disabled={withdrawalsPagination.page >= withdrawalsPagination.totalPages} onClick={() => handleDetailsPageChange(withdrawalsPagination.page + 1)}>Next</Button>
                                      </div>
                                  </div>
                              )}
                          </>
                      )}
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setBalanceDetailsOpen(false)}>Close</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row gap-2 items-center sm:items-end mb-6">
        <div className="flex justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-sm text-gray-400">From</Label>
            <DatePicker
              date={dateFrom ? new Date(dateFrom + 'T00:00:00') : undefined}
              onSelect={(d) => {
                if (d) {
                  const year = d.getFullYear();
                  const month = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  setDateFrom(`${year}-${month}-${day}`);
                } else {
                  setDateFrom('');
                }
              }}
              placeholder="Start date"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm text-gray-400">To</Label>
            <DatePicker
              date={dateTo ? new Date(dateTo + 'T00:00:00') : undefined}
              onSelect={(d) => {
                if (d) {
                  const year = d.getFullYear();
                  const month = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  setDateTo(`${year}-${month}-${day}`);
                } else {
                  setDateTo('');
                }
              }}
              placeholder="End date"
            />
          </div>
        </div>
        <div className="flex justify-between gap-2">
          <Button onClick={() => fetchDashboard()} className="sm:self-end">
            Apply
          </Button>
          <Button onClick={handleDownload} variant="outline" className="sm:self-end">
            <Download className="h-4 w-4 mr-1" />
            Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-black border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-400" />
              FTD Commission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $ {(data.totalFtdCommission)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-black border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-green-400" />
              Registrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalRegistrations}</div>
          </CardContent>
        </Card>
        <Card className="bg-black border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Banknote className="h-4 w-4 text-yellow-400" />
              First Deposits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalFirstDeposits}</div>
          </CardContent>
        </Card>
        <Card className="bg-black border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Total Deposits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">
              {formatAmount(data.totalDeposits)}
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg sm:text-xl font-semibold mb-4">Your Promo Codes</h2>
    <div className="rounded-lg shadow-sm border mb-8 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Code</TableHead>
            <TableHead className="whitespace-nowrap">FTD Commission</TableHead>
            <TableHead className="whitespace-nowrap">FTDs</TableHead>
            <TableHead className="whitespace-nowrap">Registrations</TableHead>
            <TableHead className="whitespace-nowrap">Status</TableHead>
            <TableHead className="whitespace-nowrap">Bonus Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.assignedPromoCodes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                No promo codes created yet.
              </TableCell>
            </TableRow>
          ) : (
            data.assignedPromoCodes.map((promo) => (
              <TableRow key={promo.id}>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-800 px-2 py-1 rounded">{promo.code}</code>
                    <button
                      onClick={() => copyToClipboard(promo.code)}
                      className="text-gray-400 hover:text-white"
                    >
                      {copiedCode === promo.code ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  $ {(promo.ftdCommission || "0")}
                </TableCell>
                <TableCell className="whitespace-nowrap">{promo.ftdCount}</TableCell>
                <TableCell className="whitespace-nowrap">{promo.registrations}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    promo.status === "ACTIVE" ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-400"
                  }`}>
                    {promo.status}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {promo.type === "DEPOSIT_BONUS" && promo.bonusPercentage && (
                    <span>{promo.bonusPercentage}% up to {formatAmount(promo.maxBonusAmount || "0")}</span>
                  )}
                  {promo.type === "FREE_SPINS" && promo.freeSpinsCount && (
                    <span>{promo.freeSpinsCount} spins {promo.freeSpinsGame && `on ${promo.freeSpinsGame}`}</span>
                  )}
                  {promo.type === "CASHBACK" && promo.cashbackPercentage && (
                    <span>{promo.cashbackPercentage}% cashback</span>
                  )}
                  {promo.type === "COMBINED" && <span>Multiple bonuses</span>}
                  {promo.wageringRequirement && (
                    <span className="block text-xs text-gray-400">Wager: {promo.wageringRequirement}x</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-semibold">Referred Users</h2>
        <Select
          value={hasDepositedFilter}
          onValueChange={(value) => setHasDepositedFilter(value)}
        >
          <SelectTrigger className="w-[180px] bg-black border-gray-800">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="deposited">Has Deposited</SelectItem>
            <SelectItem value="notdeposited">No Deposit</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-lg shadow-sm border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">User</TableHead>
              <TableHead className="whitespace-nowrap">Promo Code</TableHead>
              <TableHead className="whitespace-nowrap">Joined</TableHead>
              <TableHead className="whitespace-nowrap">Has Deposited</TableHead>
              <TableHead className="whitespace-nowrap">Transactions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.referredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                  No referred users yet.
                </TableCell>
              </TableRow>
            ) : (
              data.referredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {user.name || "Unnamed"}
                      </span>
                      <span className="text-sm text-gray-400 truncate max-w-[200px]">
                        {user.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <code className="bg-gray-800 px-2 py-1 rounded text-sm">
                      {user.promoCodeUsed}
                    </code>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {dateFormatter.toIndianDateTime(user.joinedAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {user.hasDeposited ? (
                      <span className="text-green-400 font-medium">Yes</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      <Link href={`/user/${user.id}/transactions`}>
                        View Transactions
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {data.referredUsersPagination &&
          data.referredUsersPagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
              <div className="text-sm text-gray-400">
                Showing{" "}
                {(data.referredUsersPagination.currentPage - 1) * 10 + 1} to{" "}
                {Math.min(
                  data.referredUsersPagination.currentPage * 10,
                  data.referredUsersPagination.totalCount
                )}{" "}
                of {data.referredUsersPagination.totalCount} users
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    goToUserPage(data.referredUsersPagination.currentPage - 1)
                  }
                  disabled={!data.referredUsersPagination.hasPrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex gap-1">
                  {Array.from(
                    {
                      length: Math.min(
                        5,
                        data.referredUsersPagination.totalPages
                      ),
                    },
                    (_, i) => {
                      let pageNum: number;
                      const total = data.referredUsersPagination.totalPages;
                      const current = data.referredUsersPagination.currentPage;
                      if (total <= 5) pageNum = i + 1;
                      else if (current <= 3) pageNum = i + 1;
                      else if (current >= total - 2)
                        pageNum = total - 4 + i;
                      else pageNum = current - 2 + i;
                      return (
                        <Button
                          key={pageNum}
                          variant={
                            current === pageNum ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => goToUserPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    }
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    goToUserPage(data.referredUsersPagination.currentPage + 1)
                  }
                  disabled={!data.referredUsersPagination.hasNext}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
      </div>

    </div>
  );
};

export default MediaBuyerDashboardPage;