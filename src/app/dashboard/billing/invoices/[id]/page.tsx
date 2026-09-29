import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";
import { ArrowLeft, UtensilsCrossed } from "lucide-react";
import { auth } from "@/auth";
import { loadActiveUser } from "@/lib/api-helpers";
import { Restaurant, SubscriptionPayment, User } from "@/models";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PrintButton } from "@/components/shared/print-button";
import { APP_NAME, PLANS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

/** A printable invoice for one paid subscription period. Owners only. */
export default async function InvoicePage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await loadActiveUser(session.user.id);
  if (!user?.restaurantId || user.role !== "owner") notFound();
  if (!Types.ObjectId.isValid(id)) notFound();

  const payment = await SubscriptionPayment.findOne({
    _id: new Types.ObjectId(id),
    restaurantId: user.restaurantId,
    status: "paid",
  }).lean();
  if (!payment?.invoiceNumber) notFound();

  const restaurant = await Restaurant.findById(payment.restaurantId)
    .select("name email phone ownerId")
    .lean();
  const owner = restaurant
    ? await User.findById(restaurant.ownerId).select("name email").lean()
    : null;

  const plan = PLANS[payment.plan];
  const details = payment.gatewayDetails;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href="/dashboard/billing">
            <ArrowLeft className="h-4 w-4" />
            Billing
          </Link>
        </Button>
        <PrintButton />
      </div>

      <Card className="mx-auto w-full max-w-3xl print:border-0 print:shadow-none">
        <CardContent className="space-y-8 p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-lg font-semibold">{APP_NAME}</p>
                <p className="text-sm text-muted-foreground">Restaurant operations software</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold tracking-tight">Invoice</p>
              <p className="font-mono text-sm">{payment.invoiceNumber}</p>
              <p className="text-sm text-muted-foreground">
                Paid {payment.paidAt ? formatDate(payment.paidAt) : ""}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Billed to
            </p>
            <p className="mt-1 font-medium">{restaurant?.name}</p>
            {owner && <p className="text-sm text-muted-foreground">{owner.name} · {owner.email}</p>}
            {restaurant?.phone && <p className="text-sm text-muted-foreground">{restaurant.phone}</p>}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-3">
                  <p className="font-medium">
                    {APP_NAME} {plan.name} — {payment.period === "yearly" ? "1 year" : "1 month"}
                  </p>
                  {payment.periodStart && payment.periodEnd && (
                    <p className="text-muted-foreground">
                      Service from {formatDate(payment.periodStart)} to {formatDate(payment.periodEnd)}
                    </p>
                  )}
                </td>
                <td className="py-3 text-right align-top">{formatCurrency(payment.amount)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 text-right font-semibold">Total paid</td>
                <td className="pt-3 text-right text-base font-semibold">
                  {formatCurrency(payment.amount)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="space-y-1 rounded-lg bg-muted px-4 py-3 text-sm">
            <p>
              Paid through SSLCommerz
              {details?.cardType ? ` · ${details.cardType}` : ""}
            </p>
            <p className="text-muted-foreground">
              Reference {payment.tranId}
              {details?.bankTranId ? ` · Bank transaction ${details.bankTranId}` : ""}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Amounts are in Bangladeshi Taka (BDT). Thank you for choosing {APP_NAME}.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
