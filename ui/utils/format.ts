import { formatEther } from "viem";

export const safeFormatEther = (value?: string | bigint | number | null) => {
  try {
    if (value === null || value === undefined) {
      return "0";
    }

    if (typeof value === "bigint") {
      return formatEther(value);
    }

    if (typeof value === "number") {
      return formatEther(BigInt(Math.trunc(value)));
    }

    const normalized = value.toString();
    if (!normalized.length) {
      return "0";
    }

    return formatEther(BigInt(normalized));
  } catch (error) {
    console.warn("Failed to format wei to ether", error);
    return "0";
  }
};
