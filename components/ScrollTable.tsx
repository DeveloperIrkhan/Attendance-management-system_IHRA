export default function ScrollTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-h-[70vh] max-w-full overflow-auto rounded bg-white">
      {children}
    </div>
  );
}