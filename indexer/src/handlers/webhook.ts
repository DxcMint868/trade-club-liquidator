import fetch from "node-fetch";
import { createHmac } from "crypto";

function serializer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

export interface MonachadVaultContext {
  monachad: `0x${string}`;
  matchId: string;
  matchVaultAddress: `0x${string}`;
}

/**
 * Send webhook notification to backend
 * Backend will handle event emission and copy-trading logic
 */
export async function notifyBackend(eventType: string, data: any = {}) {
  const webhookUrl =
    process.env.BACKEND_WEBHOOK_URL || "http://localhost:3000/webhooks/envio";
  const webhookSecret = process.env.ENVIO_WEBHOOK_SECRET;

  try {
    const payload: Record<string, unknown> = {
      eventType,
      timestamp: Date.now(),
    };

    if (data !== null && typeof data === "object" && !Array.isArray(data)) {
      Object.assign(payload, data);
    } else if (data !== undefined) {
      payload.payload = data;
    }

    let signature: string | undefined;
    if (webhookSecret) {
      const hmac = createHmac("sha256", webhookSecret);
      hmac.update(JSON.stringify(payload, serializer));
      signature = hmac.digest("hex");
    }

    console.log(
      `[notifyBackend] Dispatching ${eventType} → ${webhookUrl} (signature=${
        signature ? "yes" : "no"
      })`
    );

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "X-Envio-Signature": signature } : {}),
      },
      body: JSON.stringify(payload, serializer),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Webhook failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    } else {
      console.log(
        `[notifyBackend] ${eventType} acknowledged (${response.status})`
      );
    }
  } catch (error) {
    console.error("Failed to send webhook:", error);
  }
}

/**
 * Check if an address is a Monachad in any match
 * Used to filter DEX events - we only care about Monachads' trades
 */
export async function getMonachadIfTraderIsVault(
  context: any,
  traderAddr: string
): Promise<MonachadVaultContext | null> {
  try {
    const normalizedTrader = traderAddr.toLowerCase();
    const vaultRecords = await context.MatchVault.getWhere.matchVaultAddress.eq(
      normalizedTrader
    );
    console.log("Match vault records:", vaultRecords);

    if (!Array.isArray(vaultRecords) || vaultRecords.length === 0) {
      return null;
    }

    if (vaultRecords.length > 1) {
      console.warn(
        "Multiple vault records found for address",
        normalizedTrader
      );
    }

    const vaultRecord = vaultRecords[0];
    if (!vaultRecord || !vaultRecord.monachad) {
      console.warn("Vault record missing monachadAddress", normalizedTrader);
      return null;
    }

    return {
      monachad: vaultRecord.monachad.toLowerCase() as `0x${string}`,
      matchId: vaultRecord.matchId?.toString() ?? "",
      matchVaultAddress: normalizedTrader as `0x${string}`,
    };
  } catch (error) {
    console.error("Error checking if address is Monachad's vault:", error);
    return null;
  }
}
