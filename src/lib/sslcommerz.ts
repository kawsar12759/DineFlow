/**
 * SSLCommerz payment gateway (v4 API).
 *
 * A payment is only ever trusted after SSLCommerz's own validation service
 * confirms it — never because a browser arrived at our "success" URL or a
 * form was posted to us, since both can be forged.
 */

export interface GatewayConfig {
  storeId: string;
  storePassword: string;
  sandbox: boolean;
}

export function gatewayConfig(): GatewayConfig | null {
  const storeId = process.env.SSLCOMMERZ_STORE_ID;
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD;
  if (!storeId || !storePassword) return null;
  return {
    storeId,
    storePassword,
    // Real money only when explicitly switched off.
    sandbox: process.env.SSLCOMMERZ_SANDBOX !== "false",
  };
}

function baseUrl(config: GatewayConfig) {
  return config.sandbox
    ? "https://sandbox.sslcommerz.com"
    : "https://securepay.sslcommerz.com";
}

export interface SessionRequest {
  tranId: string;
  amount: number;
  productName: string;
  customer: { name: string; email: string; phone?: string; city?: string };
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
}

/** Opens a hosted payment page; returns the URL to send the owner to. */
export async function createSession(config: GatewayConfig, request: SessionRequest) {
  const body = new URLSearchParams({
    store_id: config.storeId,
    store_passwd: config.storePassword,
    total_amount: request.amount.toFixed(2),
    currency: "BDT",
    tran_id: request.tranId,
    success_url: request.successUrl,
    fail_url: request.failUrl,
    cancel_url: request.cancelUrl,
    ipn_url: request.ipnUrl,
    cus_name: request.customer.name,
    cus_email: request.customer.email,
    cus_phone: request.customer.phone || "01700000000",
    cus_add1: request.customer.city || "Dhaka",
    cus_city: request.customer.city || "Dhaka",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    product_name: request.productName,
    product_category: "Software subscription",
    product_profile: "non-physical-goods",
  });

  const response = await fetch(`${baseUrl(config)}/gwprocess/v4/api.php`, {
    method: "POST",
    body,
  });
  const json = (await response.json().catch(() => null)) as
    | { status?: string; GatewayPageURL?: string; failedreason?: string }
    | null;

  if (!response.ok || json?.status !== "SUCCESS" || !json.GatewayPageURL) {
    throw new Error(json?.failedreason || `SSLCommerz responded ${response.status}`);
  }
  return json.GatewayPageURL;
}

export interface Validation {
  /** VALID or VALIDATED (already validated once) mean the money arrived. */
  status: string;
  tranId: string;
  valId: string;
  amount: number;
  currency: string;
  bankTranId?: string;
  cardType?: string;
  /** "0" is safe; "1" means SSLCommerz wants the payment checked by hand. */
  riskLevel?: string;
  riskTitle?: string;
}

/** Asks SSLCommerz whether a payment really happened. */
export async function validatePayment(
  config: GatewayConfig,
  valId: string
): Promise<Validation | null> {
  const url = new URL(`${baseUrl(config)}/validator/api/validationserverAPI.php`);
  url.searchParams.set("val_id", valId);
  url.searchParams.set("store_id", config.storeId);
  url.searchParams.set("store_passwd", config.storePassword);
  url.searchParams.set("format", "json");

  const response = await fetch(url);
  if (!response.ok) return null;
  const json = (await response.json().catch(() => null)) as Record<string, string> | null;
  if (!json?.status) return null;

  return {
    status: json.status,
    tranId: json.tran_id,
    valId: json.val_id,
    amount: Number(json.currency_amount ?? json.amount),
    currency: json.currency_type ?? json.currency,
    bankTranId: json.bank_tran_id,
    cardType: json.card_type,
    riskLevel: json.risk_level,
    riskTitle: json.risk_title,
  };
}

export function isSuccessfulValidation(validation: Validation) {
  return validation.status === "VALID" || validation.status === "VALIDATED";
}
