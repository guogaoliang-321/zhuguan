import { Sidebar } from "@/components/layout/sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 md:ml-[260px] p-4 pb-24 sm:p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}
