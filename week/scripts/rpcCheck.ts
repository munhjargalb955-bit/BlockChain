const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const giveChainAddress = process.env.GIVECHAIN_ADDRESS;
type JsonRpcResponse = { jsonrpc: "2.0"; id: number; result?: unknown; error?: { code: number; message: string } };

let requestId = 1;

async function rpc(method: string, params: unknown[] = []): Promise<unknown> {
  const r = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: requestId++, method, params })
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = (await r.json()) as JsonRpcResponse;
  if (d.error) throw new Error(`RPC ${d.error.code}`);
  return d.result;
}

async function main() {
  const chainIdHex = await rpc("eth_chainId") as string;
  console.log("Chain ID(hex):", chainIdHex);
  console.log("Chain ID(decimal):", Number(BigInt(chainIdHex)));

  const blockNumberHex = await rpc("eth_blockNumber") as string;
  console.log("Block Number:", Number(BigInt(blockNumberHex)));

  const accounts = await rpc("eth_accounts") as string[];
  const firstAccount = accounts[0];
  console.log("First Account:", firstAccount);

  const balanceHex = await rpc("eth_getBalance", [firstAccount, "latest"]) as string;
  console.log("Balance(wei):", BigInt(balanceHex));

  if (giveChainAddress) {
    const code = await rpc("eth_getCode", [giveChainAddress, "latest"]) as string;
    console.log("GiveChain Address:", giveChainAddress);
    console.log("Contract Code Exists:", code !== "0x");
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
