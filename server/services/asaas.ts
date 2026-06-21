/**
 * Cliente Asaas (PIX) — Sprint 4 (cobrança real).
 * Cliente puro de API: encontra/cria customer, gera cobrança PIX e lê o QR/status.
 * A chave fica SÓ no .env (ASAAS_API_KEY). Sem chave → asaasEnabled() = false (UI cai no aviso).
 * Produção: ASAAS_BASE_URL padrão https://api.asaas.com/v3
 * Sandbox:  defina ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
 */
const BASE = process.env.ASAAS_BASE_URL || "https://api.asaas.com/v3";

function headers() {
  return {
    access_token: process.env.ASAAS_API_KEY || "",
    "Content-Type": "application/json",
    "User-Agent": "cacarejar",
  };
}

export function asaasEnabled(): boolean {
  return !!process.env.ASAAS_API_KEY;
}

function dueDatePlus(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

/** Encontra (por externalReference) ou cria o customer no Asaas. Retorna o id ou lança com a msg do Asaas. */
export async function ensureCustomer(params: { orgId: number; name: string; email?: string; cpfCnpj?: string }): Promise<string> {
  const ref = `org:${params.orgId}`;
  // 1) tenta achar
  try {
    const r = await fetch(`${BASE}/customers?externalReference=${encodeURIComponent(ref)}&limit=1`, { headers: headers() });
    if (r.ok) {
      const d = (await r.json()) as any;
      if (Array.isArray(d?.data) && d.data[0]?.id) {
        const existing = d.data[0];
        // Se forneceu CPF/CNPJ e o customer não tem, atualiza antes de retornar
        if (params.cpfCnpj && !existing.cpfCnpj) {
          await fetch(`${BASE}/customers/${existing.id}`, {
            method: "PUT",
            headers: headers(),
            body: JSON.stringify({ cpfCnpj: params.cpfCnpj.replace(/\D/g, "") }),
          }).catch(() => {/* ignora erro de update, a criação da cobrança dirá */});
        }
        return existing.id;
      }
    }
  } catch { /* segue para criar */ }
  // 2) cria
  const body: Record<string, unknown> = { name: params.name || `Org ${params.orgId}`, externalReference: ref };
  if (params.email) body.email = params.email;
  if (params.cpfCnpj) body.cpfCnpj = params.cpfCnpj.replace(/\D/g, "");
  const res = await fetch(`${BASE}/customers`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const data = (await res.json()) as any;
  if (!res.ok || !data?.id) {
    const msg = data?.errors?.[0]?.description || `Falha ao criar cliente no Asaas (HTTP ${res.status}).`;
    throw new Error(msg);
  }
  return data.id;
}

export interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  invoiceUrl?: string;
}

/** Cria uma cobrança PIX. Retorna o pagamento Asaas (com id) ou lança com a msg do Asaas. */
export async function createPixPayment(params: { customerId: string; value: number; description: string; externalReference: string }): Promise<AsaasPayment> {
  const body = {
    customer: params.customerId,
    billingType: "PIX",
    value: params.value,
    dueDate: dueDatePlus(1),
    description: params.description,
    externalReference: params.externalReference,
  };
  const res = await fetch(`${BASE}/payments`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const data = (await res.json()) as any;
  if (!res.ok || !data?.id) {
    const msg = data?.errors?.[0]?.description || `Falha ao criar cobranca no Asaas (HTTP ${res.status}).`;
    throw new Error(msg);
  }
  return { id: data.id, status: data.status, value: data.value, invoiceUrl: data.invoiceUrl };
}

export interface PixQr {
  payload: string;       // copia-e-cola
  encodedImage: string;  // PNG base64 (sem prefixo data:)
  expirationDate?: string;
}

/** Lê o QR Code PIX (copia-e-cola + imagem) de uma cobrança. */
export async function getPixQr(paymentId: string): Promise<PixQr | null> {
  try {
    const res = await fetch(`${BASE}/payments/${paymentId}/pixQrCode`, { headers: headers() });
    if (!res.ok) return null;
    const d = (await res.json()) as any;
    if (!d?.payload) return null;
    return { payload: d.payload, encodedImage: d.encodedImage, expirationDate: d.expirationDate };
  } catch {
    return null;
  }
}

/** Consulta o status atual de uma cobrança no Asaas. */
export async function getPayment(paymentId: string): Promise<{ status: string } | null> {
  try {
    const res = await fetch(`${BASE}/payments/${paymentId}`, { headers: headers() });
    if (!res.ok) return null;
    const d = (await res.json()) as any;
    return { status: d?.status ?? "UNKNOWN" };
  } catch {
    return null;
  }
}

/** Status do Asaas que significam "pago/liquidado". */
export function isPaidStatus(status?: string): boolean {
  return status === "RECEIVED" || status === "CONFIRMED" || status === "RECEIVED_IN_CASH";
}
