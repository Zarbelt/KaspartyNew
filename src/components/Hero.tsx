import { motion } from 'framer-motion'

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-indigo-800 via-blue-700 to-kasgreen text-white py-32">
      <div className="absolute inset-0 bg-black opacity-30"></div>
      <div className="relative max-w-7xl mx-auto px-6 text-center">
        <motion.h2 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight"
        >
          Crypto Meets Fun,<br />Kasparty.com
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="text-xl md:text-2xl max-w-4xl mx-auto mb-12"
        >
          Your Home for Learning What's HOT on the Most Secure, Efficient Cryptocurrency on Earth! No PhD Needed.
        </motion.p>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => window.open('https://kasware.xyz', '_blank')}
          className="bg-white text-kasgreen px-10 py-5 rounded-full text-xl font-bold shadow-2xl hover:shadow-kasgreen/50 transition"
        >
          Android/PC Kaspa Wallet
        </motion.button>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-100 dark:from-gray-900 to-transparent"></div>
    </section>
  )
}