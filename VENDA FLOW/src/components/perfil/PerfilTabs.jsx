import { motion } from "framer-motion";

const TABS = [
  { key: "visao-geral", label: "Visão Geral" },
  { key: "atividade", label: "Atividade" },
  { key: "conquistas", label: "Conquistas" },
  { key: "configuracoes", label: "Configurações" },
];

export default function PerfilTabs({ tabAtiva, onTab }) {
  return (
    <div
      className="flex items-center gap-1 p-1.5 w-fit rounded-full"
      style={{
        background: "hsl(222 47% 7% / 0.6)",
        border: "1px solid hsl(0 0% 100% / 0.06)",
        backdropFilter: "blur(20px)",
      }}
    >
      {TABS.map((tab) => {
        const active = tabAtiva === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTab(tab.key)}
            className="relative px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 outline-none"
            style={{
              color: active ? "#fff" : "hsl(220 15% 55%)",
              background: active
                ? "linear-gradient(135deg, hsl(199 89% 55% / 0.18), hsl(262 83% 60% / 0.18))"
                : "transparent",
              border: active ? "1px solid hsl(199 89% 55% / 0.4)" : "1px solid transparent",
              boxShadow: active ? "0 4px 18px -6px hsl(199 89% 55% / 0.5)" : "none",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}