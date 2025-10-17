import hre from "hardhat";

export async function tryVerifyContractOnExplorer(
  contractAddr: string,
  constructorArgs: any[] = [],
  retries: number = 3,
  retryIntervalSecs: number = 45
): Promise<void> {
  while (retries >= 0) {
    try {
      console.log(`Verifying contract at ${contractAddr} on explorer...`);
      await hre.run("verify:verify", {
        address: contractAddr,
        constructorArguments: constructorArgs,
      });
      console.log("Contract verified successfully!");
      break;
    } catch (e: any) {
      console.log("Error verifying contract:\n", e.message ?? e);

      if (e.message && e.message.toLowerCase().includes("already verified")) {
        break;
      }

      console.log(`Retrying in ${retryIntervalSecs} seconds... (${retries} attempts left)`);
      retries--;
      await new Promise((resolve) => setTimeout(resolve, retryIntervalSecs * 1000));
    }
  }
}
