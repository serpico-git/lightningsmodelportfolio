/* eslint-disable react-hooks/static-components */
import { useState, useMemo, useEffect } from 'react'
import axios from 'axios'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts'

// Warm, coral-toned sequence for sector allocation (replaces the zinc grayscale set)
const COLORS = ['#D97757', '#C15F3C', '#7C756E', '#A69C87', '#E8DFD1']

/**
 * ---------------------------------------------------------------------------
 * Theme tokens — Claude-style shadcn palette
 * ---------------------------------------------------------------------------
 * Plain shadcn/ui CSS variables (HSL triplets) tuned to Claude's visual
 * language: warm cream canvas, near-black warm text, terracotta/coral accent.
 */
const ThemeTokens = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&family=Inter:wght@400;500;600;700&display=swap');

    :root {
      --background: 48 33% 97%;
      --foreground: 20 14% 12%;
      --card: 0 0% 100%;
      --card-foreground: 20 14% 12%;
      --muted: 40 20% 93%;
      --muted-foreground: 30 6% 46%;
      --border: 40 20% 88%;
      --input: 40 20% 88%;
      --primary: 16 65% 60%;
      --primary-foreground: 0 0% 100%;
      --secondary: 40 20% 93%;
      --secondary-foreground: 20 14% 12%;
      --accent: 16 45% 92%;
      --accent-foreground: 16 65% 35%;
      --destructive: 5 65% 50%;
      --destructive-foreground: 0 0% 100%;
      --success: 150 30% 35%;
      --success-foreground: 0 0% 100%;
      --ring: 16 65% 60%;
      --radius: 0.75rem;
    }

    .font-claude-sans { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
    .font-claude-serif { font-family: 'Source Serif 4', ui-serif, Georgia, serif; }
  `}</style>
)

// Custom Tooltip for the Line Chart to format Percentages
const ChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="min-w-[150px] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-[0_4px_16px_rgba(35,29,26,0.08)]">
        <p className="mb-2 border-b border-[hsl(var(--border)/60%)] pb-2 text-sm font-medium text-[hsl(var(--foreground))]">
          {label}
        </p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-[hsl(var(--muted-foreground))]">{entry.name}:</span>
              </div>
              <span
                className={`font-medium ${entry.value >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'
                  }`}
              >
                {entry.value > 0 ? '+' : ''}
                {entry.value.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Small numbered section primitive used throughout the methodology write-up
// ---------------------------------------------------------------------------
const Section = ({ number, title, children, first }) => (
  <div className={`px-6 py-8 md:px-10 md:py-10 ${first ? '' : 'border-t border-[hsl(var(--border))]'}`}>
    <div className="flex items-baseline gap-3">
      <span className="font-claude-serif text-sm text-[hsl(var(--primary))]">{number}</span>
      <h3 className="font-claude-serif text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
        {title}
      </h3>
    </div>
    <div className="mt-4 space-y-4 text-sm leading-relaxed text-[hsl(var(--foreground)/85%)]">{children}</div>
  </div>
)

const CheckItem = ({ children }) => (
  <li className="flex items-start gap-2.5">
    <svg
      className="mt-0.5 h-4 w-4 flex-shrink-0 text-[hsl(var(--success))]"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M6 10.2l2.6 2.6L14.4 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span>{children}</span>
  </li>
)

// ---------------------------------------------------------------------------
// Methodology / About section — sits between the holdings table and footer
// ---------------------------------------------------------------------------
const PortfolioMethodology = () => (
  <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[0_1px_3px_rgba(35,29,26,0.06)]">
    <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary)/60%)] px-6 py-6 md:px-10">
      <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">About this portfolio</p>
      <h2 className="font-claude-serif mt-1 text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
        Welcome to My Model Portfolio
      </h2>
    </div>

    <Section number="01" title="Introduction to Model Portfolios" first>
      <p>
        A model portfolio is a curated, structured selection of assets designed to execute a specific investment
        strategy — a transparent, real-world blueprint for capital allocation. Tracking one gives investors two
        real advantages:
      </p>
      <ul className="space-y-2">
        <li>
          <span className="font-medium text-[hsl(var(--foreground))]">Niche Focus.</span> It isolates a specific
          investment theme or methodology, so you can see exactly how a distinct style performs over time without
          mixing it with other market noise.
        </li>
        <li>
          <span className="font-medium text-[hsl(var(--foreground))]">Data-Driven Decisions.</span> A structured
          approach removes emotional biases — like panic-selling or chasing hype — keeping the focus on
          fundamentals and objective performance metrics.
        </li>
      </ul>
    </Section>

    <Section number="02" title="Investment Objective & Benchmark">
      <p>
        The primary objective of this portfolio is absolute capital appreciation, with a clear target: to
        outperform the Nifty 50 index on a risk-adjusted basis.
      </p>
      <div className="overflow-hidden rounded-xl border border-[hsl(var(--border))]">
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-[hsl(var(--border))]">
            <tr>
              <td className="w-1/3 bg-[hsl(var(--secondary)/50%)] px-4 py-3 font-medium text-[hsl(var(--foreground))]">
                Benchmark Index
              </td>
              <td className="px-4 py-3 text-[hsl(var(--foreground)/85%)]">Nifty 50</td>
            </tr>
            <tr>
              <td className="w-1/3 bg-[hsl(var(--secondary)/50%)] px-4 py-3 font-medium text-[hsl(var(--foreground))]">
                Target
              </td>
              <td className="px-4 py-3 text-[hsl(var(--foreground)/85%)]">
                Deliver alpha (excess returns) relative to the benchmark over a multi-year cycle
              </td>
            </tr>
            <tr>
              <td className="w-1/3 bg-[hsl(var(--secondary)/50%)] px-4 py-3 font-medium text-[hsl(var(--foreground))]">
                Core Philosophy
              </td>
              <td className="px-4 py-3 text-[hsl(var(--foreground)/85%)]">
                Wealth preservation coupled with compounding growth
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Section>

    <Section number="03" title="Investment Methodology: Blue-Chips at a Discount">
      <p>
        My core strategy is rooted in value investing within the large-cap space. I do not speculate on highly
        volatile, unproven companies. Instead, the strategy follows a rigorous two-step filter.
      </p>
      <ol className="space-y-3">
        <li className="flex gap-3">
          <span className="font-claude-serif text-[hsl(var(--primary))]">1.</span>
          <span>
            <span className="font-medium text-[hsl(var(--foreground))]">Identify the Giants.</span> Focus
            exclusively on market leaders — companies with robust balance sheets, strong competitive moats
            (pricing power), excellent corporate governance, and consistent cash flows.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-claude-serif text-[hsl(var(--primary))]">2.</span>
          <span>
            <span className="font-medium text-[hsl(var(--foreground))]">Wait for the Discount.</span> Capital is
            only deployed when macro trends, temporary sectoral headwinds, or broader market corrections
            misprice these high-quality stocks.
          </span>
        </li>
      </ol>
      <p>
        By purchasing them below their intrinsic value, we build a "margin of safety" into the portfolio,
        reducing downside risk while maximizing long-term upside.
      </p>
    </Section>

    <Section number="04" title="Is This Model Portfolio for You?">
      <p>
        This portfolio is not a "get-rich-quick" trading strategy. It is built for a specific type of investor
        profile. This portfolio is an ideal fit if you:
      </p>
      <ul className="space-y-2.5">
        <CheckItem>Have managed, or have low, high-interest personal debt.</CheckItem>
        <CheckItem>Have surplus cash that you do not need access to for immediate livelihood.</CheckItem>
        <CheckItem>Do not have any major short-term financial liabilities or goals within the next few years.</CheckItem>
        <CheckItem>Understand that equity markets experience natural volatility and are comfortable holding through market cycles.</CheckItem>
      </ul>
    </Section>

    <Section number="05" title="Time Horizon">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/50%)] px-5 py-4 sm:w-56 sm:flex-shrink-0">
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Minimum Recommendation</p>
          <p className="font-claude-serif mt-1 text-3xl font-semibold text-[hsl(var(--foreground))]">3 Years</p>
        </div>
        <p>
          <span className="font-medium text-[hsl(var(--foreground))]">The Golden Rule:</span> the longer your
          holding window, the more time these high-quality businesses have to compound their earnings. Equity
          compounding is rarely a straight line — do not expect linear or meaningful outperformance within the
          first 12 to 24 months. Patience is our greatest asset.
        </p>
      </div>
    </Section>

    <Section number="06" title="Portfolio Governance & Key Dates">
      <div>
        <p className="font-medium text-[hsl(var(--foreground))]">Rebalancing Schedule</p>
        <p className="mt-1">
          Portfolio rebalancing will be conducted on a discretionary basis. Rather than forcing trades on an
          arbitrary calendar schedule, adjustments, additions, or exits will only be executed when structural
          changes occur in a company's fundamentals, or when a stock hits its target valuation. All updates and
          rationale will be logged transparently.
        </p>
      </div>
      <div className="flex flex-wrap gap-8">
        <div>
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Inception Date</p>
          <p className="font-medium text-[hsl(var(--foreground))]">March 9, 2026</p>
        </div>
        <div>
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Launch Date</p>
          <p className="font-medium text-[hsl(var(--foreground))]">March 9, 2026</p>
        </div>
      </div>
    </Section>
  </div>
)

// ---------------------------------------------------------------------------
// Footer — social links + full legal / educational disclaimer
// ---------------------------------------------------------------------------
const SocialLink = ({ href, label, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
    className="flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
  >
    {children}
  </a>
)

const SiteFooter = () => (
  <footer className="mt-12 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[0_1px_3px_rgba(35,29,26,0.06)]">
    <div className="flex flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row md:px-10">
      <div>
        <p className="font-claude-serif text-base font-semibold text-[hsl(var(--foreground))]">Lightning Model Portfolio</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Tracking a value-investing thesis, in public.</p>
      </div>
      <div className="flex items-center gap-3">
        <SocialLink href="https://linktr.ee/lightningstrades" label="Linktree">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M13.736 5.852L16.55 3.038L18.964 5.452L16.15 8.266H21v3.414h-4.85l2.814 2.814-2.414 2.414-2.814-2.814V21H10.32v-4.906l-2.814 2.814-2.414-2.414 2.814-2.814H3V8.266h4.906L5.092 5.452l2.414-2.414 2.814 2.814V1h3.416v4.852z" />
          </svg>
        </SocialLink>
        <SocialLink href="https://www.instagram.com/lightningstrades" label="Instagram">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M7.75 2C4.57 2 2 4.57 2 7.75v8.5C2 19.43 4.57 22 7.75 22h8.5C19.43 22 22 19.43 22 16.25v-8.5C22 4.57 19.43 2 16.25 2h-8.5zm0 2h8.5A3.75 3.75 0 0 1 20 7.75v8.5A3.75 3.75 0 0 1 16.25 20h-8.5A3.75 3.75 0 0 1 4 16.25v-8.5A3.75 3.75 0 0 1 7.75 4zm8.9 1.2a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
          </svg>
        </SocialLink>
        <SocialLink href="https://www.youtube.com/@lightningstrades" label="YouTube">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.7 31.7 0 0 0 0 12a31.7 31.7 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.7 31.7 0 0 0 24 12a31.7 31.7 0 0 0-.5-5.8zM9.75 15.5v-7L16 12l-6.25 3.5z" />
          </svg>
        </SocialLink>
        <SocialLink href="mailto:lightningstrades.support@gmail.com" label="Email">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M2 6l10 7 10-7" />
          </svg>
        </SocialLink>
      </div>
    </div>

    <div className="border-t border-[hsl(var(--border))] px-6 py-6 text-xs leading-relaxed text-[hsl(var(--muted-foreground))] md:px-10">
      <p>
        Data disclaimer: figures shown are provided by Yahoo Finance and may be delayed. This application and
        model portfolio are built for research and educational purposes only. Data may be unavailable or
        inaccurate at times.
      </p>

      <p className="mt-4 font-medium text-[hsl(var(--foreground)/85%)]">Educational Purposes Only</p>
      <p className="mt-1">
        All information, model portfolios, analysis, and content published on this website are strictly for
        educational, informational, and research-tracking purposes. Nothing on this website should be construed
        as investment, financial, or legal advice.
      </p>

      <ul className="mt-3 space-y-2">
        <li>
          <span className="font-medium text-[hsl(var(--foreground)/85%)]">Non-SEBI Registered:</span> I am not a
          SEBI (Securities and Exchange Board of India) Registered Investment Advisor (RIA) or Research Analyst
          (RA). The model portfolio showcased here represents a personal tracking project to demonstrate my
          analytical framework and methodology. It is not an invitation to invest or a public recommendation.
        </li>
        <li>
          <span className="font-medium text-[hsl(var(--foreground)/85%)]">Risk Warning:</span> investing in the
          securities market involves inherent risks. Large-cap and blue-chip stocks, while generally more stable,
          are still subject to market volatility, economic shifts, and company-specific risks. Capital loss is
          possible.
        </li>
        <li>
          <span className="font-medium text-[hsl(var(--foreground)/85%)]">No Guarantees:</span> past
          performance — whether simulated or real — is not a reliable indicator or guarantee of future results.
          The target to outperform the Nifty 50 is an objective, not a guaranteed outcome.
        </li>
        <li>
          <span className="font-medium text-[hsl(var(--foreground)/85%)]">Due Diligence:</span> visitors are
          strongly advised to conduct their own independent research or consult with a certified financial
          planner / SEBI-registered advisor before making any investment decisions based on the data presented
          here. I accept no liability for any financial loss incurred.
        </li>
      </ul>

      <p className="mt-4 text-[10px] text-[hsl(var(--muted-foreground)/80%)]">
        © {new Date().getFullYear()} Lightning Model Portfolio. All rights reserved.
      </p>
    </div>
  </footer>
)

// ---------------------------------------------------------------------------
// Holdings table — sortable, sticky Symbol column, expand/collapse
// ---------------------------------------------------------------------------
const ROWS_COLLAPSED = 10

const SortIcon = ({ active, direction }) => (
  <span className={`text-[10px] leading-none ${active ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground)/45%)]'}`}>
    {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
  </span>
)

const SortableTh = ({ label, sortKey, sortConfig, onSort, align = 'left', sticky = false }) => {
  const active = sortConfig.key === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`select-none whitespace-nowrap px-6 py-4 font-medium cursor-pointer transition-colors hover:text-[hsl(var(--foreground))] ${align === 'right' ? 'text-right' : 'text-left'
        } ${sticky
          ? 'sticky left-0 z-20 bg-[hsl(var(--secondary))] shadow-[4px_0_6px_-4px_rgba(35,29,26,0.10)]'
          : ''
        }`}
    >
      <span className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        <SortIcon active={active} direction={sortConfig.direction} />
      </span>
    </th>
  )
}

const HoldingsTable = ({ portfolioData }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'value', direction: 'desc' })
  const [expanded, setExpanded] = useState(false)

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }
    )
  }

  const sortedData = useMemo(() => {
    const rows = [...portfolioData]
    const { key, direction } = sortConfig
    rows.sort((a, b) => {
      let aVal = key === 'status' ? (a.quantity > 0 ? 1 : 0) : a[key]
      let bVal = key === 'status' ? (b.quantity > 0 ? 1 : 0) : b[key]
      if (typeof aVal === 'string' || typeof bVal === 'string') {
        aVal = String(aVal ?? '')
        bVal = String(bVal ?? '')
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      aVal = aVal ?? 0
      bVal = bVal ?? 0
      return direction === 'asc' ? aVal - bVal : bVal - aVal
    })
    return rows
  }, [portfolioData, sortConfig])

  const visibleRows = expanded ? sortedData : sortedData.slice(0, ROWS_COLLAPSED)
  const hasMore = sortedData.length > ROWS_COLLAPSED

  return (
    <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[0_1px_3px_rgba(35,29,26,0.06)]">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
        <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
          Holdings <span className="text-[hsl(var(--muted-foreground)/70%)]">({sortedData.length})</span>
        </h3>
        <p className="hidden text-xs text-[hsl(var(--muted-foreground)/70%)] sm:block">Click a column to sort</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]">
            <tr>
              <SortableTh label="Symbol" sortKey="symbol" sortConfig={sortConfig} onSort={handleSort} sticky />
              <SortableTh label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTh label="Alloc." sortKey="allocation" sortConfig={sortConfig} onSort={handleSort} align="right" />
              <SortableTh label="Qty" sortKey="quantity" sortConfig={sortConfig} onSort={handleSort} align="right" />
              <SortableTh label="Avg Price" sortKey="avgPrice" sortConfig={sortConfig} onSort={handleSort} align="right" />
              <SortableTh label="LTP" sortKey="ltp" sortConfig={sortConfig} onSort={handleSort} align="right" />
              <SortableTh label="Invested" sortKey="invested" sortConfig={sortConfig} onSort={handleSort} align="right" />
              <SortableTh label="Value" sortKey="value" sortConfig={sortConfig} onSort={handleSort} align="right" />
              <SortableTh label="Unrealized ₹" sortKey="unrealizedGain" sortConfig={sortConfig} onSort={handleSort} align="right" />
              <SortableTh label="Unrealized %" sortKey="unrealizedGainPct" sortConfig={sortConfig} onSort={handleSort} align="right" />
              <SortableTh label="Total Gain ₹" sortKey="totalGain" sortConfig={sortConfig} onSort={handleSort} align="right" />
              <SortableTh label="Total Gain %" sortKey="totalGainPct" sortConfig={sortConfig} onSort={handleSort} align="right" />
              <th className="border-l border-[hsl(var(--border))] px-6 py-4 font-medium">Upcoming / Recent Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border)/60%)]">
            {visibleRows.map((item, idx) => {
              const isClosed = item.quantity === 0
              return (
                <tr key={idx} className="group transition-colors hover:bg-[hsl(var(--secondary)/50%)]">
                  <td className="sticky left-0 z-10 bg-[hsl(var(--card))] px-6 py-4 font-medium text-[hsl(var(--foreground))] shadow-[4px_0_6px_-4px_rgba(35,29,26,0.08)] group-hover:bg-[hsl(var(--muted))]">
                    {item.symbol.replace('NSE:', '')}
                    {item.error && (
                      <span className="ml-2 rounded bg-[hsl(var(--destructive)/12%)] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--destructive))]">
                        Unavailable
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isClosed
                        ? 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                        : 'bg-[hsl(var(--success)/12%)] text-[hsl(var(--success))]'
                        }`}
                    >
                      {isClosed ? 'Closed' : 'Open'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">{item.allocation.toFixed(1)}%</td>
                  <td className="px-6 py-4 text-right">{item.quantity}</td>
                  <td className="px-6 py-4 text-right text-[hsl(var(--muted-foreground))]">₹{item.avgPrice.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-medium text-[hsl(var(--foreground))]">₹{item.ltp?.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-[hsl(var(--muted-foreground))]">₹{item.invested.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-medium text-[hsl(var(--foreground))]">₹{item.value.toFixed(2)}</td>
                  <td
                    className={`px-6 py-4 text-right font-medium ${item.unrealizedGain >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'
                      }`}
                  >
                    ₹{item.unrealizedGain.toFixed(2)}
                  </td>
                  <td
                    className={`px-6 py-4 text-right text-xs font-medium opacity-90 ${item.unrealizedGainPct >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'
                      }`}
                  >
                    {item.unrealizedGainPct.toFixed(2)}%
                  </td>
                  <td
                    className={`px-6 py-4 text-right font-medium ${item.totalGain >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'
                      }`}
                  >
                    ₹{item.totalGain.toFixed(2)}
                  </td>
                  <td
                    className={`px-6 py-4 text-right text-xs font-medium opacity-90 ${item.totalGainPct >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'
                      }`}
                  >
                    {item.totalGainPct.toFixed(2)}%
                  </td>
                  <td className="max-w-[280px] truncate border-l border-[hsl(var(--border))] px-6 py-4 text-xs text-[hsl(var(--muted-foreground))]">
                    {item.corpActions?.length > 0 ? (
                      <ul className="space-y-1">
                        {item.corpActions.slice(0, 2).map((action, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="font-medium text-[hsl(var(--foreground)/85%)]">{action.type}:</span>
                            <span>
                              {action.amount ? `₹${Number(action.amount).toFixed(2)} on ` : ''}
                              {action.date ? new Date(action.date).toLocaleDateString() : 'N/A'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      'No recent data'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="border-t border-[hsl(var(--border))] px-6 py-3 text-center">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-[hsl(var(--primary))] transition-opacity hover:opacity-75"
          >
            {expanded ? '▲ Show less' : `▼ Show all ${sortedData.length} holdings`}
          </button>
        </div>
      )}
    </div>
  )
}

function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8787'
        const apiRes = await axios.get(`${apiUrl}/api/portfolio`)
        setData(apiRes.data)
      } catch (err) {
        console.error(err)
        setError(err.message || 'An error occurred fetching portfolio data.')
      } finally {
        setLoading(false)
      }
    }
    fetchPortfolio()
  }, [])


  if (loading) {
    return (
      <>
        <ThemeTokens />
        <div className="flex h-screen items-center justify-center font-claude-sans text-sm text-[hsl(var(--muted-foreground))]">
          Loading portfolio parameters...
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <ThemeTokens />
        <div className="flex h-screen items-center justify-center font-claude-sans text-sm text-[hsl(var(--destructive))]">
          Error: {error}
        </div>
      </>
    )
  }

  if (!data) return null

  const { summary, portfolioData, benchmark } = data

  // Sector allocation is computed from currently held (non-zero value) positions only.
  const sectorMap = portfolioData.reduce((acc, curr) => {
    if (curr.value > 0) acc[curr.sector] = (acc[curr.sector] || 0) + curr.value
    return acc
  }, {})
  const pieData = Object.keys(sectorMap).map((key) => ({ name: key, value: sectorMap[key] }))
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0)

  const BentoCard = ({ title, value, subtext, highlight }) => (
    <div className="flex flex-col justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[0_1px_3px_rgba(35,29,26,0.06)]">
      <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{title}</h3>
      <div
        className={`mt-2 text-3xl font-semibold tracking-tight ${highlight
          ? value >= 0
            ? 'text-[hsl(var(--success))]'
            : 'text-[hsl(var(--destructive))]'
          : 'text-[hsl(var(--foreground))]'
          }`}
      >
        {typeof value === 'number'
          ? `₹${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : value}
      </div>
      {subtext && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground)/70%)]">{subtext}</p>}
    </div>
  )

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-6 font-claude-sans text-[hsl(var(--foreground))] md:p-12">
      <ThemeTokens />
      <div className="mx-auto max-w-7xl space-y-8">
        <header>
          <h1 className="font-claude-serif text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
            Lightning Model Portfolio
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Research & Educational Purposes Only</p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <BentoCard
            title="Portfolio Value"
            value={summary.currentValue}
            subtext={`Invested: ₹${summary.invested.toFixed(2)} | Cash: ₹${summary.cash.toFixed(2)}`}
          />
          <BentoCard
            title="Unrealized Gain"
            value={summary.unrealizedGain}
            subtext={`${summary.unrealizedGainPct.toFixed(2)}% Change`}
            highlight
          />
          <BentoCard
            title="Realized & Dividends"
            value={summary.realizedGains + summary.totalDividends}
            subtext={`Realized: ₹${summary.realizedGains.toFixed(2)} | Divs: ₹${summary.totalDividends.toFixed(2)}`}
            highlight
          />
          <BentoCard
            title="Total Return"
            value={summary.totalGain}
            subtext={`${summary.totalGainPct.toFixed(2)}% Overall`}
            highlight
          />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="col-span-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[0_1px_3px_rgba(35,29,26,0.06)]">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                Portfolio vs Nifty 50 (1Y Return)
              </h3>
              <div className="flex gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-[#D97757]"></div>Portfolio
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-[#A69C87]"></div>Nifty 50
                </div>
              </div>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={benchmark} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFEBE3" />
                  <XAxis
                    dataKey="date"
                    stroke="#A69C87"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    minTickGap={30}
                  />
                  <YAxis
                    tickFormatter={(val) => `${val}%`}
                    stroke="#A69C87"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#E6E2DA', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Line
                    type="monotone"
                    dataKey="portfolioReturn"
                    name="Portfolio"
                    stroke="#D97757"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#D97757', strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="niftyReturn"
                    name="Nifty 50"
                    stroke="#A69C87"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#A69C87', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[0_1px_3px_rgba(35,29,26,0.06)]">
            <h3 className="mb-4 text-sm font-medium text-[hsl(var(--muted-foreground))]">Sector Allocation</h3>
            <div className="h-[190px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `₹${value.toFixed(2)}`}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E6E2DA',
                      fontSize: '12px',
                      backgroundColor: '#FFFFFF',
                      color: '#231D1A',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-[hsl(var(--muted-foreground))]">{entry.name}</span>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    {pieTotal ? ((entry.value / pieTotal) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <HoldingsTable portfolioData={portfolioData} />

        <PortfolioMethodology />

        <SiteFooter />
      </div>
    </div>
  )
}

export default App