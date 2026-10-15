export default function MemberFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-navy/[0.07] px-5 py-5 text-[10px] text-slate-500 sm:px-8 lg:px-10 dark:border-white/10">
      <p>© {new Date().getFullYear()} LIRC · City College of Calamba</p>
      <p>Learning &amp; Information Resource Center</p>
    </footer>
  );
}
