// Always-visible testnet disclosure (hard rule §1.7).
export function TestnetBanner() {
  return (
    <div className="testnet-banner" role="note">
      Demo on Sui testnet — no real money.
    </div>
  );
}
