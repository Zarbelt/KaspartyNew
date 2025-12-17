import { useState, useRef, useEffect, type JSX } from 'react'
import { Search, X, Globe, ExternalLink, Clock, ChevronRight, Zap, Shield, Cpu, Sparkles, Loader2, TrendingUp } from 'lucide-react'

interface SearchResult {
  title: string
  link: string
  snippet: string
  displayLink: string
  formattedUrl: string
  pagemap?: {
    cse_thumbnail?: Array<{ src: string; width: string; height: string }>
    metatags?: Array<{ 'og:image'?: string }>
  }
}

interface QuickSearch {
  term: string
  icon: React.ReactNode
  description: string
}

type SearchFilter = 'all' | 'kaspa' | 'tech' | 'crypto'

export default function SearchSection() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [totalResults, setTotalResults] = useState<string>('')
  const [searchTime, setSearchTime] = useState<number>(0)
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('all')
  const inputRef = useRef<HTMLInputElement>(null)
  const [showQuickSearches, setShowQuickSearches] = useState(true)

  const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY
  const SEARCH_ENGINE_ID = import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID

  const quickSearches: QuickSearch[] = [
    { 
      term: 'Kaspa Blockchain', 
      icon: <Zap size={16} />, 
      description: 'Fastest PoW blockchain with DAG structure' 
    },
    { 
      term: 'GhostDAG Protocol', 
      icon: <Shield size={16} />, 
      description: 'Kaspa\'s consensus mechanism' 
    },
    { 
      term: 'BlockDAG vs Blockchain', 
      icon: <Cpu size={16} />, 
      description: 'Understanding the differences' 
    },
    { 
      term: 'KAS Mining', 
      icon: <TrendingUp size={16} />, 
      description: 'Mining profitability and guides' 
    },
    { 
      term: 'Rust Implementation', 
      icon: <Sparkles size={16} />, 
      description: 'Kaspa Rust node performance' 
    },
    { 
      term: 'Smart Contracts Kaspa', 
      icon: <Globe size={16} />, 
      description: 'Upcoming Kasplex features' 
    }
  ]

  const searchFilters = [
    { key: 'all' as SearchFilter, label: 'All Results', count: results.length },
    { key: 'kaspa' as SearchFilter, label: 'Kaspa Specific', count: Math.floor(results.length * 0.4) },
    { key: 'tech' as SearchFilter, label: 'Technical', count: Math.floor(results.length * 0.3) },
    { key: 'crypto' as SearchFilter, label: 'Crypto News', count: Math.floor(results.length * 0.3) }
  ]

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    
    if (val.length > 0) {
      setShowQuickSearches(false)
    } else {
      setShowQuickSearches(true)
    }
    
    if (val.length > 1) {
      const baseSuggestions = [
        `What is ${val} in blockchain?`,
        `${val} cryptocurrency`,
        `${val} mining guide`,
        `${val} vs Kaspa comparison`,
        `${val} technical analysis`,
        `How does ${val} work?`
      ]
      setSuggestions(baseSuggestions)
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }

  const performSearch = async (searchTerm?: string) => {
    const q = (searchTerm ?? query).trim()
    if (!q) return
    if (!API_KEY || !SEARCH_ENGINE_ID) {
      console.error('Google API key or Search Engine ID is missing')
      setResults([])
      setTotalResults('0')
      return
    }

    setLoading(true)
    setShowSuggestions(false)
    const startTime = Date.now()

    try {
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(q)}&num=10&safe=active`
      )

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.items) {
        const formattedResults: SearchResult[] = data.items.map((item: any) => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet || '',
          displayLink: item.displayLink,
          formattedUrl: item.formattedUrl,
          pagemap: item.pagemap
        }))
        
        setResults(formattedResults)
        setTotalResults(data.searchInformation?.formattedTotalResults || '0')
      } else {
        setResults([])
        setTotalResults('0')
      }
      
      setSearchTime(Date.now() - startTime)
    } catch (error) {
      console.error('Search failed:', error)
      setResults([])
      setTotalResults('0')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickSearch = (term: string) => {
    setQuery(term)
    setShowQuickSearches(false)
    performSearch(term)
    inputRef.current?.focus()
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    performSearch(suggestion)
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setTotalResults('')
    setShowQuickSearches(true)
    inputRef.current?.focus()
  }

  const getUrlFavicon = (url: string) => {
    try {
      const domain = new URL(url).hostname
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    } catch {
      return 'https://www.google.com/s2/favicons?sz=32'
    }
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <section className="py-12 md:py-20 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center justify-center px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full mb-4 md:mb-6 border border-blue-500/20 dark:border-blue-400/20">
            <Search size={16} className="text-blue-600 dark:text-blue-400 mr-2" />
            <span className="text-xs md:text-sm font-semibold text-blue-700 dark:text-blue-300">KASPA KNOWLEDGE SEARCH</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
            Search the Blockchain Universe
          </h2>
          <p className="text-base md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4 md:px-0">
            Get instant access to Kaspa documentation, crypto insights, and technical resources from across the web
          </p>
        </div>

        <div className="mb-8 md:mb-12">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition duration-500"></div>
            
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-2 border border-gray-200 dark:border-gray-800">
              <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                <div className="flex-1 relative">
                  <div className="absolute left-4 md:left-5 top-1/2 transform -translate-y-1/2">
                    <Search size={20} className="text-gray-400" />
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleInput}
                    onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                    placeholder="Search Kaspa, blockchain terms, crypto concepts, technical docs..."
                    className="w-full pl-12 md:pl-14 pr-6 py-4 md:py-5 text-base md:text-lg bg-transparent border-0 focus:outline-none focus:ring-0 placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  
                  {query && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-3 md:right-4 top-1/2 transform -translate-y-1/2 p-1.5 md:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
                    >
                      <X size={18} className="text-gray-500" />
                    </button>
                  )}

                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 md:mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl z-50 border border-gray-200 dark:border-gray-700 overflow-hidden">
                      {suggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          className="px-4 md:px-6 py-3 md:py-4 hover:bg-blue-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0 group"
                          onClick={() => handleSuggestionClick(suggestion)}
                        >
                          <div className="flex items-center gap-3">
                            <Search size={16} className="text-gray-400 group-hover:text-blue-500" />
                            <span className="text-sm md:text-base text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                              {suggestion}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => performSearch()}
                  disabled={loading}
                  className="px-6 md:px-10 py-3 md:py-5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 md:gap-3 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px] md:min-w-[140px]"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span className="text-sm md:text-base">Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search size={18} />
                      <span className="text-sm md:text-base">Search Web</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {showQuickSearches && (
            <div className="mt-6 md:mt-8 animate-fadeIn">
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                <Clock size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Quick Searches:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {quickSearches.map((item) => (
                  <button
                    key={item.term}
                    onClick={() => handleQuickSearch(item.term)}
                    className="group flex items-center gap-2 md:gap-3 px-4 md:px-5 py-2.5 md:py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 rounded-xl md:rounded-full hover:shadow-lg transition-all duration-300 border border-transparent hover:border-blue-200 dark:hover:border-gray-600 text-left"
                  >
                    <div className="text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform flex-shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-300 text-sm md:text-base truncate">
                        {item.term}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {item.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="animate-fadeIn">
            <div className="mb-6 md:mb-8 p-4 md:p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800/50 dark:to-gray-900/50 rounded-2xl border border-blue-100 dark:border-gray-700">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1 md:mb-2">
                    Search Results
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-600 dark:text-gray-400">
                    <span>About {totalResults} results</span>
                    <span className="hidden md:inline">•</span>
                    <span>{searchTime}ms</span>
                    <span className="hidden md:inline">•</span>
                    <span className="flex items-center gap-1">
                      <Globe size={12} />
                      <span className="hidden sm:inline">Powered by Google Custom Search</span>
                      <span className="sm:hidden">Google Search</span>
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-1 md:gap-2 overflow-x-auto pb-2 md:pb-0">
                  {searchFilters.map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setActiveFilter(filter.key)}
                      className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all flex-shrink-0 ${
                        activeFilter === filter.key
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="hidden sm:inline">{filter.label}</span>
                      <span className="sm:hidden">{filter.key}</span>
                      <span className="ml-1 md:ml-2 px-1.5 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700">
                        {filter.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
              <div className="lg:col-span-2 space-y-4 md:space-y-6">
                {results.slice(0, 6).map((result, index) => (
                  <div
                    key={index}
                    className="group bg-white dark:bg-gray-900 rounded-xl p-4 md:p-6 hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-500/30"
                  >
                    <div className="flex items-start gap-3 md:gap-4">
                      <div className="flex-shrink-0">
                        <img
                          src={getUrlFavicon(result.link)}
                          alt="Favicon"
                          className="w-6 h-6 md:w-8 md:h-8 rounded-lg"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = 'https://www.google.com/s2/favicons?sz=32'
                          }}
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 md:gap-2 mb-1 md:mb-2">
                          <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">
                            {result.displayLink}
                          </span>
                          <ChevronRight size={10} className="text-gray-400 flex-shrink-0" />
                        </div>
                        
                        <a
                          href={result.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mb-2 md:mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                        >
                          <h4 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white line-clamp-2">
                            {result.title}
                          </h4>
                        </a>
                        
                        <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mb-3 md:mb-4 line-clamp-2 md:line-clamp-3">
                          {result.snippet}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate max-w-[60%]">
                            {result.formattedUrl}
                          </span>
                          <a
                            href={result.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 md:gap-2 text-xs md:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex-shrink-0"
                          >
                            <span>Visit</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4 md:space-y-6">
                <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-500/5 dark:to-purple-500/5 rounded-2xl p-4 md:p-6 border border-blue-200/30 dark:border-blue-500/20">
                  <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                    <div className="p-1.5 md:p-2 bg-blue-500/20 rounded-lg">
                      <Zap size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h4 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">
                      Kaspa Insights
                    </h4>
                  </div>
                  <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mb-3 md:mb-4">
                    Kaspa is the fastest Proof-of-Work cryptocurrency using GHOSTDAG protocol. It achieves high block rates while maintaining security through its blockDAG structure.
                  </p>
                  <div className="space-y-1.5 md:space-y-2">
                    <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                      <span>10 Blocks Per Second</span>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                      <span>Rust Implementation</span>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-purple-500 rounded-full flex-shrink-0"></div>
                      <span>Smart Contracts Coming</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 md:p-6 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-base md:text-lg font-bold text-gray-900 dark:text-white mb-3 md:mb-4">
                    Search Tips
                  </h4>
                  <ul className="space-y-2 md:space-y-3">
                    <li className="flex items-start gap-2 md:gap-3">
                      <div className="p-0.5 md:p-1 bg-blue-100 dark:bg-blue-500/20 rounded mt-0.5 flex-shrink-0">
                        <Search size={12} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
                        Use quotes for exact phrases
                      </span>
                    </li>
                    <li className="flex items-start gap-2 md:gap-3">
                      <div className="p-0.5 md:p-1 bg-purple-100 dark:bg-purple-500/20 rounded mt-0.5 flex-shrink-0">
                        <Search size={12} className="text-purple-600 dark:text-purple-400" />
                      </div>
                      <span className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
                        Add "site:kaspascan.com" for Kaspa-specific results
                      </span>
                    </li>
                    <li className="flex items-start gap-2 md:gap-3">
                      <div className="p-0.5 md:p-1 bg-pink-100 dark:bg-pink-500/20 rounded mt-0.5 flex-shrink-0">
                        <Search size={12} className="text-pink-600 dark:text-pink-400" />
                      </div>
                      <span className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
                        Filter by date using "past year" or "past month"
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5 rounded-2xl p-4 md:p-6 border border-green-200/30 dark:border-green-500/20">
                  <div className="flex items-center justify-between mb-3 md:mb-4">
                    <h4 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">
                      API Status
                    </h4>
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
                      <span className="text-xs md:text-sm text-green-600 dark:text-green-400">Live</span>
                    </div>
                  </div>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-3 md:mb-4">
                    Powered by Google Custom Search JSON API with real-time web indexing and Kaspa-specific optimization.
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    100 free queries/day available
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 md:mt-8 text-center">
              <button
                onClick={() => performSearch(query + ' advanced')}
                className="px-6 md:px-8 py-2.5 md:py-3 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-700 dark:hover:to-gray-800 text-gray-800 dark:text-gray-300 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg border border-gray-300 dark:border-gray-700 text-sm md:text-base"
              >
                Load More Results
              </button>
            </div>
          </div>
        )}

        {results.length === 0 && (
          <div className="mt-12 md:mt-16 animate-fadeIn">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition duration-500"></div>
              
              <div className="relative bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-3xl p-6 md:p-8 border border-amber-200 dark:border-amber-800 shadow-2xl">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
                  <div className="flex items-center gap-4 md:gap-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl blur-lg"></div>
                      <div className="relative p-3 md:p-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl">
                        <span className="text-3xl md:text-4xl">🪐</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xl md:text-3xl font-bold bg-gradient-to-r from-amber-700 to-orange-700 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
                        [$SPHERE]
                      </div>
                      <div className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                        Kaspa Ecosystem DAO Coin
                      </div>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mt-1 md:mt-2 max-w-md">
                        The official community token powering the Kaspa ecosystem governance, staking, and rewards.
                      </p>
                    </div>
                  </div>
                  
                  <a
                    href="https://www.kaspasphere.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 md:gap-3 px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all duration-300 hover:shadow-xl hover:scale-[1.02] w-full md:w-auto justify-center"
                  >
                    <span className="text-sm md:text-base">Explore KASPA Sphere</span>
                    <ExternalLink size={16} className="group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
                
                <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-amber-200 dark:border-amber-800/50 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                  <div className="text-center">
                    <div className="text-lg md:text-2xl font-bold text-amber-700 dark:text-amber-400">100%</div>
                    <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Community Owned</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg md:text-2xl font-bold text-amber-700 dark:text-amber-400">DAO</div>
                    <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Governance</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg md:text-2xl font-bold text-amber-700 dark:text-amber-400">Staking</div>
                    <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Rewards System</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg md:text-2xl font-bold text-amber-700 dark:text-amber-400">Ecosystem</div>
                    <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Powered</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        
        .line-clamp-2 {
          overflow: hidden;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }
        
        .line-clamp-3 {
          overflow: hidden;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }
        
        .group:hover .group-hover\\:translate-x-1 {
          transform: translateX(4px);
        }
      `}</style>
    </section>
  )
}