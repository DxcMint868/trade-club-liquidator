function serializer(key: string, value: any): any {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

const obj = {
  params: {
    positionId: 2n,
    trader: "0x953674f672475ec0A1aBE55156400c6F0086E90a",
    assetId: 1n,
    positionType: 1n,
    collateral: 10000000000000000n,
    size: 20000000000000000n,
    leverage: 2n,
    entryPrice: 1932363759175221379072n,
    timestamp: 1760794440n,
  },
  chainId: 11155111,
  srcAddress: "0x16b0c1DCF87EBB4e0A0Ba4514FF0782CCE7889Cb",
  logIndex: 21,
  transaction: {
    hash: "0x2f6c53c36b03184a626096a82307d6d5627165d7182570339a22d68e3c96681b",
  },
  block: {
    number: 9438547,
    hash: "0x536510b957b57b666baf58915a03268d22d5bf9b9ccdc1357ad9070bae1d10db",
    timestamp: 1760794440,
  },
};

console.log(JSON.stringify(obj, serializer, 2));
