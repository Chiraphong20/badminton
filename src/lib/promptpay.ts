import generatePayload from 'promptpay-qr';

/**
 * Builds a PromptPay QR payload (EMV QR Code, Merchant-Presented Mode) for the given
 * PromptPay ID (phone number, citizen/tax ID, or e-Wallet ID) and amount.
 * See https://github.com/dtinth/promptpay-qr
 *
 * Returns null if promptPayId is empty or the amount isn't a positive number — callers
 * use this to decide whether a QR is even showable (e.g. hide the "จ่ายผ่าน PromptPay"
 * option entirely when the shop hasn't configured a PromptPay ID yet).
 */
export function buildPromptPayPayload(promptPayId: string, amount: number): string | null {
  const id = promptPayId.trim();
  if (!id || !isFinite(amount) || amount <= 0) return null;
  try {
    return generatePayload(id, { amount });
  } catch {
    return null;
  }
}
