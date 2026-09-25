import { motion } from "framer-motion";

const cores = [
  { bg: "bg-rose-500", ring: "ring-rose-500/30" },
  { bg: "bg-amber-500", ring: "ring-amber-500/30" },
  { bg: "bg-yellow-500", ring: "ring-yellow-500/30" },
  { bg: "bg-lime-500", ring: "ring-lime-500/30" },
  { bg: "bg-emerald-600", ring: "ring-emerald-600/30" },
];

export default function FunnelChart({ data }) {
  const maxValue = Math.max(...data.map((d) => d.value));
  
  return (
    <div className="flex flex-col items-center py-8 space-y-4">
      {data.map((item, index) => {
        const larguraPercentual = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        const larguraMin = 20;
        const largura = Math.max(larguraPercentual, larguraMin);
        const cor = cores[index] || cores[0];

        return (
          <div key={index} className="w-full flex flex-col items-center">
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: `${largura}%`, opacity: 1 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative ${cor.bg} ${cor.ring} ring-4 rounded-sm px-4 py-3 shadow-lg`}
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-white font-semibold text-sm truncate">{item.name}</span>
                <span className="text-white font-bold text-lg">{item.value}</span>
              </div>
            </motion.div>
            
            {index < data.length - 1 && (
              <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[8px] border-t-slate-700 opacity-50" />
            )}
          </div>
        );
      })}
    </div>
  );
}