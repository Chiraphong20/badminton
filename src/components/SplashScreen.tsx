import { motion } from 'motion/react';

interface Props {
  clubName: string;
}

export function SplashScreen({ clubName }: Props) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[1000] bg-on-surface flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background Orbs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-secondary/10 rounded-full blur-[120px]" />

      <div className="relative flex flex-col items-center">
        {/* Animated Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
          className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-white italic text-5xl font-black shadow-[0_0_50px_rgba(var(--primary-rgb),0.4)] mb-8"
        >
          TJ
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center"
        >
          <h1 className="font-headline font-black text-4xl text-white tracking-tighter mb-2">{clubName}</h1>
          <p className="text-xs font-black text-primary uppercase tracking-[0.4em] ml-1">SmashPang</p>
        </motion.div>

        {/* High-end loading bar */}
        <div className="mt-12 w-48 h-1 bg-white/10 rounded-full overflow-hidden relative">
          <motion.div
            initial={{ left: "-100%" }}
            animate={{ left: "100%" }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-primary to-transparent"
          />
        </div>

        <p className="mt-6 text-xs font-semibold text-white/30 animate-pulse">กำลังเชื่อมต่อระบบ...</p>
      </div>

      {/* Shuttlecock animation */}
      <motion.div
        animate={{
          y: [0, -20, 0],
          rotate: [0, 15, -15, 0]
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-12 text-3xl opacity-10"
      >
        🏸
      </motion.div>
    </motion.div>
  );
}
