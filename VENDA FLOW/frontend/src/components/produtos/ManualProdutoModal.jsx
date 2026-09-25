import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { BookOpen, Download, Printer, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ManualProdutoModal({ open, onClose, produto }) {
  if (!produto?.manual?.gerado) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-400" />
              Manual do Produto - {produto?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="py-12 text-center">
            <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Manual não gerado</h3>
            <p className="text-slate-400">
              O manual comercial deste produto ainda não foi gerado.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const conteudo = produto.manual.conteudo || "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-400" />
              Manual do Produto - {produto.nome}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const blob = new Blob([conteudo], { type: "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `manual-${produto.nome.toLowerCase().replace(/\s/g, "-")}.md`;
                  a.click();
                }}
                className="text-slate-400 hover:text-white"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.print()}
                className="text-slate-400 hover:text-white"
              >
                <Printer className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="text-slate-400 text-sm">
            Gerado em{" "}
            {new Date(produto.manual.data_geracao).toLocaleDateString("pt-BR")}
          </p>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-180px)] pr-4">
          <div className="prose prose-invert prose-slate max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold text-white mb-4 mt-6 pb-2 border-b border-slate-700">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-semibold text-white mb-3 mt-5">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-semibold text-blue-300 mb-2 mt-4">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-slate-300 leading-relaxed mb-3">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-slate-300 space-y-1 mb-3">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside text-slate-300 space-y-1 mb-3">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-slate-300">{children}</li>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-500/10 text-blue-200 italic">
                    {children}
                  </blockquote>
                ),
                code: ({ inline, children }) =>
                  inline ? (
                    <code className="bg-slate-800 px-1.5 py-0.5 rounded text-blue-300 text-sm">
                      {children}
                    </code>
                  ) : (
                    <code className="block bg-slate-800 p-4 rounded-lg text-slate-300 text-sm my-3 overflow-x-auto">
                      {children}
                    </code>
                  ),
                strong: ({ children }) => (
                  <strong className="text-white font-semibold">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="text-blue-300 italic">{children}</em>
                ),
              }}
            >
              {conteudo}
            </ReactMarkdown>
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-4 border-t border-slate-700">
          <Button onClick={onClose} className="bg-slate-700 hover:bg-slate-600">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}