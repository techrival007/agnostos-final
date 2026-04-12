import { MessageSquareText, Share2, Code2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] py-3 px-6 lg:px-10 bg-[var(--background)]/80 backdrop-blur-xl flex items-center justify-between sticky bottom-0 z-40">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5">
          <MessageSquareText className="w-4 h-4 text-sky-400" />
          <span className="text-[10px] font-medium text-neutral-500">SUPPORT ONLINE</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="text-[10px] text-neutral-500 hover:text-white transition-all tracking-wider uppercase">Terms</a>
          <a href="#" className="text-[10px] text-neutral-500 hover:text-white transition-all tracking-wider uppercase">Privacy</a>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <a href="#" className="text-neutral-500 hover:text-white transition-all"><Share2 className="w-3.5 h-3.5" /></a>
          <a href="#" className="text-neutral-500 hover:text-white transition-all"><Code2 className="w-3.5 h-3.5" /></a>
        </div>
        <div className="h-3 w-px bg-white/10" />
        <span className="text-[10px] text-neutral-600">&copy; 2026 AGNOSTOS</span>
      </div>
    </footer>
  );
}
