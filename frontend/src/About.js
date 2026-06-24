import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Comprehensive educational page about how SushiSwap staking (xSUSHI) works.
 * Faithfully reproduced from the original version.
 */
function About() {
  return (
    <div style={{
      padding: '40px 20px',
      backgroundColor: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '100vh',
      boxSizing: 'border-box',
      lineHeight: '1.6'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        <Link
          to="/"
          style={{
            display: 'inline-block',
            color: 'var(--text-muted)',
            textDecoration: 'none',
            marginBottom: '20px',
            fontSize: '14px',
            borderBottom: '1px dashed transparent',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.target.style.color = 'var(--text)';
            e.target.style.borderBottom = '1px dashed var(--text)';
          }}
          onMouseLeave={(e) => {
            e.target.style.color = 'var(--text-muted)';
            e.target.style.borderBottom = '1px dashed transparent';
          }}
        >
          &larr; Back to Live Dashboard
        </Link>

        <h1 style={{ fontSize: '28px', color: 'var(--accent)', marginBottom: '30px', borderBottom: '1px solid var(--border)', paddingBottom: '15px' }}>
          A Comprehensive Guide to SushiSwap Staking (xSUSHI)
        </h1>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '22px', color: '#38bdf8', marginBottom: '15px' }}>1. What is xSUSHI?</h2>
          <p>
            <strong>xSUSHI</strong> is a token that represents your share in the SushiBar staking pool. When you stake your SUSHI tokens, you receive xSUSHI in return.
          </p>
          <div style={{ backgroundColor: 'var(--card-bg)', padding: '20px', borderRadius: '8px', borderLeft: '4px solid var(--accent)', marginTop: '15px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: 'var(--text)' }}>The Economic Model</h3>
            <ul style={{ paddingLeft: '20px', margin: 0 }}>
              <li style={{ marginBottom: '8px' }}><strong>Entry:</strong> You swap SUSHI for xSUSHI at the current exchange rate.</li>
              <li style={{ marginBottom: '8px' }}><strong>Holding:</strong> While you hold xSUSHI, the protocol buys back SUSHI from the market using collected trading fees and adds them to the pool.</li>
              <li style={{ marginBottom: '8px' }}><strong>Result:</strong> The number of xSUSHI tokens you hold does not change, but each xSUSHI token becomes &ldquo;heavier&rdquo; (more valuable) as it is now backed by more SUSHI.</li>
              <li><strong>Exit:</strong> You swap xSUSHI back for SUSHI. You receive your original deposit plus a share of all fees accumulated.</li>
            </ul>
          </div>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '22px', color: '#38bdf8', marginBottom: '15px' }}>2. Where Does the Money Come From?</h2>
          <p>The source of income for stakers is the exchange's trading fees.</p>
          <ol style={{ paddingLeft: '20px' }}>
            <li style={{ marginBottom: '10px' }}>In classic <strong>SushiSwap V2</strong> pools, the trading fee is <strong>0.3%</strong>.</li>
            <li style={{ marginBottom: '10px' }}>Of this, <strong>0.25%</strong> goes directly to Liquidity Providers (LPs).</li>
            <li style={{ marginBottom: '10px' }}>The remaining <strong>0.05%</strong> is the &ldquo;protocol fee&rdquo;. These funds are extracted from the pools in the form of LP tokens and sent to a dedicated fee collector contract.</li>
          </ol>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Note: Currently, the vast majority of real rewards come from V2 pools on the Ethereum Mainnet.
          </p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '22px', color: '#38bdf8', marginBottom: '15px' }}>3. Technical Implementation: How SushiMaker Works</h2>
          <p>
            The process of converting collected fees into rewards is not automatic. It is managed by the <strong>SushiMaker</strong> contract (<a href="https://etherscan.io/address/0x5ad6211cd3fde39a9cecb5df6f380b8263d1e277#asset-multichain" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', wordBreak: 'break-all' }}>0x5ad6211CD3fdE39A9cECB5df6f380b8263d1e277</a>).
          </p>

          <div style={{ backgroundColor: '#1a3a2a', borderLeft: '4px solid #4ade80', padding: '12px 16px', borderRadius: '4px', margin: '12px 0', fontSize: '14px' }}>
            <strong style={{ color: '#4ade80' }}>UPD (2025-12-04):</strong> The developers have migrated the fee collection and distribution contract. The new SushiMaker contract is now at{' '}
            <a href="https://etherscan.io/address/0x1d2af2b99e253b68d72c76484dd88ffb0ace158c#asset-multichain" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', wordBreak: 'break-all' }}>
              0x1d2aF2B99e253B68d72C76484DD88FFB0Ace158c
            </a>. Both addresses are now tracked for total fees awaiting distribution.
          </div>

          <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
            <div style={{ backgroundColor: 'var(--card-bg)', padding: '15px', borderRadius: '8px' }}>
              <strong style={{ color: 'var(--accent)', display: 'block', marginBottom: '5px' }}>Phase 1: Unwind</strong>
              The contract receives thousands of different LP tokens (the &ldquo;raw material&rdquo;). A trusted bot calls the function to burn these LP tokens and receive the underlying assets (ETH, USDC, etc.).
            </div>

            <div style={{ backgroundColor: 'var(--card-bg)', padding: '15px', borderRadius: '8px' }}>
              <strong style={{ color: 'var(--accent)', display: 'block', marginBottom: '5px' }}>Phase 2: Liquidation (Convert to WETH)</strong>
              All disparate tokens are sequentially swapped for <strong>WETH (Wrapped Ethereum)</strong>. This is the stage our service monitors. A growing WETH balance means a payout is imminent.
              <br/>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '5px', display: 'block' }}>
                You can track this accumulation on our <Link to="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>live progress bar</Link>.
              </span>
            </div>

            <div style={{ backgroundColor: 'var(--card-bg)', padding: '15px', borderRadius: '8px' }}>
              <strong style={{ color: 'var(--accent)', display: 'block', marginBottom: '5px' }}>Phase 3: Buyback &amp; Serve</strong>
              When enough WETH accumulates, the bot buys SUSHI on the open market. To avoid slippage, it often splits large amounts into smaller transactions (e.g., selling 0.5 WETH at a time). The purchased SUSHI is <strong>instantly</strong> sent to the xSUSHI contract.
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '22px', color: '#38bdf8', marginBottom: '15px' }}>4. Why is the Payout Graph Irregular?</h2>
          <p>You might notice the xSUSHI/SUSHI rate grows in &ldquo;steps&rdquo; with long pauses. This is intentional:</p>
          <ul style={{ paddingLeft: '20px' }}>
            <li style={{ marginBottom: '10px' }}><strong>Gas Efficiency:</strong> Collecting &ldquo;dust&rdquo; daily is unprofitable. The protocol waits for a substantial amount (tens of thousands of USD) to accumulate.</li>
            <li style={{ marginBottom: '10px' }}><strong>Manual Trigger:</strong> The contract functions are triggered by a team-managed bot, not automatically.</li>
            <li><strong>Cross-Chain Delays:</strong> Funds from other networks (Polygon, Arbitrum) must be bridged to Ethereum Mainnet, which takes time.</li>
          </ul>
        </section>

        <section style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
           <h2 style={{ fontSize: '22px', color: 'var(--accent)', marginBottom: '15px' }}>5. What Our xSUSHI Tracker Provides</h2>
           <p>
             Our service, available at the <Link to="/" style={{ color: 'var(--accent)', textDecoration: 'none', borderBottom: '1px solid var(--accent)' }}>main dashboard</Link>, offers real-time transparency and critical metrics to help you monitor your xSUSHI staking performance.
           </p>

           <ul style={{ paddingLeft: '20px', margin: '15px 0' }}>
               <li style={{ marginBottom: '10px' }}><strong>Fees Awaiting Distribution:</strong> We display the current total USD value of tokens accumulated in the SushiMaker contract, along with the precise <strong>WETH balance</strong> ready for the SUSHI buyback and distribution phase.</li>
               <li style={{ marginBottom: '10px' }}><strong>Real-Time Ratio Values:</strong> Instantaneous display of the <strong>xSUSHI/SUSHI</strong> and <strong>SUSHI/xSUSHI</strong> exchange rates.</li>
               <li style={{ marginBottom: '10px' }}><strong>Historical Ratio Chart:</strong> A responsive graph showing the ratio history over time, with clear <strong>timestamps</strong> and the <strong>percentage change</strong> since the previous data point, allowing you to easily visualize the &ldquo;step&rdquo; increases from distributions.</li>
               <li style={{ marginBottom: '10px' }}><strong>Payout Notifications:</strong> You can <strong>subscribe to instant Telegram notifications</strong> via our dedicated bot. You will be alerted the moment the SushiMaker contract executes a buyback and the xSUSHI ratio changes, ensuring you never miss a reward event.</li>
           </ul>

           <p>
             This tracker eliminates the need to manually check the blockchain, providing a concise and actionable view of your staking rewards.
           </p>
        </section>
      </div>
    </div>
  );
}

export default About;
