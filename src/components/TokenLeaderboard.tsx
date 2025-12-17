// src/components/TokenLeaderboard.tsx

import { useState, useEffect } from 'react'

interface Token {
  symbol: string
  name: string
  current_price: number
  market_cap: number
  total_volume: number
  price_change_percentage_24h?: number
}

export default function TokenLeaderboard() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=kaspa-ecosystem&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h'
        )
        if (!res.ok) throw new Error('Failed to fetch data')
        const data: Token[] = await res.json()
        setTokens(data)
        setLoading(false)
      } catch {
        setError('Unable to load live Kaspa token data from CoinGecko.')
        setLoading(false)
      }
    }

    fetchTokens()
  }, [])

  const formatUsd = (value: number | null) => {
    if (value === null || value === undefined) return '-'
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
    if (value >= 1) return `$${value.toFixed(2)}`
    return `$${value.toFixed(6)}`
  }

  const formatUsdMobile = (value: number | null) => {
    if (value === null || value === undefined) return '-'
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
    if (value >= 1) return `$${value.toFixed(2)}`
    return `$${value.toFixed(4)}`
  }

  return (
    <section className="py-12 md:py-20 bg-gradient-to-b from-white to-gray-100 dark:from-gray-800 dark:to-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8 md:mb-12 px-4 md:px-0">
          Live Top 10 Kaspa Ecosystem Tokens (KRC-20)
        </h2>

        {loading && (
          <div className="text-center text-lg sm:text-xl md:text-2xl text-gray-600 dark:text-gray-300">
            Loading live data from CoinGecko...
          </div>
        )}

        {error && (
          <div className="text-center text-red-600 dark:text-red-400 text-base sm:text-lg md:text-xl px-4">
            {error}
          </div>
        )}

        {!loading && !error && tokens.length > 0 && (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-kasgreen text-white">
                  <tr>
                    <th className="p-6 text-left">Rank</th>
                    <th className="p-6 text-left">Token</th>
                    <th className="p-6 text-right">Price</th>
                    <th className="p-6 text-right">Market Cap</th>
                    <th className="p-6 text-right">24h Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t, i) => (
                    <tr
                      key={t.symbol}
                      className="border-b dark:border-gray-700 hover:bg-kasgreen/5 transition"
                    >
                      <td className="p-6 font-bold">{i + 1}</td>
                      <td className="p-6">
                        <div>
                          <span className="font-semibold text-kasgreen uppercase">
                            {t.symbol}
                          </span>
                          {t.name && (
                            <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                              ({t.name})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-6 text-right font-medium">
                        {formatUsd(t.current_price)}
                      </td>
                      <td className="p-6 text-right font-medium">
                        {formatUsd(t.market_cap)}
                      </td>
                      <td className="p-6 text-right font-medium">
                        {formatUsd(t.total_volume)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {tokens.map((t, i) => (
                <div 
                  key={t.symbol}
                  className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-4 hover:shadow-xl transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg text-kasgreen">#{i + 1}</span>
                      <div>
                        <div className="font-semibold text-kasgreen uppercase">
                          {t.symbol}
                        </div>
                        {t.name && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {t.name}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right font-bold text-lg">
                      {formatUsdMobile(t.current_price)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Market Cap</div>
                      <div className="font-medium">{formatUsdMobile(t.market_cap)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 dark:text-gray-400">24h Volume</div>
                      <div className="font-medium">{formatUsdMobile(t.total_volume)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 md:p-8 bg-kasgreen/10 text-center rounded-2xl md:rounded-3xl mt-8">
              <p className="text-sm sm:text-base md:text-lg font-semibold">
                Live data powered by{' '}
                <a
                  href="https://www.coingecko.com/en/categories/kaspa-ecosystem"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-kasgreen hover:underline"
                >
                  Powerewd by Modmedia Network 
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
