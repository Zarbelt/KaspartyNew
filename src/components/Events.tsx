export default function Events() {
  const events = [
    {
      title: "Kaspa Smart Contracts Launch!",
      description:
        "Kasplex nodes begin serving ZKProofs and full EVM compatibility, enabling seamless dApp migration from Ethereum.",
      date: "End of September 2025",
      status: "upcoming",
      highlight: true,
      tags: ["KAS-20", "Smart Contracts", "EVM"],
      icon: "⚡",
    },
    {
      title: "Rust Rewrite Complete",
      description:
        "Full migration to Rust implementation completed, achieving 10 blocks per second throughput.",
      date: "August 2025",
      status: "current",
      highlight: true,
      tags: ["Performance", "Rust", "10 BPS"],
      icon: "🚀",
    },
    {
      title: "Kaspa Wallet v3.0 Release",
      description:
        "Multi-signature support, hardware wallet integration, and improved UX with dark/light themes.",
      date: "October 2025",
      status: "upcoming",
      highlight: false,
      tags: ["Wallet", "Security", "Multi-sig"],
      icon: "🔐",
    },
    {
      title: "Layer 2 Scaling Solution Testnet",
      description:
        "ZK-Rollup testnet launch for scaling microtransactions and enabling sub-second finality.",
      date: "November 2025",
      status: "upcoming",
      highlight: true,
      tags: ["Layer 2", "ZK-Rollup", "Scaling"],
      icon: "⚙️",
    },
    {
      title: "DAG KNIGHT Consensus Upgrade",
      description:
        "Implementation of DAG KNIGHT consensus algorithm for enhanced security and decentralization.",
      date: "July 2025",
      status: "completed",
      highlight: false,
      tags: ["Consensus", "Security", "DAG"],
      icon: "🛡️",
    },
    {
      title: "Kaspa DeFi Ecosystem Launch",
      description:
        "First wave of DeFi protocols including DEX, lending platforms, and yield farming opportunities.",
      date: "December 2025",
      status: "upcoming",
      highlight: true,
      tags: ["DeFi", "DEX", "Yield"],
      icon: "💎",
    },
  ]

  const milestones = [
    { label: "Blocks Per Second", value: "10 BPS", change: "+2.5x" },
    { label: "Network Nodes", value: "15K+", change: "+45%" },
    { label: "Transaction Speed", value: "<1s", change: "-60%" },
    { label: "Energy Efficiency", value: "98%", change: "+40%" },
  ]

  return (
    <section className="relative py-16 md:py-32 bg-gradient-to-br from-gray-900 via-black to-purple-900 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='none'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-20">
          <div className="inline-flex items-center justify-center p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4 md:mb-6">
            <span className="text-white text-xs md:text-sm font-bold px-3 md:px-4">
              KASPA TIMELINE
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl lg:text-7xl font-bold mb-4 md:mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
            Roadmap & Events
          </h2>
          <p className="text-base md:text-xl text-gray-300 max-w-3xl mx-auto px-4 md:px-0">
            Follow Kaspa's journey through groundbreaking updates and future
            milestones
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12 md:mb-16">
          {milestones.map((m, i) => (
            <div
              key={i}
              className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-6 border border-gray-700/50 hover:border-blue-500/30 transition"
            >
              <div className="text-2xl md:text-3xl font-bold text-white mb-2">
                {m.value}
              </div>
              <div className="text-gray-400 text-xs md:text-sm mb-1">{m.label}</div>
              <div className="text-green-400 text-xs md:text-sm font-medium">
                ↑ {m.change}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-12 md:space-y-16">
          {events.map((event, index) => {
            const parts = event.date.split(" ")
            const year = parts.pop()
            const month = parts.join(" ")

            return (
              <div
                key={index}
                className={`flex flex-col ${
                  index % 2 === 0
                    ? "lg:flex-row"
                    : "lg:flex-row-reverse"
                } items-center gap-6 md:gap-10`}
              >
                <div className="flex-1 text-center lg:text-left px-4 md:px-0">
                  <div className="flex items-center justify-center lg:justify-start gap-3 mb-3 md:mb-4">
                    <span className="text-xl md:text-2xl">{event.icon}</span>
                    <span className="px-3 md:px-4 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400">
                      {event.status.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-3 md:mb-4">
                    {event.title}
                  </h3>
                  <p className="text-sm md:text-base text-gray-300 mb-4 md:mb-6">
                    {event.description}
                  </p>
                  <div className="flex flex-wrap justify-center lg:justify-start gap-2">
                    {event.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-3 md:px-4 py-1 md:py-2 bg-gray-800/50 rounded-full text-xs text-gray-300 border border-gray-700/50"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-xl">
                  <div className="text-center">
                    <div className="text-base md:text-xl">{year}</div>
                    <div className="text-xs">{month}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}