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

  return (
    <section className="py-20 bg-gradient-to-b from-white to-gray-100 dark:from-gray-800 dark:to-black">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-4xl font-bold text-center mb-12">
          Live Top 10 Kaspa Ecosystem Tokens (KRC-20)
        </h2>

        {loading && (
          <div className="text-center text-2xl text-gray-600 dark:text-gray-300">
            Loading live data from CoinGecko...
          </div>
        )}

        {error && (
          <div className="text-center text-red-600 dark:text-red-400 text-xl">
            {error}
          </div>
        )}

        {!loading && !error && tokens.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
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

            <div className="p-8 bg-kasgreen/10 text-center">
              <p className="text-lg font-semibold">
                Live data powered by{' '}
                <a
                  href="https://www.coingecko.com/en/categories/kaspa-ecosystem"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-kasgreen hover:underline"
                >
                  CoinGecko Kaspa Ecosystem
                </a>
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
